"""
OpenAI integration for CV enhancement using ChatGPT models.
Mirrors the interface of cv_engine.py but uses OpenAI API.

Supports: GPT-3.5 Turbo, GPT-4o, GPT-4 Turbo
"""

from openai import OpenAI
from config import settings
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# Initialize OpenAI client lazily (only when first used)
_openai_client: Optional[OpenAI] = None


def get_openai_client() -> OpenAI:
    """Get or create OpenAI client (lazy loading)"""
    global _openai_client
    if _openai_client is None:
        if not settings.OPENAI_API_KEY:
            raise RuntimeError(
                "OpenAI API key not configured. "
                "Set OPENAI_API_KEY in .env or environment variables."
            )
        _openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
    return _openai_client


def parse_jd_openai(jd_text: str) -> dict:
    """
    Parse job description using GPT.
    Extracts key requirements and skills from JD.

    Args:
        jd_text: Raw job description text

    Returns:
        {
            "status": "success",
            "analysis": "Key requirements extracted...",
            "model": "gpt-4o"
        }
    """
    try:
        client = get_openai_client()

        response = client.chat.completions.create(
            model=settings.OPENAI_DEFAULT_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert recruiter. Extract key requirements, skills, and qualifications from this job description. Be concise and organized.",
                },
                {"role": "user", "content": jd_text},
            ],
            temperature=0.7,
            max_tokens=500,
        )

        return {
            "status": "success",
            "analysis": response.choices[0].message.content,
            "model": settings.OPENAI_DEFAULT_MODEL,
        }
    except Exception as e:
        logger.error(f"OpenAI parse_jd error: {e}")
        return {"status": "error", "error": str(e)}


def enhance_cv_openai(
    base_cv_text: str, jd_text: str, model: str = None
) -> dict:
    """
    Main function: Enhance CV using OpenAI to match job description.

    Reorders bullet points, adjusts keywords, highlights achievements
    to better match the job description.

    Args:
        base_cv_text: Current CV content
        jd_text: Job description
        model: OpenAI model to use (defaults to OPENAI_DEFAULT_MODEL)

    Returns:
        {
            "status": "success",
            "enhanced_cv": "Enhanced CV text...",
            "model": "gpt-4o",
            "cost": 0.005
        }
    """
    try:
        if not model:
            model = settings.OPENAI_DEFAULT_MODEL

        client = get_openai_client()

        system_prompt = """You are an expert CV writer specializing in ATS optimization and recruiter impact.

Your task is to enhance the provided CV to better match the job description by:

1. **Reorder bullets** - Put most relevant experience first
2. **Match keywords** - Use terminology from the job description
3. **Quantify achievements** - Add metrics where possible (e.g., "increased by 40%")
4. **Improve clarity** - Make accomplishments crystal clear
5. **Preserve structure** - Keep the same CV format and sections

Important rules:
- Do NOT add fake experience
- Do NOT change facts or dates
- Return ONLY the enhanced CV text
- Do NOT add explanations or preamble
- Keep the same professional tone
- Maintain all original sections
"""

        user_message = f"""Here is the CV to enhance:

---BEGIN CV---
{base_cv_text}
---END CV---

Here is the target job description:

---BEGIN JD---
{jd_text}
---END JD---

Please enhance the CV to match this job description while following the rules above."""

        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            temperature=0.7,
            max_tokens=2000,
        )

        enhanced_cv = response.choices[0].message.content

        # Calculate cost (approximate rates as of April 2026)
        # These should be updated if OpenAI pricing changes
        cost_map = {
            "gpt-3.5-turbo": 0.0005,
            "gpt-4o": 0.005,
            "gpt-4-turbo": 0.010,
        }
        estimated_cost = cost_map.get(model, 0.005)

        return {
            "status": "success",
            "enhanced_cv": enhanced_cv,
            "model": model,
            "cost": estimated_cost,
        }
    except Exception as e:
        logger.error(f"OpenAI enhance_cv error: {e}")
        return {"status": "error", "error": str(e)}


def extract_cv_info_openai(cv_text: str) -> dict:
    """
    Extract structured information from CV using GPT.

    Extracts: name, title, skills, experience summary, etc.

    Args:
        cv_text: CV content to parse

    Returns:
        {
            "status": "success",
            "extracted_info": "Structured CV data...",
            "model": "gpt-4o"
        }
    """
    try:
        client = get_openai_client()

        response = client.chat.completions.create(
            model=settings.OPENAI_DEFAULT_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "Extract and structure CV data. Return in clear, organized format with sections for: name, title, skills, experience, education.",
                },
                {"role": "user", "content": cv_text},
            ],
            temperature=0.3,
            max_tokens=800,
        )

        return {
            "status": "success",
            "extracted_info": response.choices[0].message.content,
            "model": settings.OPENAI_DEFAULT_MODEL,
        }
    except Exception as e:
        logger.error(f"OpenAI extract_cv_info error: {e}")
        return {"status": "error", "error": str(e)}


# Available OpenAI models with metadata
OPENAI_MODELS = [
    {
        "id": "gpt-3.5-turbo",
        "name": "GPT-3.5 Turbo",
        "provider": "openai",
        "cost": 0.0005,
        "speed": "Very Fast (3s)",
        "quality": "Budget",
        "description": "Fastest and most economical. Good for simple CVs.",
    },
    {
        "id": "gpt-4o",
        "name": "GPT-4o",
        "provider": "openai",
        "cost": 0.005,
        "speed": "Medium (6s)",
        "quality": "Balanced",
        "description": "Latest, most capable. Multimodal support.",
    },
    {
        "id": "gpt-4-turbo",
        "name": "GPT-4 Turbo",
        "provider": "openai",
        "cost": 0.010,
        "speed": "Slower (10s)",
        "quality": "Premium",
        "description": "Maximum quality. Best for complex roles.",
    },
]
