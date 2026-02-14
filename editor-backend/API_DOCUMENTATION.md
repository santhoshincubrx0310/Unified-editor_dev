# Unified Editor API Documentation

Base URL:
http://localhost:8083/api/v1

Authentication:
X-User-ID header required

---

## Health Check

GET /health

Response:
{
  "status": "ok"
}

---

## Create Session

POST /sessions

Headers:
X-User-ID: uuid

Body:
{
  "content_id": "uuid"
}

Response:
{
  "session_id": "uuid",
  "timeline": {},
  "version": 1
}

---

## Get Session

GET /sessions/{session_id}

Headers:
X-User-ID: uuid

---

## Save Session

PUT /sessions/{session_id}

Headers:
X-User-ID: uuid

Body:
{
  "timeline": {}
}

Response:
{
  "status": "saved"
}

---

## Delete Session

DELETE /sessions/{session_id}

Headers:
X-User-ID: uuid

Response:
{
  "status": "deleted"
}

---

## Upload File

POST /upload

Headers:
X-User-ID: uuid

Body:
multipart/form-data
file: video/audio

Response:
{
  "file_url": ""
}

---

## Create Session From Clip

POST /sessions/from-clip

Headers:
X-User-ID: uuid

Body:
{
  "clip_id": "",
  "clip_url": "",
  "duration": 30
}

Response:
{
  "session_id": "",
  "timeline": {}
}
