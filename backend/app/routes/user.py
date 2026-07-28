from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.auth_helper import get_current_user
from app.db import get_database

router = APIRouter(prefix="/user", tags=["user"])

class UpdateProfileRequest(BaseModel):
    full_name: str

@router.get("/profile")
def get_profile(current_user: dict = Depends(get_current_user)):
    db = get_database()
    user_id = current_user["id"]
    
    user_doc = db.users.find_one({"_id": user_id})
    
    if not user_doc:
        # Create an entry if it doesn't exist yet
        user_doc = {
            "_id": user_id,
            "email": current_user["email"],
            "full_name": ""
        }
        db.users.insert_one(user_doc)
        
    return {
        "id": user_id,
        "email": user_doc["email"],
        "full_name": user_doc.get("full_name", "")
    }

@router.post("/profile/update")
def update_profile(req: UpdateProfileRequest, current_user: dict = Depends(get_current_user)):
    db = get_database()
    user_id = current_user["id"]
    
    db.users.update_one(
        {"_id": user_id},
        {"$set": {"full_name": req.full_name}}
    )
    
    return {
        "message": "Profile updated successfully",
        "user": {
            "id": user_id,
            "email": current_user["email"],
            "full_name": req.full_name
        }
    }
