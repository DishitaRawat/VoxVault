import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.routes import auth, user, media

app = FastAPI(title="VoxVault API", version="1.0.0")

# Dynamic CORS middleware configuration
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5175,http://127.0.0.1:5175")
allowed_origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create upload directory if it does not exist
UPLOAD_DIR = "app/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Mount uploaded files directory statically
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Register routers
app.include_router(auth.router)
app.include_router(user.router)
app.include_router(media.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to the VoxVault FastAPI Backend API!"}

if __name__ == "__main__":
    is_dev = os.getenv("ENVIRONMENT", "production").lower() == "development"
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=is_dev)
