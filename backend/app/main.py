import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.routes import auth, user, media

app = FastAPI(title="VoxVault API", version="1.0.0")

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5175", "http://127.0.0.1:5175"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount uploaded files directory statically
app.mount("/uploads", StaticFiles(directory="app/uploads"), name="uploads")

# Register routers
app.include_router(auth.router)
app.include_router(user.router)
app.include_router(media.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to the VoxVault FastAPI Backend API!"}

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
