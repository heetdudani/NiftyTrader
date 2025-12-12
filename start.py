import subprocess
import time

# 1. Define commands
# Backend runs from the current root folder
cmd_backend = "uvicorn backend:app --reload"

# Frontend command (just the run command, we handle the folder separately)
cmd_frontend = "npm run dev"

procs = []

try:
    print("--- Starting Servers ---")

    # Start Backend
    print(f"1) Launching: {cmd_backend}")
    procs.append(subprocess.Popen(cmd_backend, shell=True))

    # Start Frontend
    # cwd="frontend" is the equivalent of typing 'cd frontend' before running the command
    print(f"2) Launching: {cmd_frontend} (inside /frontend folder)")
    procs.append(subprocess.Popen(cmd_frontend, cwd="frontend", shell=True))

    # Keep script running so servers stay alive
    while True:
        time.sleep(1)

except KeyboardInterrupt:
    print("\n--- Stopping Servers ---")
    for p in procs:
        p.terminate()