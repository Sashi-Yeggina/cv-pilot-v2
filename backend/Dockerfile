FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Don't bundle .env — secrets come from Railway environment variables
RUN rm -f .env

# Expose default port
EXPOSE 8000

# Shell form so $PORT is expanded by the shell at runtime
CMD uvicorn main:app --host 0.0.0.0 --port $PORT
