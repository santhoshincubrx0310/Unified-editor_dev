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