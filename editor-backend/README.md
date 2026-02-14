# Unified Content Editor

A professional video/audio editing module for content creation platforms.

## 🎯 Features

- Multi-track timeline editor (video, audio, text)
- Drag & drop clip management
- Real-time preview with synchronized playback
- Text overlays with styling
- Clip splitting and trimming
- Auto-save functionality
- Session persistence

## 📋 Prerequisites

- **Node.js** v18+ (for frontend)
- **Go** 1.21+ (for backend)
- **PostgreSQL** 14+
- **FFmpeg** (optional, for video processing)

## 🚀 Local Development Setup

### 1. Clone Repository
```bash
git clone 
cd unified-content-editor
```

### 2. Backend Setup
```bash
cd editor-backend

# Install dependencies
go mod download

# Create .env file
cp .env.example .env

# Edit .env with your database credentials
# DATABASE_URL=postgres://user:pass@localhost:5432/dbname?sslmode=disable

# Run database migrations (if any)
# psql -d your_database -f migrations/001_create_tables.sql

# Start backend server
go run cmd/api/main.go
```

Backend will run on `http://localhost:8083`

### 3. Frontend Setup
```bash
cd editor-ui

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env
# VITE_API_URL=http://localhost:8083/api/v1

# Start development server
npm run dev
```

Frontend will run on `http://localhost:5173`

### 4. Test the Application

1. Open browser: `http://localhost:5173`
2. Click "+ Video Track" to add a video track
3. Upload a video file
4. Edit, save, and test functionality

## 🗄️ Database Setup

### Production Table
```sql
CREATE TABLE editor_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    content_id UUID NOT NULL,
    timeline JSONB NOT NULL DEFAULT '{"tracks": [], "duration": 120}',
    version INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_editor_sessions_user_created ON editor_sessions(user_id, created_at DESC);
CREATE INDEX idx_editor_sessions_content ON editor_sessions(content_id);
```

# Unified Editor - Integration Requirements

## Authentication

The editor module does NOT handle authentication. It expects the parent 
product's API Gateway to inject the user identity.

### Required Header

All requests to the editor backend MUST include:
```
X-User-ID: <user-uuid>
```

This header should be injected by the API Gateway after validating the 
user's JWT token.

### Security Model
```
Browser → API Gateway → Editor Backend
            ↓
       Validates JWT
       Extracts user_id
       Injects X-User-ID header
```

The editor backend TRUSTS the X-User-ID header because requests can only 
come from the API Gateway, not directly from browsers.

### Integration Steps

1. **Frontend calls editor with auth token:**
```javascript
   fetch('https://api.yourcompany.com/editor/sessions', {
     headers: {
       'Authorization': 'Bearer ' + userToken,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({ content_id: '...' })
   })
```

2. **Gateway extracts user_id from JWT and forwards:**
```
   POST http://editor-backend:8083/api/v1/sessions
   Headers:
     X-User-ID: <extracted-from-jwt>
     Content-Type: application/json
```

3. **Editor creates session with correct user:**
```sql
   INSERT INTO editor_sessions (user_id, content_id, ...)
   VALUES (, , ...)
```

### Development Mode

For local development without the gateway:
```javascript
// Hardcoded dev user for testing
headers: {
  'X-User-ID': '11111111-1111-1111-1111-111111111111'
}
```