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

    # ════════════════════════════════════════════════════════════════
    # OpenAI Configuration (Optional)
    # ════════════════════════════════════════════════════════════════
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_DEFAULT_MODEL: str = "gpt-4o"
    ENABLE_OPENAI: bool = False

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

    # Print all loaded config at startup so Railway logs show what was loaded
    print(f"[config] ENV={settings.ENV}")
    print(f"[config] SUPABASE_URL={'SET' if settings.SUPABASE_URL else 'MISSING'}")
    print(f"[config] SUPABASE_KEY={'SET' if settings.SUPABASE_KEY else 'MISSING'}")
    print(f"[config] ANTHROPIC_API_KEY={'SET' if settings.ANTHROPIC_API_KEY else 'MISSING'}")
    print(f"[config] OPENAI_API_KEY={'SET' if settings.OPENAI_API_KEY else 'MISSING'}")
    print(f"[config] FRONTEND_URL={settings.FRONTEND_URL}")

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
        print("❌ MISSING ENVIRONMENT VARIABLES: " + ", ".join(missing_vars))
        print("="*60 + "\n")
        sys.exit(1)

    print("[config] ✅ All required environment variables loaded")

except Exception as e:
    print(f"\n❌ Configuration Error: {type(e).__name__}: {e}\n")
    import traceback
    traceback.print_exc()
    sys.exit(1)
