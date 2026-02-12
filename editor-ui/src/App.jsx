// src/App.jsx
//
// As a module of the parent product, this component receives contentId as a prop:
//   <App contentId="uuid-from-parent-product" />
//
// The parent product handles user auth — user identity flows through the API gateway
// as X-User-ID header, so this component never needs to know WHO the user is.
//
// Development: set VITE_DEV_CONTENT_ID in your .env file
// Production:  parent product passes contentId prop

import { useState, useEffect, useRef } from "react"
import Timeline from "./components/editor/Timeline"
import CompositePreview from "./components/editor/CompositePreview"
import TextPropertiesPanel from "./components/editor/TextPropertiesPanel"
import { useEditorStore } from "./store/editorStore"
import {
  createSession,
  saveSession,
  deleteSession,
} from "./api/sessionApi"

function App({ contentId }) {
  useEffect(() => {
    window.editorStore = useEditorStore
  }, [])

  const addTrack = useEditorStore((s) => s.addTrack)
  const addClip = useEditorStore((s) => s.addClip)
  const deleteClip = useEditorStore((s) => s.deleteClip)
  const splitClip = useEditorStore((s) => s.splitClip)
  const timeline = useEditorStore((s) => s.timeline)
  const zoomIn = useEditorStore((s) => s.zoomIn)
  const zoomOut = useEditorStore((s) => s.zoomOut)

  const [sessionId, setSessionId] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [initError, setInitError] = useState(null)

  const [dividerPosition, setDividerPosition] = useState(350)
  const [dragging, setDragging] = useState(false)

  const videoInputRef = useRef(null)
  const audioInputRef = useRef(null)
  const [pendingTrack, setPendingTrack] = useState(null)

  const startDrag = () => setDragging(true)
  const stopDrag = () => setDragging(false)

  useEffect(() => {
    const move = (e) => {
      if (!dragging) return
      setDividerPosition(e.clientY)
    }
    window.addEventListener("mousemove", move)
    window.addEventListener("mouseup", stopDrag)
    return () => {
      window.removeEventListener("mousemove", move)
      window.removeEventListener("mouseup", stopDrag)
    }
  }, [dragging])

  // ── Session init — NO more hardcoded IDs ──────────────────────────────────
  useEffect(() => {
    async function init() {
      // Priority:
      //   1. contentId prop       ← parent product passes this in production
      //   2. VITE_DEV_CONTENT_ID  ← you set this in .env for local dev
      const resolvedContentId = contentId || import.meta.env.VITE_DEV_CONTENT_ID

      if (!resolvedContentId) {
        setInitError(
          "No content_id found. Either pass contentId as a prop " +
          "or add VITE_DEV_CONTENT_ID=<your-uuid> to your .env file."
        )
        return
      }

      try {
        // Only content_id goes in the body now.
        // user_id comes from X-User-ID header injected by the API gateway.
        // Backend uses FindOrCreate — refreshing returns the SAME session,
        // not a new one. No more orphaned rows.
        const session = await createSession(resolvedContentId)
        setSessionId(session.session_id)
      } catch (error) {
        console.error("Failed to create session:", error)
        setInitError("Failed to connect to editor backend.")
      }
    }
    init()
  }, [contentId])

  useEffect(() => {
    if (!sessionId) return
    const interval = setInterval(async () => {
      try {
        setIsSaving(true)
        await saveSession(sessionId, timeline)
      } catch (error) {
        console.error("Auto-save failed:", error)
      } finally {
        setIsSaving(false)
      }
    }, 10000)
    return () => clearInterval(interval)
  }, [timeline, sessionId])

  const handleSave = async () => {
    if (!sessionId) return
    setIsSaving(true)
    try {
      await saveSession(sessionId, timeline)
    } catch (error) {
      console.error("Save failed:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteSession = async () => {
    if (!sessionId) return
    try {
      await deleteSession(sessionId)
      setSessionId(null)
    } catch (error) {
      console.error("Delete session failed:", error)
    }
  }

  const handleTrackAdd = (trackId, type) => {
    setPendingTrack(trackId)
    if (type === "video") {
      videoInputRef.current?.click()
    } else if (type === "audio") {
      audioInputRef.current?.click()
    } else if (type === "text") {
      const clipDuration = 5
      const newClipId = `clip_${Date.now()}`
      addClip(trackId, {
        clip_id: newClipId,
        start: timeline.playhead_position,
        end: timeline.playhead_position + clipDuration,
        type: "text",
        text: "Double click to edit",
        textStyle: {
          fontSize: 48,
          fontFamily: 'Arial',
          fontWeight: 'bold',
          color: '#FFFFFF',
          backgroundColor: 'transparent',
          textAlign: 'center'
        }
      })
      useEditorStore.getState().selectClip(newClipId)
    }
  }

  const handleVideoSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file || !pendingTrack) return
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.src = url
    video.onloadedmetadata = () => {
      const clipDuration = Math.min(video.duration, 120)
      const newClipId = `clip_${Date.now()}`
      addClip(pendingTrack, { clip_id: newClipId, end: clipDuration, src: url, type: "video" })
      useEditorStore.getState().selectClip(newClipId)
    }
    setPendingTrack(null)
    e.target.value = ''
  }

  const handleAudioSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file || !pendingTrack) return
    const url = URL.createObjectURL(file)
    const audio = document.createElement('audio')
    audio.src = url
    audio.onloadedmetadata = () => {
      const clipDuration = Math.min(audio.duration, 120)
      const newClipId = `clip_${Date.now()}`
      addClip(pendingTrack, { clip_id: newClipId, end: clipDuration, src: url, type: "audio" })
      useEditorStore.getState().selectClip(newClipId)
    }
    setPendingTrack(null)
    e.target.value = ''
  }

  const handleSplit = () => {
    const selectedClipId = timeline.selectedClipId
    const playheadPos = timeline.playhead_position
    if (!selectedClipId) { alert('Please select a clip first'); return }
    let selectedClip = null
    for (const track of timeline.tracks) {
      const clip = track.clips.find(c => c.clip_id === selectedClipId)
      if (clip) { selectedClip = clip; break }
    }
    if (!selectedClip) { alert('Clip not found'); return }
    if (playheadPos <= selectedClip.start || playheadPos >= selectedClip.end) {
      alert('Move the playhead inside the clip you want to split')
      return
    }
    splitClip(selectedClipId)
  }

  // ── Error screen — shown if backend is unreachable or content_id missing ──
  if (initError) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#0a0e1a', flexDirection: 'column', gap: '12px'
      }}>
        <div style={{ fontSize: '32px' }}>⚠️</div>
        <div style={{ fontSize: '16px', fontWeight: '600', color: '#ef4444' }}>
          Editor failed to initialize
        </div>
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', textAlign: 'center', maxWidth: '400px' }}>
          {initError}
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      <header className="header">
        <div style={{ fontSize: '18px', fontWeight: '600', color: '#FFFFFF' }}>
          Unified Content Editor
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{
            fontSize: '13px',
            color: isSaving ? '#fbbf24' : '#22c55e',
            fontWeight: '500',
            marginRight: '4px'
          }}>
            {isSaving ? "💾 Saving..." : "✓ Saved"}
          </span>
          <button onClick={handleSave}>Save</button>
          <button
            onClick={() => { if (timeline.selectedClipId) deleteClip(timeline.selectedClipId) }}
            disabled={!timeline.selectedClipId}
            style={{
              opacity: timeline.selectedClipId ? 1 : 0.5,
              cursor: timeline.selectedClipId ? 'pointer' : 'not-allowed'
            }}
          >
            Delete Clip
          </button>
          <button onClick={handleDeleteSession}>Delete Session</button>
        </div>
      </header>

      <div className="preview-area" style={{ height: dividerPosition }}>
        <CompositePreview />
      </div>

      <div style={{ height: "6px", background: "#00f0ff", cursor: "row-resize" }} onMouseDown={startDrag} />

      <div className="track-controls">
        <button
          onClick={() => addTrack("video")}
          disabled={timeline.tracks.some(t => t.type === 'video')}
          style={{
            opacity: timeline.tracks.some(t => t.type === 'video') ? 0.5 : 1,
            cursor: timeline.tracks.some(t => t.type === 'video') ? 'not-allowed' : 'pointer'
          }}
        >
          {timeline.tracks.some(t => t.type === 'video') ? '✓ Video Track' : '+ Video Track'}
        </button>
        <button
          onClick={() => addTrack("audio")}
          disabled={timeline.tracks.some(t => t.type === 'audio')}
          style={{
            opacity: timeline.tracks.some(t => t.type === 'audio') ? 0.5 : 1,
            cursor: timeline.tracks.some(t => t.type === 'audio') ? 'not-allowed' : 'pointer'
          }}
        >
          {timeline.tracks.some(t => t.type === 'audio') ? '✓ Audio Track' : '+ Audio Track'}
        </button>
        <button
          onClick={() => addTrack("text")}
          disabled={timeline.tracks.some(t => t.type === 'text')}
          style={{
            opacity: timeline.tracks.some(t => t.type === 'text') ? 0.5 : 1,
            cursor: timeline.tracks.some(t => t.type === 'text') ? 'not-allowed' : 'pointer'
          }}
        >
          {timeline.tracks.some(t => t.type === 'text') ? '✓ Text Track' : '+ Text Track'}
        </button>
        <button onClick={zoomIn}>Zoom In (zoom: {timeline.zoom_level})</button>
        <button onClick={zoomOut}>Zoom Out</button>
        <button
          onClick={handleSplit}
          style={{ background: '#2563eb', fontWeight: '600' }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#1e4fd8'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#2563eb'}
        >
          ✂️ Split Clip
        </button>
      </div>

      <input type="file" accept="video/*" ref={videoInputRef} style={{ display: "none" }} onChange={handleVideoSelect} />
      <input type="file" accept="audio/*" ref={audioInputRef} style={{ display: "none" }} onChange={handleAudioSelect} />

      <TextPropertiesPanel />
      <Timeline onTrackAdd={handleTrackAdd} />
    </div>
  )
}

export default App