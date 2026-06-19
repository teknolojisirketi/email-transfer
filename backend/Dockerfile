FROM python:3.12-slim-bookworm

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

RUN mkdir -p /data /logs

ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
