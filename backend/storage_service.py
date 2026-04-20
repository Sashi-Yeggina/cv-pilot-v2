"""Storage service for Supabase file storage"""
from supabase import create_client, Client
from config import settings
from typing import Optional
import os

# Lazy init — client created on first use, not at import time.
# This prevents startup crashes if env vars are misconfigured.
_supabase: Optional[Client] = None

def get_storage_client() -> Client:
    global _supabase
    if _supabase is None:
        _supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    return _supabase

# ════════════════════════════════════════════════════════════════
# FILE UPLOAD/DOWNLOAD
# ════════════════════════════════════════════════════════════════

def upload_cv(user_id: str, bucket: str, file_path: str, file_data: bytes) -> Optional[str]:
    """Upload CV file to Supabase Storage"""
    try:
        storage_path = f"{user_id}/{file_path}"
        get_storage_client().storage.from_(bucket).upload(storage_path, file_data)
        return storage_path
    except Exception as e:
        print(f"Error uploading file: {e}")
        return None

def download_cv(bucket: str, file_path: str) -> Optional[bytes]:
    """Download CV file from Supabase Storage"""
    try:
        response = get_storage_client().storage.from_(bucket).download(file_path)
        return response
    except Exception as e:
        print(f"Error downloading file: {e}")
        return None

def delete_cv(bucket: str, file_path: str) -> bool:
    """Delete CV file from Supabase Storage"""
    try:
        get_storage_client().storage.from_(bucket).remove([file_path])
        return True
    except Exception as e:
        print(f"Error deleting file: {e}")
        return False

def get_file_url(bucket: str, file_path: str) -> Optional[str]:
    """Get public URL for file"""
    try:
        url = get_storage_client().storage.from_(bucket).get_public_url(file_path)
        return url
    except Exception as e:
        print(f"Error getting file URL: {e}")
        return None

def list_user_files(user_id: str, bucket: str) -> list:
    """List all files for a user"""
    try:
        files = get_storage_client().storage.from_(bucket).list(user_id)
        return files or []
    except Exception as e:
        print(f"Error listing files: {e}")
        return []
