FROM python:3.11-slim

WORKDIR /app

# Install system dependencies needed for OpenCV and other packages
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install uv, then install Python dependencies into a project virtualenv.
COPY --from=ghcr.io/astral-sh/uv:0.9.17 /uv /uvx /bin/
COPY pyproject.toml uv.lock* /app/
RUN uv sync --frozen --no-dev

# Copy backend source directly into /app
COPY . /app/

EXPOSE 8080

ENV PYTHONUNBUFFERED=1
ENV PATH="/app/.venv/bin:$PATH"
ENV USE_GCS=true
ENV GCS_BUCKET_NAME=unmute-c9757-datasets

CMD ["sh", "-c", "exec uvicorn app:app --host 0.0.0.0 --port ${PORT:-8080}"]
