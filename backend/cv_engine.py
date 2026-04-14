"""
cv_engine.py  (v4 — Library-First + Per-User Model + Token Tracking)
──────────────────────────────────────────────────────────────────────
Claude API is called ONLY when the bullet library cannot cover the JD.

Decision tree
─────────────
  coverage ≥ 0.80  →  library_only      0 extra API calls  (just parse_jd)
  coverage ≥ 0.55  →  library_plus_api  1 extra API call   (fill gap bullets)
  coverage <  0.55 →  full_api          2 extra API calls  (score + full enhance)

Token tracking
──────────────
  Every function now returns a dict with keys:
    result        → the parsed JSON (original return value)
    input_tokens  → tokens in the prompt
    output_tokens → tokens in the response
    cost_usd      → estimated cost for this call

  Callers accumulate these across all calls in a generation and pass the
  totals to save_assembly_log().

Pricing (USD per 1M tokens, April 2026)
──────────────────────────────────────────
  Model                         Input     Output
  claude-haiku-4-5-20251001     $0.80     $4.00
  claude-sonnet-4-6             $3.00    $15.00
  claude-opus-4-6              $15.00    $75.00
"""

from anthropic import Anthropic
from config import settings
import json

client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)

# ─────────────────────────────────────────────────────────────────────────────
# PRICING  (USD per 1 M tokens)
# ─────────────────────────────────────────────────────────────────────────────
MODEL_PRICING: dict[str, dict[str, float]] = {
    "claude-haiku-4-5-20251001": {"input":  0.80, "output":  4.00},
    "claude-sonnet-4-6":         {"input":  3.00, "output": 15.00},
    "claude-opus-4-6":           {"input": 15.00, "output": 75.00},
}

def _calc_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """Return estimated USD cost for a single API call."""
    pricing = MODEL_PRICING.get(model, MODEL_PRICING["claude-haiku-4-5-20251001"])
    return (
        input_tokens  / 1_000_000 * pricing["input"] +
        output_tokens / 1_000_000 * pricing["output"]
    )

def _usage(response, model: str) -> dict:
    """Extract token counts + cost from an API response object."""
    inp = getattr(response.usage, "input_tokens",  0) or 0
    out = getattr(response.usage, "output_tokens", 0) or 0
    return {
        "input_tokens":  inp,
        "output_tokens": out,
        "cost_usd":      _calc_cost(model, inp, out),
    }

# ─────────────────────────────────────────────────────────────────────────────
# THRESHOLDS
# ─────────────────────────────────────────────────────────────────────────────
LIBRARY_ONLY_THRESHOLD  = 0.80   # use library only — no enhance API call
LIBRARY_PATCH_THRESHOLD = 0.55   # use library + small patch API call
# below 0.55 → full generation

# ─────────────────────────────────────────────────────────────────────────────
# AVAILABLE MODELS — single source of truth shared with admin UI
# ─────────────────────────────────────────────────────────────────────────────
AVAILABLE_MODELS = [
    {
        "id":          "claude-haiku-4-5-20251001",
        "label":       "Haiku (Fast · Low Cost)",
        "description": "Best for most users. Fastest response, lowest API cost.",
        "tier":        "standard",
        "approx_cost": "$0.25 / 1M input tokens",
    },
    {
        "id":          "claude-sonnet-4-6",
        "label":       "Sonnet (Balanced)",
        "description": "Higher quality CV writing. Good for senior/complex roles.",
        "tier":        "premium",
        "approx_cost": "$3 / 1M input tokens",
    },
    {
        "id":          "claude-opus-4-6",
        "label":       "Opus (Highest Quality)",
        "description": "Best possible output. Reserved for executive / C-suite CVs.",
        "tier":        "elite",
        "approx_cost": "$15 / 1M input tokens",
    },
]

DEFAULT_MODEL = "claude-haiku-4-5-20251001"

# ─────────────────────────────────────────────────────────────────────────────
# 1. PARSE JD  (always 1 call — needed to know what skills the JD requires)
# ─────────────────────────────────────────────────────────────────────────────

def parse_jd(jd_text: str, model: str = DEFAULT_MODEL) -> dict:
    """
    Parse job description → structured profile + token usage.
    Returns: { "result": {...}, "input_tokens": n, "output_tokens": n, "cost_usd": n }
    """
    try:
        response = client.messages.create(
            model=model,
            max_tokens=1500,
            messages=[{"role": "user", "content": f"""Analyze this job description and extract structured information.

Job Description:
{jd_text}

Return ONLY valid JSON:
{{
  "role_title": "exact role title from JD",
  "role_category": "Cloud Engineer | Architect | DevOps | SRE | AIOps | Other",
  "seniority": "Junior | Mid | Senior | Lead | Principal",
  "required_skills": ["skill1", "skill2"],
  "preferred_skills": ["skill1", "skill2"],
  "years_experience": "e.g. 5+ years",
  "key_responsibilities": ["resp1", "resp2"],
  "company_type": "Enterprise | Startup | Consultancy",
  "cloud_platform": "AWS | Azure | GCP | MultiCloud | Hybrid"
}}"""}]
        )
        return {"result": _parse_json_response(response), **_usage(response, model)}
    except Exception as e:
        print(f"[parse_jd] error: {e}")
        return {"result": _default_jd_profile(), "input_tokens": 0, "output_tokens": 0, "cost_usd": 0.0}

# ─────────────────────────────────────────────────────────────────────────────
# 2. SCORE CVs  (only called when coverage < LIBRARY_PATCH_THRESHOLD)
# ─────────────────────────────────────────────────────────────────────────────

def score_cvs(cv_texts: list, jd: dict, model: str = DEFAULT_MODEL) -> dict:
    """
    Rank candidate base CVs against the JD.
    Returns: { "result": [scores...], "input_tokens": n, "output_tokens": n, "cost_usd": n }
    """
    try:
        cv_summaries = "\n\n---\n\n".join([
            f"CV_{i}: {cv['name']}\n{cv['text'][:2000]}"
            for i, cv in enumerate(cv_texts)
        ])
        jd_summary = (
            f"Role: {jd.get('role_title')}\n"
            f"Seniority: {jd.get('seniority')}\n"
            f"Required Skills: {', '.join(jd.get('required_skills', []))}\n"
            f"Cloud: {jd.get('cloud_platform')}"
        )
        response = client.messages.create(
            model=model,
            max_tokens=2000,
            messages=[{"role": "user", "content": f"""Score each CV against the job requirements.

JD Summary:
{jd_summary}

CVs to Score:
{cv_summaries}

Return ONLY valid JSON:
{{
  "scores": [
    {{
      "cv_index": 0,
      "score": 0.85,
      "reasoning": "Strong match because...",
      "matched_skills": ["AWS", "Docker"],
      "missing_skills": ["Kubernetes"]
    }}
  ]
}}"""}]
        )
        parsed = _parse_json_response(response)
        return {"result": parsed.get("scores", []), **_usage(response, model)}
    except Exception as e:
        print(f"[score_cvs] error: {e}")
        fallback = [{"cv_index": i, "score": 0.5, "reasoning": "scoring error"}
                    for i in range(len(cv_texts))]
        return {"result": fallback, "input_tokens": 0, "output_tokens": 0, "cost_usd": 0.0}

# ─────────────────────────────────────────────────────────────────────────────
# 3. FILL GAP BULLETS  (called only for gap_skills when 0.55 ≤ coverage < 0.80)
# ─────────────────────────────────────────────────────────────────────────────

def fill_gap_bullets(
    base_cv_text: str,
    gap_skills: list[str],
    jd_profile: dict,
    n_bullets: int = 4,
    model: str = DEFAULT_MODEL,
) -> dict:
    """
    Generate ONLY the missing bullet points for skills not in the library.
    Returns: { "result": [bullets...], "input_tokens": n, "output_tokens": n, "cost_usd": n }
    """
    if not gap_skills:
        return {"result": [], "input_tokens": 0, "output_tokens": 0, "cost_usd": 0.0}

    gap_str  = ", ".join(gap_skills)
    role     = jd_profile.get("role_title", "Cloud Professional")
    cloud    = jd_profile.get("cloud_platform", "AWS")

    try:
        response = client.messages.create(
            model=model,
            max_tokens=900,
            messages=[{"role": "user", "content": f"""The candidate has a CV for a {role} role.
Their CV already covers most requirements, but is MISSING these skills: {gap_str}.

Write exactly {n_bullets} achievement-style bullet points (past tense, quantified where possible)
that demonstrate experience with: {gap_str}.

Cloud platform context: {cloud}

Reference CV excerpt for writing style:
{base_cv_text[:800]}

Return ONLY valid JSON:
{{
  "bullets": [
    "Led implementation of ...",
    "Designed and deployed ...",
    "Established ... reducing ... by X%",
    "Mentored team on ..."
  ]
}}"""}]
        )
        parsed = _parse_json_response(response)
        return {"result": parsed.get("bullets", []), **_usage(response, model)}
    except Exception as e:
        print(f"[fill_gap_bullets] error: {e}")
        return {"result": [], "input_tokens": 0, "output_tokens": 0, "cost_usd": 0.0}

# ─────────────────────────────────────────────────────────────────────────────
# 4. FULL ENHANCE  (only called when coverage < LIBRARY_PATCH_THRESHOLD)
# ─────────────────────────────────────────────────────────────────────────────

def enhance_cv(cv_text: str, jd_text: str, jd_profile: dict, model: str = DEFAULT_MODEL) -> dict:
    """
    Full CV enhancement — rewrites title, summary, and experience bullets.
    Returns: { "result": {...}, "input_tokens": n, "output_tokens": n, "cost_usd": n }
    """
    try:
        response = client.messages.create(
            model=model,
            max_tokens=2500,
            messages=[{"role": "user", "content": f"""You are an expert CV writer. Enhance this CV to match the job requirements.

Original CV:
{cv_text[:3000]}

Job Description:
{jd_text[:2000]}

Required Skills: {', '.join(jd_profile.get('required_skills', []))}
Preferred Skills: {', '.join(jd_profile.get('preferred_skills', []))}
Key Responsibilities: {', '.join(jd_profile.get('key_responsibilities', []))}

Enhance the CV by:
1. Updating the role title to match the JD role
2. Rewriting the professional summary to mirror JD requirements
3. Enhancing 5-8 bullet points to highlight relevant experience
4. Naturally injecting JD keywords

Return ONLY valid JSON:
{{
  "enhanced_title": "New role title",
  "enhanced_summary": "New professional summary (2-3 sentences)",
  "enhanced_bullets": ["bullet 1", "bullet 2", "bullet 3", "bullet 4", "bullet 5"],
  "injected_keywords": ["AWS", "Terraform"],
  "changes_made": "Summary of changes"
}}"""}]
        )
        return {"result": _parse_json_response(response), **_usage(response, model)}
    except Exception as e:
        print(f"[enhance_cv] error: {e}")
        return {"result": _default_enhance(), "input_tokens": 0, "output_tokens": 0, "cost_usd": 0.0}

# ─────────────────────────────────────────────────────────────────────────────
# 5. EXTRACT CV METADATA  (called on upload — 1 small call, cached in DB)
# ─────────────────────────────────────────────────────────────────────────────

def extract_cv_info(cv_text: str, model: str = DEFAULT_MODEL) -> dict:
    """
    Extract role title, seniority, industry from CV text on upload.
    Returns: { "result": {...}, "input_tokens": n, "output_tokens": n, "cost_usd": n }
    """
    try:
        response = client.messages.create(
            model=model,
            max_tokens=500,
            messages=[{"role": "user", "content": f"""Extract key information from this CV.

CV Text:
{cv_text[:2000]}

Return ONLY valid JSON:
{{
  "role_title": "Current or most recent role",
  "seniority": "Entry | Mid | Senior | Lead | Principal",
  "industry": "Primary industry",
  "skills": ["skill1", "skill2"],
  "years_experience": "Estimated total years"
}}"""}]
        )
        return {"result": _parse_json_response(response), **_usage(response, model)}
    except Exception as e:
        print(f"[extract_cv_info] error: {e}")
        fallback = {"role_title": "Unknown", "seniority": "Mid",
                    "industry": "Unknown", "skills": [], "years_experience": "Unknown"}
        return {"result": fallback, "input_tokens": 0, "output_tokens": 0, "cost_usd": 0.0}

# ─────────────────────────────────────────────────────────────────────────────
# SMART GENERATION ORCHESTRATOR
# ─────────────────────────────────────────────────────────────────────────────

def decide_generation_strategy(coverage_pct: float) -> str:
    """
    Return the generation strategy string based on library coverage.
    """
    if coverage_pct >= LIBRARY_ONLY_THRESHOLD:
        return "library_only"
    elif coverage_pct >= LIBRARY_PATCH_THRESHOLD:
        return "library_plus_api"
    else:
        return "full_api"

# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _parse_json_response(response) -> dict | list:
    text = response.content[0].text.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())


def _default_jd_profile() -> dict:
    return {
        "role_title": "Cloud Professional",
        "role_category": "Other",
        "seniority": "Mid",
        "required_skills": [],
        "preferred_skills": [],
        "years_experience": "Unknown",
        "key_responsibilities": [],
        "company_type": "Unknown",
        "cloud_platform": "AWS",
    }


def _default_enhance() -> dict:
    return {
        "enhanced_title": "Cloud Professional",
        "enhanced_summary": "Experienced cloud professional.",
        "enhanced_bullets": [],
        "injected_keywords": [],
        "changes_made": "Error in enhancement",
    }
