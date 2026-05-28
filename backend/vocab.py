import json
import os
from typing import Dict, List, Optional

from gcs_storage import read_json, USE_GCS

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
VOCAB_PATH = os.path.join(PROJECT_ROOT, "sgsl_processed", "vocab.json")
SIGNS_METADATA_PATH = os.path.join(PROJECT_ROOT, "sgsl_processed", "signs_metadata.json")
ALIASES_PATH = os.path.join(BACKEND_DIR, "aliases.json")

GCS_VOCAB_PATH = "sgsl_processed/vocab.json"
GCS_SIGNS_METADATA_PATH = "sgsl_processed/signs_metadata.json"

class VocabLoader:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(VocabLoader, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self.token_to_sign: Dict[str, str] = {}
        self.sign_to_token: Dict[str, str] = {}
        self.aliases: Dict[str, str] = {}
        self.signs_metadata: Dict[str, dict] = {}
        self.allowed_tokens_list: List[str] = []
        self._load_data()

    def _load_data(self):
        # Load vocab
        data = None
        if USE_GCS:
            print(f"[Vocab] Loading from GCS: {GCS_VOCAB_PATH}")
            data = read_json(GCS_VOCAB_PATH)
        elif os.path.exists(VOCAB_PATH):
            print(f"[Vocab] Loading from local: {VOCAB_PATH}")
            with open(VOCAB_PATH, 'r', encoding='utf-8') as f:
                data = json.load(f)

        if data:
            if "token_to_sign" in data:
                self.token_to_sign = data["token_to_sign"]
            else:
                self.token_to_sign = data
            self.sign_to_token = {v: k for k, v in self.token_to_sign.items()}
            self.allowed_tokens_list = list(self.token_to_sign.keys())
            print(f"[Vocab] Loaded {len(self.token_to_sign)} tokens")
        else:
            print(f"Warning: Vocab file not found at {VOCAB_PATH} or GCS")

        # Load signs_metadata
        smd = None
        if USE_GCS:
            smd = read_json(GCS_SIGNS_METADATA_PATH)
        elif os.path.exists(SIGNS_METADATA_PATH):
            with open(SIGNS_METADATA_PATH, 'r', encoding='utf-8') as f:
                smd = json.load(f)
        if smd:
            self.signs_metadata = smd
            print(f"[Vocab] Loaded signs_metadata for {len(smd)} signs")

        # Load aliases
        if os.path.exists(ALIASES_PATH):
            with open(ALIASES_PATH, 'r', encoding='utf-8') as f:
                self.aliases = json.load(f)

    def canon(self, text: str) -> str:
        if not text:
            return ""
        return text.strip().upper()

    def apply_aliases(self, token: str) -> str:
        token = self.canon(token)
        return self.aliases.get(token, token)

    def token_to_video_name(self, token: str) -> Optional[str]:
        """Get the base sign folder name for a gloss token."""
        token = self.apply_aliases(token)
        return self.token_to_sign.get(token)

    def get_variants(self, token: str) -> List[dict]:
        """Return variant list for a token: [{"label": ..., "gif_filename": ...}, ...]"""
        token = self.apply_aliases(token)
        sign_name = self.token_to_sign.get(token)
        if not sign_name:
            return []
        return self.signs_metadata.get(sign_name, {}).get("variants", [])

    def video_name_to_token(self, sign_name: str) -> Optional[str]:
        return self.sign_to_token.get(sign_name)

    def get_allowed_tokens(self, text_context: str = "") -> List[str]:
        return self.allowed_tokens_list

    def validate_token(self, token: str) -> bool:
        token = self.apply_aliases(token)
        return token in self.token_to_sign

# Global instance for easy import
vocab = VocabLoader()
