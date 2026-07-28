from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from app.auth_helper import get_supabase_client
from app.db import get_database

router = APIRouter(prefix="/auth", tags=["auth"])

class SignUpRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class ResetPasswordRequest(BaseModel):
    email: EmailStr

@router.post("/signup")
def signup(req: SignUpRequest):
    supabase = get_supabase_client()
    db = get_database()
    
    try:
        # 1. Sign up user in Supabase Auth
        res = supabase.auth.sign_up({
            "email": req.email,
            "password": req.password
        })
        
        if not res or not res.user:
            raise HTTPException(status_code=400, detail="Failed to create user in authentication system")
            
        user_id = res.user.id
        
        # 2. Store metadata in MongoDB
        db.users.update_one(
            {"_id": user_id},
            {"$set": {"email": req.email, "full_name": req.full_name}},
            upsert=True
        )
        
        return {
            "message": "Registration successful. Please check your email for confirmation link if enabled.",
            "user_id": user_id
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/login")
def login(req: LoginRequest):
    supabase = get_supabase_client()
    db = get_database()
    
    try:
        # Sign in via Supabase
        res = supabase.auth.sign_in_with_password({
            "email": req.email,
            "password": req.password
        })
        
        if not res or not res.session or not res.user:
            raise HTTPException(status_code=400, detail="Invalid sign in credentials")
            
        user_id = res.user.id
        
        # Retrieve full name from MongoDB
        user_doc = db.users.find_one({"_id": user_id})
        full_name = user_doc.get("full_name", "") if user_doc else ""
        
        return {
            "access_token": res.session.access_token,
            "user": {
                "id": user_id,
                "email": res.user.email,
                "full_name": full_name
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest):
    supabase = get_supabase_client()
    try:
        supabase.auth.reset_password_for_email(req.email)
        return {"message": "Recovery link has been sent to your email."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

from typing import Optional

class OAuthCallbackRequest(BaseModel):
    access_token: Optional[str] = None
    code: Optional[str] = None

@router.post("/oauth-callback")
def oauth_callback(req: OAuthCallbackRequest):
    supabase = get_supabase_client()
    db = get_database()
    print("[OAuth Callback] Received OAuth token/code verification request")
    
    try:
        token = req.access_token
        
        # If code is provided (PKCE flow), exchange code for session token
        if req.code and not token:
            try:
                res = supabase.auth.exchange_code_for_session({"auth_code": req.code})
                if res and res.session:
                    token = res.session.access_token
            except Exception as exchange_err:
                print(f"[OAuth Callback] Code exchange warning: {exchange_err}")
                
        if not token:
            raise HTTPException(status_code=400, detail="Missing access_token or authorization code.")
            
        user_res = supabase.auth.get_user(token)
        if not user_res or not user_res.user:
            print("[OAuth Callback] Error: empty user response from Supabase")
            raise HTTPException(status_code=400, detail="Invalid session token")
            
        sb_user = user_res.user
        user_id = sb_user.id
        email = sb_user.email
        print(f"[OAuth Callback] Verified user {email} (ID: {user_id})")
        
        metadata = sb_user.user_metadata or {}
        full_name = metadata.get("full_name") or metadata.get("name") or email.split("@")[0]
        
        print(f"[OAuth Callback] Writing to MongoDB. Full name: {full_name}")
        result = db.users.update_one(
            {"_id": user_id},
            {"$set": {"email": email, "full_name": full_name}},
            upsert=True
        )
        print(f"[OAuth Callback] MongoDB update complete. Matched: {result.matched_count}, Modified: {result.modified_count}, Upserted ID: {result.upserted_id}")
        
        return {
            "access_token": token,
            "user": {
                "id": user_id,
                "email": email,
                "full_name": full_name
            }
        }
    except Exception as e:
        print("[OAuth Callback] ERROR:", str(e))
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))
