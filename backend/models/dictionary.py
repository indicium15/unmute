from typing import Dict, List, Optional

from pydantic import BaseModel


class VocabPayload(BaseModel):
    token_to_sign: Dict[str, str] = {}
    aliases: Dict[str, str] = {}


class SignVariant(BaseModel):
    sign_name: Optional[str] = None
    variant_label: Optional[str] = None
    gif_url: str


class SignUnit(BaseModel):
    step: Optional[str] = None
    image_url: str


class SignDetail(BaseModel):
    token: str
    sign_name: Optional[str] = None
    gif_url: str
    description: Optional[str] = None
    visual_guide: Optional[str] = None
    translation_equivalents: Optional[str] = None
    parameters: Dict[str, Dict[str, str]] = {}
    units: List[SignUnit] = []
    variants: List[SignVariant] = []
