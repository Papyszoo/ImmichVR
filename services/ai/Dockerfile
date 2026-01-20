FROM python:3.11-slim

WORKDIR /app

# Install system dependencies including git for ml-sharp and FFmpeg for video processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    wget \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for caching
COPY requirements.txt .

# Install Python dependencies
# Using --no-cache-dir to reduce image size
RUN pip install --no-cache-dir -r requirements.txt

# Install ml-sharp from GitHub (Apple's Gaussian Splatting model)
RUN pip install --no-cache-dir git+https://github.com/apple/ml-sharp.git

# Copy application code
COPY . .

ENV PYTORCH_CUDA_ALLOC_CONF=garbage_collection_threshold:0.6,max_split_size_mb:128

# Expose port
EXPOSE 5000

# Run with gunicorn for production
# Increased timeout to 600s for splat generation which can take ~1-2 minutes
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "1", "--threads", "2", "--timeout", "600", "run:app"]

