import os
import json
import base64
import io
from typing import List, Dict, Any, Optional

from websockets.asyncio.client import connect as ws_connect
from dotenv import load_dotenv
from openai import AzureOpenAI
from pydub import AudioSegment

from llm_client import LLMClient
from vocab import vocab

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

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

    def text_to_gloss(self, text: str, allowed_tokens: List[str] = None, language: Optional[str] = None) -> Dict[str, Any]:
        if allowed_tokens is None:
            allowed_tokens = vocab.get_allowed_tokens(text)

        if not self.client:
            return self._mock_response(text, allowed_tokens)

        token_str = ", ".join(allowed_tokens)

        if language:
            lang_name = self._lang_name(language)
            language_instructions = f"Input Language: {lang_name}. Translate from {lang_name} to SGSL Gloss."
        else:
            language_instructions = (
                "First detect the input language automatically (English, Chinese, Malay, Tamil, Hindi, etc.), "
                "then translate from the detected language to SGSL Gloss."
            )

        prompt = f"""You are a multilingual Singapore Sign Language (SGSL) translator.
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
            return result
        except Exception as e:
            print(f"Azure OpenAI Error (text_to_gloss): {e}")
            return {"gloss": [], "unmatched": [], "error": str(e)}

    def transcribe_audio(self, audio_base64: str, mime_type: str = "audio/webm", language: Optional[str] = None) -> Dict[str, Any]:
        import asyncio
        try:
            asyncio.get_running_loop()
        except RuntimeError:
            return asyncio.run(self.transcribe_audio_live(audio_base64, mime_type, language))

        # Called from within an already-running event loop (e.g. app.py's
        # fallback path) - run the coroutine on a dedicated thread/loop instead.
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(asyncio.run, self.transcribe_audio_live(audio_base64, mime_type, language))
            return future.result()

    async def transcribe_audio_live(self, audio_base64: str, mime_type: str = "audio/webm", language: Optional[str] = None) -> Dict[str, Any]:
        if not WHISPER_API_KEY or not WHISPER_ENDPOINT:
            return {"transcription": "", "error": "No API key - audio transcription requires Azure OpenAI (Whisper realtime)"}

        try:
            audio_bytes = base64.b64decode(audio_base64)
        except Exception as e:
            return {"transcription": "", "error": f"Failed to decode audio: {e}"}

        fmt = mime_type.split(';')[0].split('/')[-1] or "webm"
        try:
            segment = AudioSegment.from_file(io.BytesIO(audio_bytes), format=fmt)
            segment = segment.set_frame_rate(REALTIME_SAMPLE_RATE).set_channels(1).set_sample_width(2)
            pcm_b64 = base64.b64encode(segment.raw_data).decode()
        except Exception as e:
            return {"transcription": "", "error": f"Failed to decode audio: {e}"}

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

        result: Optional[Dict[str, Any]] = None
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
                        result = {"transcription": "", "error": event.get("error", {}).get("message", str(event))}
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
                            result = {
                                "transcription": event.get("transcript", ""),
                                "detected_language": language or "en",
                            }
                            raw_usage = event.get("usage")
                            if raw_usage:
                                result["usage"] = {
                                    "model": WHISPER_MODEL,
                                    "input_tokens": raw_usage.get("input_tokens"),
                                    "output_tokens": raw_usage.get("output_tokens"),
                                    "total_tokens": raw_usage.get("total_tokens"),
                                }
                            break
                        if event.get("type") == "conversation.item.input_audio_transcription.failed":
                            result = {"transcription": "", "error": event.get("error", {}).get("message", "Transcription failed")}
                            break
                        if event.get("type") == "error":
                            result = {"transcription": "", "error": event.get("error", {}).get("message", str(event))}
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
                return {"transcription": "", "error": str(e)}

        if result is not None:
            return result
        return {"transcription": "", "error": "Realtime session closed without a transcription result"}
