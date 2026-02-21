from fastapi import FastAPI

app = FastAPI(title="MapleBudget API")

@app.get("/health")
def health():
    return {"status": "ok"}
