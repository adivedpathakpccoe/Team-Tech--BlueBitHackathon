Easy, run

```bash
# make the helper script executable the first time
chmod +x run-all.sh

# then start both services:
./run-all.sh
```

The script will install dependencies (npm and pip) and launch frontend (Next.js) on port 3000
and backend (uvicorn FastAPI) on port 8000. You can also start each component manually if you prefer. 