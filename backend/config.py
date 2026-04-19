"""Configuration settings for CV Pilot API"""
from pydantic_settings import BaseSettings
from typing import Optional
import os
import sys

class Settings(BaseSettings):
    # Supabase
    SUPABASE_URL: Optional[str] = None
    SUPABASE_KEY: Optional[str] = None
    SUPABASE_JWT_SECRET: Optional[str] = None

    # Anthropic (Claude API)
    ANTHROPIC_API_KEY: Optional[str] = None

    # FastAPI
    ENV: str = "development"
    SECRET_KEY: str = "change-me-in-production"
    BACKEND_URL: str = "http://localhost:8000"
    FRONTEND_URL: str = "http://localhost:5173"

    # Server
    PORT: int = 8000
    HOST: str = "0.0.0.0"

    # Database (optional)
    DATABASE_URL: Optional[str] = None

    class Config:
        env_file = ".env"
        case_sensitive = True

try:
    settings = Settings()

    # Validate required settings
    missing_vars = []
    if not settings.SUPABASE_URL:
        missing_vars.append("SUPABASE_URL")
    if not settings.SUPABASE_KEY:
        missing_vars.append("SUPABASE_KEY")
    if not settings.ANTHROPIC_API_KEY:
        missing_vars.append("ANTHROPIC_API_KEY")

    if missing_vars:
        print("\n" + "="*60)
        print("❌ MISSING ENVIRONMENT VARIABLES")
        print("="*60)
        print(f"\nPlease set the following in your .env file:")
        for var in missing_vars:
            print(f"  - {var}")
        print("\n1. Copy .env.example to .env")
        print("2. Fill in your Supabase and Anthropic credentials")
        print("3. Run the server again\n")
        print("="*60 + "\n")
        sys.exit(1)

except Exception as e:
    print(f"\n❌ Configuration Error: {e}\n")
    sys.exit(1)
