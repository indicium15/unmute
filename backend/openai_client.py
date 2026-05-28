import os
import json
import base64
import io
from typing import List, Dict, Any, Optional

from dotenv import load_dotenv
from openai import OpenAI

from llm_client import LLMClient
from vocab import vocab

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

TEXT_MODEL = "gpt-4o-mini"
AUDIO_MODEL = "whisper-1"


class OpenAIClient(LLMClient):
    def __init__(self, api_key: str = None):
        api_key = api_key or os.environ.get("OPENAI_API_KEY")
        if api_key:
            self.client = OpenAI(api_key=api_key)
        else:
            print("Warning: OPENAI_API_KEY not set. Using mock mode.")
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
            response = self.client.chat.completions.create(
                model=TEXT_MODEL,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.1,
            )
            data = json.loads(response.choices[0].message.content)
            return self.validate_gloss(data)
        except Exception as e:
            print(f"OpenAI Error (text_to_gloss): {e}")
            return {"gloss": [], "unmatched": [], "error": str(e)}

    def transcribe_audio(self, audio_base64: str, mime_type: str = "audio/webm", language: Optional[str] = None) -> Dict[str, Any]:
        if not self.client:
            return {"transcription": "", "error": "No API key - audio transcription requires OpenAI API"}

        try:
            audio_bytes = base64.b64decode(audio_base64)
        except Exception as e:
            return {"transcription": "", "error": f"Failed to decode audio: {e}"}

        # whisper-1 accepts: flac, m4a, mp3, mp4, mpeg, mpga, oga, ogg, wav, webm
        ext = mime_type.split(';')[0].split('/')[-1]
        if ext not in ('flac', 'm4a', 'mp3', 'mp4', 'mpeg', 'mpga', 'oga', 'ogg', 'wav', 'webm'):
            ext = 'webm'
        filename = f"audio.{ext}"

        whisper_lang = self._lang_name(language)

        try:
            kwargs: Dict[str, Any] = {
                "model": AUDIO_MODEL,
                "file": (filename, io.BytesIO(audio_bytes), mime_type.split(';')[0]),
                "response_format": "verbose_json",
            }
            # whisper-1 only accepts ISO 639-1 codes, not full names
            if language:
                iso = language.split('-')[0].lower()
                kwargs["language"] = iso

            transcript = self.client.audio.transcriptions.create(**kwargs)
            detected = getattr(transcript, 'language', None) or language or 'en'
            return {
                "transcription": transcript.text,
                "detected_language": detected,
            }
        except Exception as e:
            print(f"OpenAI Error (transcribe_audio): {e}")
            return {"transcription": "", "error": str(e)}
