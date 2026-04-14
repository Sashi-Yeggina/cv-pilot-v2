"""Configuration settings for CV Pilot API"""
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Supabase
    SUPABASE_URL: str
    SUPABASE_KEY: str
    SUPABASE_JWT_SECRET: str

    # Anthropic (Claude API)
    ANTHROPIC_API_KEY: str

    # FastAPI
    ENV: str = "development"
    SECRET_KEY: str
    BACKEND_URL: str = "http://localhost:8000"
    FRONTEND_URL: str = "http://localhost:3000"

    # Server
    PORT: int = 8000
    HOST: str = "0.0.0.0"

    # Database (optional)
    DATABASE_URL: Optional[str] = None

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
