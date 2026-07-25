"""USD pricing for the LLM deployments this app calls.

Azure doesn't expose a usage/billing API we can query, so these rates are
manually maintained from the Azure OpenAI pricing sheet and must be updated
by hand if the underlying deployment or its listed price changes. Keys must
match the deployment name reported in each request's ``model`` field
(``AZURE_OPENAI_DEPLOYMENT`` / ``AZURE_WHISPER_DEPLOYMENT``), not the
underlying model family, since that's what actually gets billed.
"""

from typing import Optional

# Token-metered models: USD per 1,000,000 tokens.
TOKEN_PRICING = {
    "gpt-5.4-mini": {"input_per_million": 0.75, "output_per_million": 4.50},
}

# Duration-metered models: USD per hour of audio processed. The realtime
# Whisper transcription deployment bills by audio duration, not tokens.
DURATION_PRICING = {
    "gpt-realtime-whisper": {"per_hour": 1.02},
}


def estimate_cost_usd(
    model: Optional[str],
    input_tokens: int = 0,
    output_tokens: int = 0,
    audio_seconds: float = 0,
) -> Optional[float]:
    """Estimate USD cost for one request. Returns None if the model has no
    known pricing (e.g. it was renamed/retired since the request was logged).
    """
    if model in TOKEN_PRICING:
        rates = TOKEN_PRICING[model]
        return (
            (input_tokens / 1_000_000) * rates["input_per_million"]
            + (output_tokens / 1_000_000) * rates["output_per_million"]
        )
    if model in DURATION_PRICING:
        rates = DURATION_PRICING[model]
        return (audio_seconds / 3600) * rates["per_hour"]
    return None
