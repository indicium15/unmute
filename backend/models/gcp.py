from pydantic import BaseModel


class DatasetInfo(BaseModel):
    bucket_name: str
    public_url: str
