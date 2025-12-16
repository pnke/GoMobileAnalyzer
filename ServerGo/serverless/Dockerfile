# 1. NVIDIA CUDA Runtime (smaller than devel), pinned
ARG CUDA_VERSION=12.1.1
ARG UBUNTU_VER=22.04
FROM nvidia/cuda:${CUDA_VERSION}-cudnn8-runtime-ubuntu${UBUNTU_VER}

# Environment
ENV DEBIAN_FRONTEND=noninteractive \
  PYTHONUNBUFFERED=1 \
  PIP_DISABLE_PIP_VERSION_CHECK=1 \
  PIP_NO_CACHE_DIR=1

# 2. Minimal system packages and Python
RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates \
  wget \
  unzip \
  python3 \
  python3-pip \
  libzip4 \
  libbz2-1.0 \
  libgoogle-perftools4 \
  libgl1-mesa-glx \
  libglib2.0-0 \
  && rm -rf /var/lib/apt/lists/*

# Make `python` available
RUN ln -s /usr/bin/python3 /usr/bin/python

# 3. App dependencies (includes PyTorch for recognition)
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 4. KataGo - download pinned binary zip and default model
WORKDIR /katago
RUN wget https://github.com/lightvector/KataGo/releases/download/v1.16.3/katago-v1.16.3-cuda12.1-cudnn8.9.7-linux-x64.zip \
  && unzip katago-v1.16.3-cuda12.1-cudnn8.9.7-linux-x64.zip \
  && rm katago-v1.16.3-cuda12.1-cudnn8.9.7-linux-x64.zip
# Download pinned model
RUN wget https://media.katagotraining.org/uploaded/networks/models/kata1/kata1-b28c512nbt-s9584861952-d4960414494.bin.gz -O default_model.bin.gz

# 5. Copy application (new unified structure)
WORKDIR /app
COPY serverless/handler.py .
COPY core ./core
COPY services ./services
COPY config.py .
COPY logging_config.py .

# 6. Copy ML directory (models are optional, loaded dynamically)
# Will be empty if models not present - recognition gracefully degrades
RUN mkdir -p ./ml
COPY ml/ ./ml/

# 7. Non-root user and permissions
RUN useradd -m -u 10001 appuser \
  && chown -R appuser:appuser /app /katago
USER appuser

# 8. Healthcheck ensures KataGo binary is present
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD test -x /katago/katago || exit 1

# Start handler
CMD ["python", "-u", "handler.py"]
