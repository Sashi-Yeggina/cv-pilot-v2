"""Authentication service for Supabase"""
from config import settings
from supabase import create_client
import os

supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

async def register_user(email: str, password: str, full_name: str):
    """Register new user via Supabase Auth"""
    try:
        # Create auth user
        auth_response = supabase.auth.sign_up({
            "email": email,
            "password": password
        })

        if not auth_response.user:
            return {"error": "Failed to create user"}

        user_id = auth_response.user.id

        # Create user profile in users table
        supabase.table("users").insert({
            "id": user_id,
            "email": email,
            "full_name": full_name,
            "role": "user",
            "is_active": True
        }).execute()

        return {
            "success": True,
            "user_id": user_id,
            "email": email,
            "access_token": auth_response.session.access_token if auth_response.session else None
        }
    except Exception as e:
        print(f"Registration error: {e}")
        return {"error": str(e)}

async def login_user(email: str, password: str):
    """Login user via Supabase Auth"""
    try:
        auth_response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })

        if not auth_response.user or not auth_response.session:
            return {"error": "Invalid credentials"}

        # Get user role
        user_data = supabase.table("users").select("role").eq("id", auth_response.user.id).execute()
        role = user_data.data[0]["role"] if user_data.data else "user"

        return {
            "success": True,
            "user_id": auth_response.user.id,
            "email": auth_response.user.email,
            "access_token": auth_response.session.access_token,
            "role": role
        }
    except Exception as e:
        print(f"Login error: {e}")
        return {"error": str(e)}

def verify_token(token: str):
    """Verify JWT token and get user"""
    try:
        user = supabase.auth.get_user(token)
        return user
    except Exception as e:
        print(f"Token verification error: {e}")
        return None

def logout_user(token: str):
    """Logout user"""
    try:
        supabase.auth.sign_out()
        return {"success": True}
    except Exception as e:
        print(f"Logout error: {e}")
        return {"error": str(e)}
