"""LLM provider clients (Azure GPT-5-mini text→gloss + Azure realtime Whisper
transcription, with a legacy OpenAI fallback), USD cost estimation for their
usage, and Firestore logging of that usage for the admin token-usage dashboard.
"""

import asyncio
import base64
import io
import json
import logging
import os
from abc import ABC, abstractmethod
from datetime import datetime, timedelta, timezone
from collections import defaultdict
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from openai import AzureOpenAI, OpenAI
from pydub import AudioSegment
from websockets.asyncio.client import connect as ws_connect

from models.auth import TokenUsageStats, UsageBucket, UsageDayBucket
from models.common import Usage
from models.translation import GlossResult, TranscriptionResult
from utils.dictionary import vocab
from utils.gcp import get_db

logger = logging.getLogger(__name__)

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))


# ── Abstract base ────────────────────────────────────────────────────────────

class LLMClient(ABC):
    """Abstract base for LLM provider implementations."""

    LANG_MAP = {
        'en': 'English',
        'zh': 'Chinese (Simplified or Traditional)',
        'zh-CN': 'Chinese (Simplified)',
        'zh-TW': 'Chinese (Traditional)',
        'ms': 'Malay',
        'ta': 'Tamil',
        'hi': 'Hindi',
        'es': 'Spanish',
        'fr': 'French',
        'de': 'German',
        'ja': 'Japanese',
        'ko': 'Korean',
    }

    @abstractmethod
    def text_to_gloss(self, text: str, allowed_tokens: List[str] = None, language: Optional[str] = None) -> GlossResult:
        """Translate text to SGSL gloss tokens."""
        ...

    @abstractmethod
    def transcribe_audio(self, audio_base64: str, mime_type: str = "audio/webm", language: Optional[str] = None) -> TranscriptionResult:
        """Transcribe base64-encoded audio to text."""
        ...

    async def transcribe_audio_live(self, audio_base64: str, mime_type: str = "audio/webm", language: Optional[str] = None) -> TranscriptionResult:
        """Async wrapper around transcribe_audio. Override for true async implementations."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self.transcribe_audio, audio_base64, mime_type, language)

    def validate_gloss(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Filter gloss tokens to only those present in vocab. Operates on the
        raw JSON dict parsed directly from the LLM response, before it's
        wrapped into a GlossResult.
        """
        raw_gloss = data.get("gloss", [])
        unmatched = list(data.get("unmatched", []))
        validated = []

        for token in raw_gloss:
            canon = vocab.apply_aliases(vocab.canon(token))
            if vocab.validate_token(canon):
                validated.append(canon)
            else:
                unmatched.append(token)

        data["gloss"] = validated
        data["unmatched"] = unmatched
        return data

    def _mock_response(self, text: str, allowed_tokens: List[str]) -> GlossResult:
        """Keyword-matching fallback when no API key is configured."""
        words = text.upper().split()
        vocab_set = set(allowed_tokens)
        gloss, unmatched = [], []

        for w in words:
            clean = vocab.apply_aliases("".join(c for c in w if c.isalnum() or c == '_'))
            (gloss if clean in vocab_set else unmatched).append(clean if clean in vocab_set else w)

        return GlossResult(gloss=gloss, unmatched=unmatched, notes="Mock response (no API key)")

    def _lang_name(self, language: Optional[str]) -> Optional[str]:
        if not language:
            return None
        return self.LANG_MAP.get(language.lower(), language)


def _gloss_prompt(text: str, language: Optional[str], allowed_tokens: List[str], lang_name_fn) -> str:
    token_str = ", ".join(allowed_tokens)

    if language:
        lang_name = lang_name_fn(language)
        language_instructions = f"Input Language: {lang_name}. Translate from {lang_name} to SGSL Gloss."
    else:
        language_instructions = (
            "First detect the input language automatically (English, Chinese, Malay, Tamil, Hindi, etc.), "
            "then translate from the detected language to SGSL Gloss."
        )

    return f"""You are a multilingual Singapore Sign Language (SGSL) translator.
Your task is to translate text from ANY language into SGSL Gloss tokens.
{language_instructions}

Important Constraints:
1. SGSL often uses Subject-Object-Verb (SOV) or Topic-Comment structure, different from English SVO.
2. You MUST use ONLY words from the provided vocabulary list below.
3. For words not in vocabulary, try synonyms (e.g., "MUM" -> "MOTHER", "Mama" -> "MOTHER").
4. Consider cultural context - SGSL reflects Singapore's multilingual environment.
5. For Chinese input: Consider tone and context; map to appropriate SGSL concepts.
6. For Malay/Tamil input: Translate meaningfully, not word-by-word.
7. If key concepts cannot be translated, include them in 'unmatched' array.
8. Preserve the semantic meaning and intent of the original text.

Vocabulary (use ONLY these tokens):
[{token_str}]

Input Text: "{text}"

Output JSON format strictly (no markdown, no code blocks):
{{
  "gloss": ["TOKEN1", "TOKEN2", ...],
  "unmatched": ["word1", ...],
  "notes": "Brief explanation of translation choices and detected language",
  "detected_language": "language code if auto-detected"
}}"""


# ── Azure OpenAI (default provider) ─────────────────────────────────────────

TEXT_MODEL = os.environ.get("AZURE_OPENAI_DEPLOYMENT", "gpt-5.4-mini")

# Audio transcription runs on a separate Azure resource that hosts the realtime
# transcription models (gpt-realtime-whisper is only reachable via the realtime
# websocket API, not the batch /audio/transcriptions REST endpoint).
# .strip() guards against trailing newlines in values injected from Secret
# Manager - a stray "\n" in the api-key header makes Azure drop the websocket
# right after the handshake with no close frame.
WHISPER_MODEL = os.environ.get("AZURE_WHISPER_DEPLOYMENT", "gpt-realtime-whisper").strip()
WHISPER_ENDPOINT = (os.environ.get("AZURE_WHISPER_ENDPOINT") or "").strip() or None
WHISPER_API_KEY = (os.environ.get("AZURE_WHISPER_OPENAI_API_KEY") or "").strip() or None
REALTIME_SAMPLE_RATE = 24000


class AzureOpenAIClient(LLMClient):
    def __init__(self, api_key: str = None):
        api_key = api_key or os.environ.get("AZURE_OPENAI_API_KEY")
        endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT")
        api_version = os.environ.get("AZURE_OPENAI_API_VERSION", "2025-04-01-preview")

        if api_key and endpoint:
            self.client = AzureOpenAI(
                api_key=api_key,
                azure_endpoint=endpoint,
                api_version=api_version,
            )
        else:
            print("Warning: AZURE_OPENAI_API_KEY/AZURE_OPENAI_ENDPOINT not set. Using mock mode.")
            self.client = None

    def text_to_gloss(self, text: str, allowed_tokens: List[str] = None, language: Optional[str] = None) -> GlossResult:
        if allowed_tokens is None:
            allowed_tokens = vocab.get_allowed_tokens(text)

        if not self.client:
            return self._mock_response(text, allowed_tokens)

        prompt = _gloss_prompt(text, language, allowed_tokens, self._lang_name)

        try:
            response = self.client.responses.create(
                model=TEXT_MODEL,
                input=prompt,
                text={"format": {"type": "json_object"}},
            )
            data = json.loads(response.output_text)
            result = self.validate_gloss(data)
            usage = getattr(response, "usage", None)
            if usage is not None:
                result["usage"] = {
                    "model": TEXT_MODEL,
                    "input_tokens": getattr(usage, "input_tokens", None),
                    "output_tokens": getattr(usage, "output_tokens", None),
                    "total_tokens": getattr(usage, "total_tokens", None),
                }
            return GlossResult(**result)
        except Exception as e:
            print(f"Azure OpenAI Error (text_to_gloss): {e}")
            return GlossResult(gloss=[], unmatched=[], error=str(e))

    def transcribe_audio(self, audio_base64: str, mime_type: str = "audio/webm", language: Optional[str] = None) -> TranscriptionResult:
        try:
            asyncio.get_running_loop()
        except RuntimeError:
            return asyncio.run(self.transcribe_audio_live(audio_base64, mime_type, language))

        # Called from within an already-running event loop (e.g. the FastAPI
        # route's fallback path) - run the coroutine on a dedicated thread/loop instead.
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(asyncio.run, self.transcribe_audio_live(audio_base64, mime_type, language))
            return future.result()

    async def transcribe_audio_live(self, audio_base64: str, mime_type: str = "audio/webm", language: Optional[str] = None) -> TranscriptionResult:
        if not WHISPER_API_KEY or not WHISPER_ENDPOINT:
            return TranscriptionResult(transcription="", error="No API key - audio transcription requires Azure OpenAI (Whisper realtime)")

        try:
            audio_bytes = base64.b64decode(audio_base64)
        except Exception as e:
            return TranscriptionResult(transcription="", error=f"Failed to decode audio: {e}")

        fmt = mime_type.split(';')[0].split('/')[-1] or "webm"
        try:
            segment = AudioSegment.from_file(io.BytesIO(audio_bytes), format=fmt)
            segment = segment.set_frame_rate(REALTIME_SAMPLE_RATE).set_channels(1).set_sample_width(2)
            pcm_b64 = base64.b64encode(segment.raw_data).decode()
            # gpt-realtime-whisper bills by audio duration, not tokens, so this
            # is what pricing needs to estimate cost for this request.
            audio_seconds = segment.duration_seconds
        except Exception as e:
            return TranscriptionResult(transcription="", error=f"Failed to decode audio: {e}")

        transcription_config: Dict[str, Any] = {"model": WHISPER_MODEL}
        if language:
            transcription_config["language"] = language.split('-')[0].lower()

        session_update = {
            "type": "session.update",
            "session": {
                "type": "transcription",
                "audio": {
                    "input": {
                        "format": {"type": "audio/pcm", "rate": REALTIME_SAMPLE_RATE},
                        "turn_detection": None,
                        "transcription": transcription_config,
                    },
                },
            },
        }

        url = f"{WHISPER_ENDPOINT.rstrip('/')}/realtime?intent=transcription".replace("https://", "wss://", 1)
        headers = {"api-key": WHISPER_API_KEY}

        result: Optional[TranscriptionResult] = None
        stage = "connect"
        try:
            async with ws_connect(url, additional_headers=headers) as ws:
                stage = "session.update"
                await ws.send(json.dumps(session_update))
                async for raw_message in ws:
                    event = json.loads(raw_message)
                    if event.get("type") == "session.updated":
                        break
                    if event.get("type") == "error":
                        result = TranscriptionResult(transcription="", error=event.get("error", {}).get("message", str(event)))
                        break

                if result is None:
                    stage = "input_audio_buffer.append"
                    await ws.send(json.dumps({"type": "input_audio_buffer.append", "audio": pcm_b64}))
                    stage = "input_audio_buffer.commit"
                    await ws.send(json.dumps({"type": "input_audio_buffer.commit"}))

                    stage = "waiting for events"
                    async for raw_message in ws:
                        event = json.loads(raw_message)
                        if event.get("type") == "conversation.item.input_audio_transcription.completed":
                            raw_usage = event.get("usage") or {}
                            # Always attach usage (pricing is duration-based, so
                            # this is needed even when the API omits token counts).
                            result = TranscriptionResult(
                                transcription=event.get("transcript", ""),
                                detected_language=language or "en",
                                usage=Usage(
                                    model=WHISPER_MODEL,
                                    input_tokens=raw_usage.get("input_tokens"),
                                    output_tokens=raw_usage.get("output_tokens"),
                                    total_tokens=raw_usage.get("total_tokens"),
                                    audio_seconds=audio_seconds,
                                ),
                            )
                            break
                        if event.get("type") == "conversation.item.input_audio_transcription.failed":
                            result = TranscriptionResult(transcription="", error=event.get("error", {}).get("message", "Transcription failed"))
                            break
                        if event.get("type") == "error":
                            result = TranscriptionResult(transcription="", error=event.get("error", {}).get("message", str(event)))
                            break
                stage = "closing connection"
                # Azure tears down the realtime socket right after emitting the
                # terminal event instead of completing a clean close handshake,
                # so exiting this block can raise ConnectionClosedError even
                # though we already have our answer - that's handled below.
        except Exception as e:
            if result is not None:
                # We already got a transcript/failure event; the exception only
                # happened while tearing down the websocket, so ignore it.
                pass
            else:
                print(f"Azure OpenAI Error (transcribe_audio realtime) at stage '{stage}': {type(e).__name__}: {e}")
                response = getattr(e, "response", None)
                if response is not None:
                    try:
                        print(f"Azure realtime handshake response headers: {dict(response.headers)}")
                        print(f"Azure realtime handshake response body: {response.body}")
                    except Exception as log_err:
                        print(f"Failed to log handshake response detail: {log_err}")
                return TranscriptionResult(transcription="", error=str(e))

        if result is not None:
            return result
        return TranscriptionResult(transcription="", error="Realtime session closed without a transcription result")


# ── Legacy/fallback OpenAI provider ─────────────────────────────────────────

OPENAI_TEXT_MODEL = "gpt-4o-mini"
OPENAI_AUDIO_MODEL = "whisper-1"


class OpenAIClient(LLMClient):
    def __init__(self, api_key: str = None):
        api_key = api_key or os.environ.get("OPENAI_API_KEY")
        if api_key:
            self.client = OpenAI(api_key=api_key)
        else:
            print("Warning: OPENAI_API_KEY not set. Using mock mode.")
            self.client = None

    def text_to_gloss(self, text: str, allowed_tokens: List[str] = None, language: Optional[str] = None) -> GlossResult:
        if allowed_tokens is None:
            allowed_tokens = vocab.get_allowed_tokens(text)

        if not self.client:
            return self._mock_response(text, allowed_tokens)

        prompt = _gloss_prompt(text, language, allowed_tokens, self._lang_name)

        try:
            response = self.client.chat.completions.create(
                model=OPENAI_TEXT_MODEL,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.1,
            )
            data = json.loads(response.choices[0].message.content)
            return GlossResult(**self.validate_gloss(data))
        except Exception as e:
            print(f"OpenAI Error (text_to_gloss): {e}")
            return GlossResult(gloss=[], unmatched=[], error=str(e))

    def transcribe_audio(self, audio_base64: str, mime_type: str = "audio/webm", language: Optional[str] = None) -> TranscriptionResult:
        if not self.client:
            return TranscriptionResult(transcription="", error="No API key - audio transcription requires OpenAI API")

        try:
            audio_bytes = base64.b64decode(audio_base64)
        except Exception as e:
            return TranscriptionResult(transcription="", error=f"Failed to decode audio: {e}")

        # whisper-1 accepts: flac, m4a, mp3, mp4, mpeg, mpga, oga, ogg, wav, webm
        ext = mime_type.split(';')[0].split('/')[-1]
        if ext not in ('flac', 'm4a', 'mp3', 'mp4', 'mpeg', 'mpga', 'oga', 'ogg', 'wav', 'webm'):
            ext = 'webm'
        filename = f"audio.{ext}"

        try:
            kwargs: Dict[str, Any] = {
                "model": OPENAI_AUDIO_MODEL,
                "file": (filename, io.BytesIO(audio_bytes), mime_type.split(';')[0]),
                "response_format": "verbose_json",
            }
            # whisper-1 only accepts ISO 639-1 codes, not full names
            if language:
                iso = language.split('-')[0].lower()
                kwargs["language"] = iso

            transcript = self.client.audio.transcriptions.create(**kwargs)
            detected = getattr(transcript, 'language', None) or language or 'en'
            return TranscriptionResult(transcription=transcript.text, detected_language=detected)
        except Exception as e:
            print(f"OpenAI Error (transcribe_audio): {e}")
            return TranscriptionResult(transcription="", error=str(e))


# ── Client factory / singleton ──────────────────────────────────────────────

def _build_llm_client() -> LLMClient:
    provider = os.environ.get("LLM_PROVIDER", "azure").lower()
    if provider == "openai":
        return OpenAIClient()
    return AzureOpenAIClient()


llm_client = _build_llm_client()


# ── Pricing (Azure OpenAI USD cost estimation) ──────────────────────────────
# Azure doesn't expose a usage/billing API we can query, so these rates are
# manually maintained from the Azure OpenAI pricing sheet and must be updated
# by hand if the underlying deployment or its listed price changes. Keys must
# match the deployment name reported in each request's ``model`` field
# (``AZURE_OPENAI_DEPLOYMENT`` / ``AZURE_WHISPER_DEPLOYMENT``), not the
# underlying model family, since that's what actually gets billed.

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


# ── Token-usage Firestore logging (admin dashboard) ─────────────────────────

def log_token_usage(endpoint: str, usage: Usage) -> Optional[str]:
    """Persist an LLM token usage reading to the *token_usage_logs* collection.

    We don't have direct access to the Azure OpenAI usage/billing dashboard, so
    this is our own approximation built from per-request usage figures returned
    inline by the API (or, for the realtime Whisper endpoint, by the transcription
    completion event).
    """
    db = get_db()
    if db is None:
        logger.warning("[DB] Firestore unavailable – skipping token usage log")
        return None

    try:
        input_tokens = usage.input_tokens or 0
        output_tokens = usage.output_tokens or 0
        total_tokens = usage.total_tokens or (input_tokens + output_tokens)
        audio_seconds = usage.audio_seconds or 0

        doc_ref = db.collection("token_usage_logs").document()
        doc_ref.set({
            "timestamp": datetime.now(timezone.utc),
            "endpoint": endpoint,
            "model": usage.model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": total_tokens,
            "audio_seconds": audio_seconds,
        })
        return doc_ref.id
    except Exception as exc:
        logger.error("[DB] Failed to log token usage: %s", exc)
        return None


def get_token_usage_stats() -> TokenUsageStats:
    """Return aggregate LLM token usage for the admin dashboard, bucketed by day
    over the last 30 days and split by endpoint (translate vs transcribe).
    """
    empty = TokenUsageStats(
        total_input_tokens=0, total_output_tokens=0, total_tokens=0,
        total_cost_usd=0.0, by_endpoint={}, usage_by_day=[],
    )
    db = get_db()
    if db is None:
        return empty

    def _bucket():
        return {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0, "cost_usd": 0.0}

    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=30)
        docs = list(
            db.collection("token_usage_logs")
            .where("timestamp", ">=", cutoff)
            .stream()
        )

        by_day: dict[str, dict[str, float]] = defaultdict(_bucket)
        by_endpoint: dict[str, dict[str, float]] = defaultdict(_bucket)
        total_input = total_output = total_all = 0
        total_cost = 0.0

        for doc in docs:
            data = doc.to_dict()
            ts = data.get("timestamp")
            input_tokens = data.get("input_tokens", 0) or 0
            output_tokens = data.get("output_tokens", 0) or 0
            total_tokens = data.get("total_tokens", 0) or 0
            audio_seconds = data.get("audio_seconds", 0) or 0
            endpoint = data.get("endpoint", "unknown")
            # Computed from the current pricing rates rather than stored at
            # write time, so this reflects the latest known pricing even for
            # older log entries (this is an approximation tool, not an invoice).
            cost = estimate_cost_usd(data.get("model"), input_tokens, output_tokens, audio_seconds) or 0.0

            total_input += input_tokens
            total_output += output_tokens
            total_all += total_tokens
            total_cost += cost

            by_endpoint[endpoint]["input_tokens"] += input_tokens
            by_endpoint[endpoint]["output_tokens"] += output_tokens
            by_endpoint[endpoint]["total_tokens"] += total_tokens
            by_endpoint[endpoint]["cost_usd"] += cost

            if ts:
                day = ts[:10] if isinstance(ts, str) else ts.date().isoformat()
                by_day[day]["input_tokens"] += input_tokens
                by_day[day]["output_tokens"] += output_tokens
                by_day[day]["total_tokens"] += total_tokens
                by_day[day]["cost_usd"] += cost

        today = datetime.now(timezone.utc).date()
        usage_by_day = []
        for i in range(29, -1, -1):
            day = (today - timedelta(days=i)).isoformat()
            bucket = by_day.get(day, _bucket())
            usage_by_day.append(UsageDayBucket(date=day, **{**bucket, "cost_usd": round(bucket["cost_usd"], 4)}))

        return TokenUsageStats(
            total_input_tokens=total_input,
            total_output_tokens=total_output,
            total_tokens=total_all,
            total_cost_usd=round(total_cost, 4),
            by_endpoint={k: UsageBucket(**{**v, "cost_usd": round(v["cost_usd"], 4)}) for k, v in by_endpoint.items()},
            usage_by_day=usage_by_day,
        )
    except Exception as exc:
        logger.error("[DB] Failed to get token usage stats: %s", exc)
        return empty
