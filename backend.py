import json
import threading
import time
import requests
import warnings
import pyotp
import pandas as pd
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from pydantic import BaseModel
from datetime import datetime, timedelta
from pymongo import MongoClient
from bson.objectid import ObjectId
from SmartApi import SmartConnect
from SmartApi.smartWebSocketV2 import SmartWebSocketV2
from py_vollib.black_scholes.implied_volatility import implied_volatility
from py_vollib.black_scholes.greeks.analytical import delta
from time import sleep

warnings.filterwarnings('ignore')

app = FastAPI()

# --- MONGODB CONNECTION ---
client = MongoClient("mongodb://localhost:27017/")
db = client["trading_app"]
collection = db["trade_logs"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- GLOBAL VARS ---
MAIN_DATA = []
LIVE_DATA = {}
Strike_list = []
sel_df = pd.DataFrame()
NIFTY_TOKEN = "26000"
ATMStrike = 0.00
expiry = None
LOT_SIZE = 75

CURRENT_WATCHLIST = {"CE": None, "PE": None} 
# add your data

API_KEY = 
USERNAME = 
PASSWORD = 
TOTP_SECRET = 

# --- MODELS ---
class RowRequest(BaseModel):
    strike: str
    type: str 

class SellOrder(BaseModel):
    strike: str
    type: str
    token: str
    buyltp: float

class BulkSellRequest(BaseModel):
    orders: List[SellOrder]

class BuyOrder(BaseModel):
    token: str

class BuyTokensRequest(BaseModel):
    tokens: List[str]

# --- WEBSOCKET & DATA ---
sws = None

def get_ltp(token):
    if token in LIVE_DATA:
        return LIVE_DATA[token].get('ltp', 0)
    return 0

def Main_Data_Load():
    global sws, ATMStrike, LIVE_DATA
    
    SMART_API_OBJ = SmartConnect(API_KEY)
    totp = pyotp.TOTP(TOTP_SECRET).now()
    data = SMART_API_OBJ.generateSession(USERNAME, PASSWORD, totp)
    AUTH_TOKEN = data['data']['jwtToken']
    FEED_TOKEN = SMART_API_OBJ.getfeedToken()
    
    sws = SmartWebSocketV2(AUTH_TOKEN, API_KEY, USERNAME, FEED_TOKEN)
    
    def on_data(wsapp, msg):
        try:
            LIVE_DATA[msg['token']] = {'token': msg['token'], 'ltp': msg['last_traded_price'] / 100}
        except Exception:
            pass

    def on_open(wsapp):
        print("Websocket Connected")
        token_list = [{"exchangeType": 1, "tokens": [NIFTY_TOKEN]}] 
        sws.subscribe('dft_test1', 1, token_list)

    sws.on_data = on_data
    sws.on_open = on_open
    threading.Thread(target=sws.connect).start()
    
    print("Waiting for Nifty Spot Price...")
    sleep(2)
    
    retries = 0
    while NIFTY_TOKEN not in LIVE_DATA and retries < 10:
        sleep(1)
        retries += 1

    spotLtp = LIVE_DATA.get(NIFTY_TOKEN, {'ltp': 0})['ltp']
    if spotLtp == 0:
        print("⚠️ Warning: Could not fetch Nifty Spot. Defaulting ATM.")
        ATMStrike = 24000
    else:
        ATMStrike = round(spotLtp / 50) * 50
    
    print(f"Nifty Spot: {spotLtp}, ATM: {ATMStrike}")

def calculate_greeks_loop():
    global CURRENT_WATCHLIST, LIVE_DATA, expiry
    r = 0.1 
    
    while True:
        try:
            spotltp = get_ltp(NIFTY_TOKEN)
            
            if spotltp > 0 and expiry:
                now = datetime.now()
                expiry_dt = datetime(expiry.year, expiry.month, expiry.day, 15, 30, 0)
                days_diff = (expiry_dt - now).total_seconds() / (24 * 3600)
                t = days_diff / 365.0
                
                if t <= 0: t = 0.0001 

                for opt_type in ["CE", "PE"]:
                    row = CURRENT_WATCHLIST.get(opt_type)
                    if row:
                        token = row['token']
                        ltp = get_ltp(token)
                        strike = float(row['strike'])
                        
                        if ltp > 0:
                            flag = 'c' if opt_type == 'CE' else 'p'
                            try:
                                iv = implied_volatility(ltp, spotltp, strike, t, r, flag)
                                d = delta(flag, spotltp, strike, t, r, iv)
                                CURRENT_WATCHLIST[opt_type]['iv'] = round(iv * 100, 2)
                                CURRENT_WATCHLIST[opt_type]['delta'] = round(d, 2)
                            except Exception:
                                CURRENT_WATCHLIST[opt_type]['iv'] = 0
                                CURRENT_WATCHLIST[opt_type]['delta'] = 0
            sleep(10) 
        except Exception as e:
            print(f"Greek Calc Error: {e}")
            sleep(5)

# --- INITIALIZATION ---
def load_data():
    global MAIN_DATA, Strike_list, sel_df, sws, ATMStrike, expiry, CURRENT_WATCHLIST
    try:
        print("Downloading Scrip Master...")
        url = 'https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json'
        MAIN_DATA = requests.get(url).json()
        print("Scrip Master Downloaded.")
        
        token_df = pd.DataFrame.from_dict(MAIN_DATA)
        token_df['expiry'] = pd.to_datetime(token_df['expiry']).apply(lambda x: x.date())
        token_df = token_df.astype({'strike': float})
        token_df['strike'] = token_df['strike'] / 100
        
        nexpiryList = token_df[(token_df.name == "NIFTY") & (token_df.instrumenttype == 'OPTIDX')]['expiry'].unique().tolist()
        nexpiryList.sort()
        expiry = nexpiryList[0] 
        
        Main_Data_Load()
        
        df = token_df[
            (token_df["exch_seg"] == "NFO") & 
            (token_df["instrumenttype"] == "OPTIDX") & 
            (token_df["name"] == "NIFTY") & 
            (token_df["expiry"] == expiry) & 
            (token_df["strike"] <= ATMStrike + 1000) & 
            (token_df["strike"] >= ATMStrike - 1000)
        ]
        
        sel_df = df.assign(Type=np.where(df["symbol"].str.endswith("CE"), "CE", "PE"))
        
        temp_strike_list = sel_df['strike'].unique().tolist()
        temp_strike_list.sort()
        Strike_list = [str(int(x)) if x.is_integer() else str(x) for x in temp_strike_list]
        
        tokens = sel_df["token"].tolist()
        token_list = [{"exchangeType": 2, "tokens": tokens}]
        if sws:
            sws.subscribe('dft_test1', 1, token_list)
        
        ce_row = sel_df[(sel_df["strike"] == ATMStrike) & (sel_df["Type"] == "CE")].iloc[0].to_dict()
        pe_row = sel_df[(sel_df["strike"] == ATMStrike) & (sel_df["Type"] == "PE")].iloc[0].to_dict()
        
        for row in [ce_row, pe_row]:
            row['iv'] = 0
            row['delta'] = 0
            
        CURRENT_WATCHLIST["CE"] = ce_row
        CURRENT_WATCHLIST["PE"] = pe_row
        
        threading.Thread(target=calculate_greeks_loop, daemon=True).start()
        
        print("✅ System Ready")
        
    except Exception as e:
        print(f"⚠️ Error loading data: {e}")

# --- API ENDPOINTS ---

@app.on_event("startup")
async def startup_event():
    load_data()

@app.get("/api/nifty-ltp")
def get_nifty_price():
    price = get_ltp(NIFTY_TOKEN)
    return {"ltp": price}

@app.get("/api/initial-rows")
def get_initial_rows():
    result = []
    if CURRENT_WATCHLIST["CE"]:
        row = CURRENT_WATCHLIST["CE"].copy()
        row['ltp'] = get_ltp(row['token'])
        result.append(row)
    if CURRENT_WATCHLIST["PE"]:
        row = CURRENT_WATCHLIST["PE"].copy()
        row['ltp'] = get_ltp(row['token'])
        result.append(row)
    return result

@app.get("/api/strikes")
def get_all_strikes():
    return Strike_list

@app.post("/api/get-row")
def get_specific_row(req: RowRequest):
    global CURRENT_WATCHLIST, sel_df
    target_strike = float(req.strike)
    target_type = req.type
    try:
        found_item = sel_df[(sel_df["strike"] == target_strike) & (sel_df["Type"] == target_type)].iloc[0].to_dict()
        found_item['ltp'] = get_ltp(found_item['token'])
        found_item['iv'] = 0
        found_item['delta'] = 0
        CURRENT_WATCHLIST[target_type] = found_item
        return found_item
    except IndexError:
        raise HTTPException(status_code=404, detail="Strike/Type not found")

@app.get("/api/refresh-prices")
def refresh_prices(tokens: str):
    token_list = tokens.split(',')
    updates = {}
    for t in token_list:
        updates[t] = get_ltp(t)
    return updates

# --- DB LOGIC ---

def create_trade_entry(nifty_price, strike, type_val, sell_ltp, token):
    """Creates a new open trade document in MongoDB including Token for live tracking"""
    try:
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        doc = {
            "Token": str(token),  # Added Token
            "Strike": str(strike),
            "Type": type_val,
            "Sell Date Time": now_str,
            "Sell LTP": float(sell_ltp),
            "Buy Date Time": None,
            "Buy LTP": None,
            "Nifty Price": float(nifty_price),
            "Profit": None,
            "Status": "OPEN"
        }
        res = collection.insert_one(doc)
        return str(res.inserted_id)
    except Exception as e:
        print(f"Mongo Insert Error: {e}")
        return None

def close_trade_entry(mongo_id, buy_ltp):
    """Updates an existing trade with Buy details and Profit"""
    try:
        if not mongo_id: return
        
        trade_doc = collection.find_one({"_id": ObjectId(mongo_id)})
        if not trade_doc: return

        sell_ltp = trade_doc.get("Sell LTP", 0)
        profit = (float(sell_ltp) - float(buy_ltp)) * LOT_SIZE
        
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        collection.update_one(
            {"_id": ObjectId(mongo_id)},
            {"$set": {
                "Buy Date Time": now_str,
                "Buy LTP": float(buy_ltp),
                "Profit": profit,
                "Status": "CLOSED"
            }}
        )
    except Exception as e:
        print(f"Mongo Update Error: {e}")

@app.get("/api/positions")
def get_positions():
    try:
        with open('position.json', 'r') as f:
            data = json.load(f)
        
        combined = []
        ce_list = data.get("CE", [])
        pe_list = data.get("PE", [])
        
        for item in ce_list + pe_list:
            token = str(item['token'])
            item['currentLtp'] = get_ltp(token)
            item['symbol'] = f"NIFTY {item['strike']} {item['type']}" 
            item['uniqueId'] = f"{token}-{item['strike']}"
            combined.append(item)
            
        return combined
    except Exception as e:
        return []

@app.post("/api/log-sell")
def log_sell_order(order: SellOrder):
    try:
        with open('position.json', 'r') as f:
            data = json.load(f)
    except:
        data = {"NiftyToken": 0.0, "CE": [], "PE": []}

    current_nifty = get_ltp(NIFTY_TOKEN)
    data["NiftyToken"] = current_nifty

    # PASS TOKEN TO DB
    mongo_id = create_trade_entry(current_nifty, order.strike, order.type, order.buyltp, order.token)

    new_pos = order.dict()
    new_pos['mongo_id'] = mongo_id
    
    if order.type == "CE": data["CE"].append(new_pos)
    elif order.type == "PE": data["PE"].append(new_pos)

    with open('position.json', 'w') as f: json.dump(data, f, indent=4)
    return {"status": "ok", "id": mongo_id}

@app.post("/api/log-sell-bulk")
def log_sell_bulk(req: BulkSellRequest):
    try:
        with open('position.json', 'r') as f: data = json.load(f)
    except: data = {"NiftyToken": 0.0, "CE": [], "PE": []}
    
    current_nifty = get_ltp(NIFTY_TOKEN)
    data["NiftyToken"] = current_nifty

    for order in req.orders:
        # PASS TOKEN TO DB
        mongo_id = create_trade_entry(current_nifty, order.strike, order.type, order.buyltp, order.token)
        
        new_pos = order.dict()
        new_pos['mongo_id'] = mongo_id

        if order.type == "CE": data["CE"].append(new_pos)
        elif order.type == "PE": data["PE"].append(new_pos)

    with open('position.json', 'w') as f: json.dump(data, f, indent=4)
    return {"status": "ok"}

@app.post("/api/buy-order")
def log_buy_order(order: BuyOrder):
    try:
        with open('position.json', 'r') as f: data = json.load(f)
        token = str(order.token)
        
        all_pos = data.get("CE", []) + data.get("PE", [])
        found = next((x for x in all_pos if str(x['token']) == token), None)
        
        if found:
            exit_price = get_ltp(token)
            mongo_id = found.get('mongo_id')
            
            if mongo_id:
                close_trade_entry(mongo_id, exit_price)
            else:
                pass 
        
        data["CE"] = [x for x in data["CE"] if str(x['token']) != token]
        data["PE"] = [x for x in data["PE"] if str(x['token']) != token]
        
        with open('position.json', 'w') as f: json.dump(data, f, indent=4)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/buy-all")
def buy_all_orders():
    try:
        with open('position.json', 'r') as f: data = json.load(f)
        
        for pos in data.get("CE", []) + data.get("PE", []):
            token = str(pos['token'])
            exit_price = get_ltp(token)
            mongo_id = pos.get('mongo_id')
            close_trade_entry(mongo_id, exit_price)
            
        data["CE"] = []
        data["PE"] = []
        with open('position.json', 'w') as f: json.dump(data, f, indent=4)
        return {"status": "ok"}
    except Exception:
        raise HTTPException(status_code=500)

@app.get("/api/trade-logs")
def get_logs():
    # Return logs and calculate unrealized profit for OPEN trades if token is available
    logs = list(collection.find({}, {"_id": 0}).sort("Sell Date Time", -1))
    
    for log in logs:
        # If trade is OPEN and we have a Token, calculate live profit
        if log.get("Status") == "OPEN" and log.get("Token"):
            current_ltp = get_ltp(log["Token"])
            if current_ltp > 0:
                sell_ltp = log.get("Sell LTP", 0)
                # Profit = (Sell - Current) * Lot
                log["Profit"] = (sell_ltp - current_ltp) * LOT_SIZE
                
    return logs
