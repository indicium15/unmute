import os
import json
import base64
import io
from typing import List, Dict, Any, Optional

from dotenv import load_dotenv
from openai import AzureOpenAI

from llm_client import LLMClient
from vocab import vocab

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

TEXT_MODEL = os.environ.get("AZURE_OPENAI_DEPLOYMENT", "gpt-5.4-mini")
AUDIO_MODEL = os.environ.get("AZURE_OPENAI_WHISPER_DEPLOYMENT", "whisper-1")


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
            return self.validate_gloss(data)
        except Exception as e:
            print(f"Azure OpenAI Error (text_to_gloss): {e}")
            return {"gloss": [], "unmatched": [], "error": str(e)}

    def transcribe_audio(self, audio_base64: str, mime_type: str = "audio/webm", language: Optional[str] = None) -> Dict[str, Any]:
        if not self.client:
            return {"transcription": "", "error": "No API key - audio transcription requires Azure OpenAI"}

        try:
            audio_bytes = base64.b64decode(audio_base64)
        except Exception as e:
            return {"transcription": "", "error": f"Failed to decode audio: {e}"}

        ext = mime_type.split(';')[0].split('/')[-1]
        if ext not in ('flac', 'm4a', 'mp3', 'mp4', 'mpeg', 'mpga', 'oga', 'ogg', 'wav', 'webm'):
            ext = 'webm'
        filename = f"audio.{ext}"

        try:
            kwargs: Dict[str, Any] = {
                "model": AUDIO_MODEL,
                "file": (filename, io.BytesIO(audio_bytes), mime_type.split(';')[0]),
                "response_format": "verbose_json",
            }
            if language:
                kwargs["language"] = language.split('-')[0].lower()

            transcript = self.client.audio.transcriptions.create(**kwargs)
            detected = getattr(transcript, 'language', None) or language or 'en'
            return {
                "transcription": transcript.text,
                "detected_language": detected,
            }
        except Exception as e:
            print(f"Azure OpenAI Error (transcribe_audio): {e}")
            return {"transcription": "", "error": str(e)}
