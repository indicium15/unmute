from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from routers import auth, dictionary, lessons, translation
from utils.dictionary import vocab
from utils.gcp import get_dataset_info
from utils.rate_limit import limiter

app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Retry-After"],
)

app.include_router(auth.router)
app.include_router(translation.router)
app.include_router(lessons.router)
app.include_router(dictionary.router)

@app.get("/health")
def health():
    storage_info = get_dataset_info()
    return {
        "status": "ok",
        "vocab_size": len(vocab.get_allowed_tokens()),
        "storage": storage_info,
    }
