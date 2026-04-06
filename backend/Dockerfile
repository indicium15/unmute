FROM python:3.11-slim

WORKDIR /app

# Install system dependencies needed for OpenCV and other packages
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy and install requirements
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source directly into /app
COPY . /app/

EXPOSE 8080

ENV PYTHONUNBUFFERED=1
ENV USE_GCS=true
ENV GCS_BUCKET_NAME=unmute-c9757-datasets

CMD ["python", "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]
