from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

from vocab import vocab


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
    def text_to_gloss(self, text: str, allowed_tokens: List[str] = None, language: Optional[str] = None) -> Dict[str, Any]:
        """Translate text to SGSL gloss tokens."""
        ...

    @abstractmethod
    def transcribe_audio(self, audio_base64: str, mime_type: str = "audio/webm", language: Optional[str] = None) -> Dict[str, Any]:
        """Transcribe base64-encoded audio to text."""
        ...

    async def transcribe_audio_live(self, audio_base64: str, mime_type: str = "audio/webm", language: Optional[str] = None) -> Dict[str, Any]:
        """Async wrapper around transcribe_audio. Override for true async implementations."""
        import asyncio
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self.transcribe_audio, audio_base64, mime_type, language)

    def validate_gloss(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Filter gloss tokens to only those present in vocab."""
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

    def _mock_response(self, text: str, allowed_tokens: List[str]) -> Dict[str, Any]:
        """Keyword-matching fallback when no API key is configured."""
        words = text.upper().split()
        vocab_set = set(allowed_tokens)
        gloss, unmatched = [], []

        for w in words:
            clean = vocab.apply_aliases("".join(c for c in w if c.isalnum() or c == '_'))
            (gloss if clean in vocab_set else unmatched).append(clean if clean in vocab_set else w)

        return {"gloss": gloss, "unmatched": unmatched, "notes": "Mock response (no API key)"}

    def _lang_name(self, language: Optional[str]) -> Optional[str]:
        if not language:
            return None
        return self.LANG_MAP.get(language.lower(), language)
