from typing import Optional

from pydantic import BaseModel


class Usage(BaseModel):
    model: Optional[str] = None
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    total_tokens: Optional[int] = None
    audio_seconds: Optional[float] = None
