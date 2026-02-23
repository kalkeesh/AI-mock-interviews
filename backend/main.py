from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

try:
    from dotenv import load_dotenv

    load_dotenv()
except Exception:
    pass

if __package__:
    from .auth import router as auth_router
    from .resume_router import router as res_router
    from .interview_router import router as interview_router
    from .db import ping_mongo
else:
    from auth import router as auth_router
    from resume_router import router as res_router
    from interview_router import router as interview_router
    from db import ping_mongo

app = FastAPI(title="AI Mock Interviews API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(res_router)
app.include_router(interview_router)


@app.get("/health")
def health_check():
    mongo_ok = ping_mongo()
    return {"status": "ok", "mongodb": "connected" if mongo_ok else "disconnected"}
