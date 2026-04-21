# Use official Python 3.11 lightweight image
FROM python:3.11-slim

# Set working directory inside the container
WORKDIR /app

# Upgrade pip
RUN pip install --no-cache-dir --upgrade pip

# Copy only requirements first to leverage Docker cache
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend files
COPY . .

# Expose the port FastAPI runs on
EXPOSE 8000

# Start command
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
