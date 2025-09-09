FROM python:3.9-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libglib2.0-0 \
    libgtk-3-dev \
    python3-tk \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libfontconfig1 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY tracking_test/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY tracking_test/ ./tracking_test/
COPY supervision/ ./supervision/

# Install supervision from local directory
RUN cd supervision && pip install -e .

# Set environment variables
ENV PYTHONPATH=/app
ENV DISPLAY=:0

# Create directories for input/output
RUN mkdir -p /app/data/input /app/data/output

# Default command
CMD ["python", "tracking_test/zone_tracker.py", "--help"]