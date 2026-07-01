FROM python:3.12-slim

WORKDIR /app

# Install system dependencies (yt-dlp needs ffmpeg)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

RUN groupadd --system sentimenta && useradd --system --gid sentimenta --home /app sentimenta

# Copy source code
COPY --chown=sentimenta:sentimenta backend/ /app/backend/
COPY --chown=sentimenta:sentimenta src/ /app/src/
RUN mkdir -p /app/output && chown -R sentimenta:sentimenta /app

USER sentimenta

EXPOSE 8000
