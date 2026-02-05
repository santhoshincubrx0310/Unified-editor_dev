import { useState, useEffect, useRef } from "react"
import Timeline from "./components/editor/Timeline"
import PlayheadControls from "./components/editor/PlayheadControls"
import CompositePreview from "./components/editor/CompositePreview"
import TextEditorModal from "./components/editor/TextEditorModal"
import { useEditorStore } from "./store/editorStore"
import {
  createSession,
  saveSession,
  deleteSession,
} from "./api/sessionApi"

function App() {
  useEffect(() => {
    window.editorStore = useEditorStore
  }, [])

  const addTrack = useEditorStore((s) => s.addTrack)
  const addClip = useEditorStore((s) => s.addClip)
  const deleteClip = useEditorStore((s) => s.deleteClip)
  const timeline = useEditorStore((s) => s.timeline)
  const zoomIn = useEditorStore((s) => s.zoomIn)
  const zoomOut = useEditorStore((s) => s.zoomOut)

  const [sessionId, setSessionId] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  const [dividerPosition, setDividerPosition] = useState(350)
  const [dragging, setDragging] = useState(false)

  const videoInputRef = useRef(null)
  const audioInputRef = useRef(null)
  const [pendingTrack, setPendingTrack] = useState(null)
  
  const [textEditorOpen, setTextEditorOpen] = useState(false)
  const [pendingTextTrack, setPendingTextTrack] = useState(null)

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

  useEffect(() => {
    async function init() {
      try {
        const session = await createSession(
          "11111111-1111-1111-1111-111111111111",
          "22222222-2222-2222-2222-222222222222"
        )
        setSessionId(session.session_id)
      } catch (error) {
        console.error("Failed to create session:", error)
      }
    }
    init()
  }, [])

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
    console.log('Track add clicked:', { trackId, type })
    setPendingTrack(trackId)

    if (type === "video") {
      videoInputRef.current?.click()
    } else if (type === "audio") {
      audioInputRef.current?.click()
    } else if (type === "text") {
      setPendingTextTrack(trackId)
      setTextEditorOpen(true)
    }
  }

  const handleVideoSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file || !pendingTrack) {
      console.warn('No file or pending track:', { file: !!file, pendingTrack })
      return
    }

    const url = URL.createObjectURL(file)
    
    // CRITICAL FIX: Find the correct track and calculate position
    const track = timeline.tracks.find(t => t.track_id === pendingTrack)
    
    // If no clips exist, start at 0. Otherwise, start after the last clip.
    const clipStartPosition = !track?.clips || track.clips.length === 0
      ? 0
      : Math.max(...track.clips.map(c => c.end))
    
    console.log('🎬 Track state:', {
      trackId: pendingTrack,
      existingClips: track?.clips?.length || 0,
      lastClipEnd: track?.clips?.length > 0 ? Math.max(...track.clips.map(c => c.end)) : 'N/A',
      newClipWillStartAt: clipStartPosition
    })
    
    const video = document.createElement('video')
    video.src = url
    
    video.onloadedmetadata = () => {
      const clipDuration = Math.min(video.duration, 120)
      const newClipId = `clip_${Date.now()}`

      console.log('✅ Adding video clip:', {
        trackId: pendingTrack,
        clipId: newClipId,
        start: clipStartPosition,
        end: clipStartPosition + clipDuration,
        duration: clipDuration,
        actualDuration: video.duration
      })

      addClip(pendingTrack, {
        clip_id: newClipId,
        start: clipStartPosition,
        end: clipStartPosition + clipDuration,
        src: url,
        type: "video"
      })

      useEditorStore.getState().selectClip(newClipId)
      
      // Debug: Verify clip was added correctly
      setTimeout(() => {
        const updatedTrack = useEditorStore.getState().timeline.tracks.find(t => t.track_id === pendingTrack)
        console.log('✅ Verification - Clips in track:', updatedTrack?.clips.map(c => ({
          id: c.clip_id,
          start: c.start,
          end: c.end
        })))
      }, 100)
    }

    setPendingTrack(null)
    e.target.value = ''
  }

  const handleAudioSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file || !pendingTrack) {
      console.warn('No file or pending track:', { file: !!file, pendingTrack })
      return
    }

    const url = URL.createObjectURL(file)
    
    const track = timeline.tracks.find(t => t.track_id === pendingTrack)
    
    // Same fix for audio
    const clipStartPosition = !track?.clips || track.clips.length === 0
      ? 0
      : Math.max(...track.clips.map(c => c.end))
    
    const audio = document.createElement('audio')
    audio.src = url
    
    audio.onloadedmetadata = () => {
      const clipDuration = Math.min(audio.duration, 120)
      const newClipId = `clip_${Date.now()}`

      console.log('🎵 Adding audio clip:', {
        trackId: pendingTrack,
        clipId: newClipId,
        start: clipStartPosition,
        end: clipStartPosition + clipDuration,
        duration: clipDuration
      })

      addClip(pendingTrack, {
        clip_id: newClipId,
        start: clipStartPosition,
        end: clipStartPosition + clipDuration,
        src: url,
        type: "audio"
      })

      useEditorStore.getState().selectClip(newClipId)
    }

    setPendingTrack(null)
    e.target.value = ''
  }

  const handleTextSave = (textStyle) => {
    if (!pendingTextTrack) return

    const track = timeline.tracks.find(t => t.track_id === pendingTextTrack)
    
    // Same fix for text
    const clipStartPosition = !track?.clips || track.clips.length === 0
      ? 0
      : Math.max(...track.clips.map(c => c.end))
    
    const clipDuration = 5
    const newClipId = `clip_${Date.now()}`

    console.log('📝 Adding text clip:', {
      trackId: pendingTextTrack,
      clipId: newClipId,
      start: clipStartPosition,
      end: clipStartPosition + clipDuration,
      textStyle
    })

    addClip(pendingTextTrack, {
      clip_id: newClipId,
      start: clipStartPosition,
      end: clipStartPosition + clipDuration,
      type: "text",
      text: textStyle.text,
      textStyle: textStyle
    })

    useEditorStore.getState().selectClip(newClipId)

    setPendingTextTrack(null)
  }

  return (
    <div className="app-container">
      <header className="header">
        <div>Unified Content Editor</div>

        <div>
          <span>{isSaving ? "Saving..." : "Saved"}</span>
          <button onClick={handleSave}>Save</button>
          <button onClick={() => { if (timeline.selectedClipId) deleteClip(timeline.selectedClipId) }}>
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
        <button onClick={() => addTrack("video")}>+ Video Track</button>
        <button onClick={() => addTrack("audio")}>+ Audio Track</button>
        <button onClick={() => addTrack("text")}>+ Text Track</button>
        <button onClick={zoomIn}>Zoom In (zoom: {timeline.zoom_level})</button>
        <button onClick={zoomOut}>Zoom Out</button>
      </div>

      <input type="file" accept="video/*" ref={videoInputRef} style={{ display: "none" }} onChange={handleVideoSelect} />
      <input type="file" accept="audio/*" ref={audioInputRef} style={{ display: "none" }} onChange={handleAudioSelect} />

      <TextEditorModal
        isOpen={textEditorOpen}
        onClose={() => {
          setTextEditorOpen(false)
          setPendingTextTrack(null)
        }}
        onSave={handleTextSave}
      />

      <PlayheadControls />
      <Timeline onTrackAdd={handleTrackAdd} />
    </div>
  )
}

export default App