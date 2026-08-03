"""
Stage 2.6 — Card Generation via constrained OpenRouter LLM call.
"""

import logging
from typing import Any
from pydantic import BaseModel, ValidationError
import httpx

from app.config import settings

logger = logging.getLogger(__name__)

class CardSourceModel(BaseModel):
    url: str
    quote: str
    published_date: str

class CardExtractionModel(BaseModel):
    """The exact Pydantic model corresponding to the forced JSON schema."""
    gap_description: str
    matching_reasoning: str
    sources: list[CardSourceModel]
    fit_tier: str
    bridge_note: str | None = None

SCHEMA_JSON = {
  "type": "object",
  "required": ["gap_description", "matching_reasoning", "sources", "fit_tier"],
  "properties": {
    "gap_description": { "type": "string" },
    "matching_reasoning": { "type": "string" },
    "sources": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["url", "quote", "published_date"],
        "properties": {
          "url": { "type": "string" },
          "quote": { "type": "string" },
          "published_date": { "type": "string" }
        },
        "additionalProperties": False
      }
    },
    "fit_tier": { "type": "string", "enum": ["strong", "stretch"] },
    "bridge_note": { "type": ["string", "null"] }
  },
  "additionalProperties": False
}


class CardGenerator:
    """Generates the card details using a constrained LLM call via OpenRouter."""

    def __init__(self, model_name: str = "openai/gpt-4o-mini"):
        if not settings.openrouter_api_key:
            raise ValueError("OPENROUTER_API_KEY is required for card generation")
        self._api_key = settings.openrouter_api_key
        self._model_name = model_name

    async def generate_card(
        self, 
        cluster_label: str, 
        evidence_items: list[dict], 
        user_skills: list[str], 
        user_domains: list[str],
        fit_tier_input: str
    ) -> CardExtractionModel:
        """
        Generate card content and validate that URLs match the input.
        """
        if not evidence_items:
            raise ValueError("Cannot generate card without evidence items")

        # Prepare evidence text and valid URLs
        valid_urls = {ev["url"] for ev in evidence_items}
        evidence_text_list = []
        for ev in evidence_items:
            # We don't provide the company name, just the raw text and metadata
            evidence_text_list.append(
                f"URL: {ev['url']}\nDate: {ev['posted_at']}\nContent:\n{ev['raw_text']}\n---"
            )
        evidence_text = "\n".join(evidence_text_list)

        user_profile_text = f"Skills: {', '.join(user_skills)}\nDomains: {', '.join(user_domains)}"

        system_prompt = (
            "You are a technical opportunity analyzer. You summarize problem evidence into a plain-language "
            "gap description, explain why it matches the developer's profile, and quote the exact sources. "
            "You must ONLY use the provided evidence. You must output the source URLs verbatim as passed in — "
            "never invent or modify a URL. Output strictly conforms to the JSON schema."
        )

        framing_instructions = ""
        if fit_tier_input == "strong":
            framing_instructions = (
                "The developer is a STRONG fit for this gap. Describe the gap and why the user's existing "
                "skills directly apply. Leave bridge_note as null. Output fit_tier as 'strong'."
            )
        else:
            framing_instructions = (
                "The developer is a STRETCH fit for this gap. Describe the gap, but explicitly name the delta "
                "between what's needed and what's in the user's current profile in the 'bridge_note' field, "
                "and give an honest read on whether it's closeable quickly. For example, 'requires X, you have Y, "
                "concepts transfer' vs 'requires deep Z with no adjacent signal, poor fit'. Do not force an "
                "optimistic spin if it doesn't fit well. Output fit_tier as 'stretch'."
            )

        user_prompt = (
            f"Cluster Topic: {cluster_label}\n\n"
            f"Developer Profile:\n{user_profile_text}\n\n"
            f"Evidence Items:\n{evidence_text}\n\n"
            f"Framing Instructions: {framing_instructions}\n"
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        attempt = 1
        max_attempts = 2

        async with httpx.AsyncClient() as client:
            while attempt <= max_attempts:
                try:
                    response = await client.post(
                        "https://openrouter.ai/api/v1/chat/completions",
                        headers={
                            "Authorization": f"Bearer {self._api_key}",
                            "Content-Type": "application/json",
                            "HTTP-Referer": "http://localhost:8000",
                            "X-Title": "SideDoor",
                        },
                        json={
                            "model": self._model_name,
                            "messages": messages,
                            "temperature": 0.0,
                            "response_format": {
                                "type": "json_schema",
                                "json_schema": {
                                    "name": "card_generation",
                                    "strict": True,
                                    "schema": SCHEMA_JSON
                                }
                            }
                        },
                        timeout=60.0
                    )
                    
                    if response.status_code != 200:
                        raise ValueError(f"OpenRouter API error: {response.status_code} - {response.text}")

                    data = response.json()
                    content = data["choices"][0]["message"]["content"]
                    
                    if not content:
                        raise ValueError("OpenRouter returned empty content.")

                    extracted = CardExtractionModel.model_validate_json(content)

                    # Validate URLs
                    for source in extracted.sources:
                        if source.url not in valid_urls:
                            raise ValidationError.from_exception_data(
                                title="URL Hallucination", 
                                line_errors=[
                                    {
                                        "type": "value_error", 
                                        "loc": ("sources", "url"), 
                                        "msg": f"Hallucinated URL: {source.url} not in original evidence", 
                                        "input": source.url
                                    }
                                ]
                            )

                    logger.info("Successfully generated card details via OpenRouter.")
                    return extracted

                except ValidationError as ve:
                    if attempt >= max_attempts:
                        logger.error("Card generation validation failed twice. Stopping.")
                        raise ValueError("CARD_GENERATION_FAILED") from ve
                    
                    logger.warning(f"Card generation validation failed on attempt {attempt}. Retrying.")
                    if 'content' in locals():
                        messages.append({"role": "assistant", "content": content})
                    messages.append({
                        "role": "user",
                        "content": f"Your previous response had invalid URLs (hallucinations) or structural errors. Fix and return valid JSON. Error:\n{str(ve)}"
                    })
                    attempt += 1

                except Exception as e:
                    if "CARD_GENERATION_FAILED" in str(e):
                        raise
                    if attempt >= max_attempts:
                        raise ValueError(f"Failed to generate card after {max_attempts} attempts: {e}") from e
                    attempt += 1
            
            raise ValueError("CARD_GENERATION_FAILED")
