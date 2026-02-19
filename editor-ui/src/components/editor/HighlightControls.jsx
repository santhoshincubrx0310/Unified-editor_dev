// src/components/editor/HighlightControls.jsx
import { useState } from "react"
import { createHighlightSession, fetchClips } from "../../api/editorClipApi"
import { useEditorStore } from "../../store/editorStore"

export default function HighlightControls({ contentId, onSessionCreated }) {
  const [isHighlightMode, setIsHighlightMode] = useState(false)
  const [targetDuration, setTargetDuration] = useState(60)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState(null)
  const [mode, setMode] = useState("manual") // "manual" | "auto"

  const timeline = useEditorStore((s) => s.timeline)
  const addTrack = useEditorStore((s) => s.addTrack)
  const addClipFromLibrary = useEditorStore((s) => s.addClipFromLibrary)

  // Manual: use clips already on the timeline
  const handleCreateManual = async () => {
    if (!contentId) {
      setError("No content ID provided")
      return
    }

    const clipIds = []
    for (const track of timeline.tracks) {
      if (track.type === "video" && track.clips) {
        for (const clip of track.clips) {
          const id = clip.original_clip_id || clip.clip_id
          if (id) clipIds.push(id)
        }
      }
    }

    if (clipIds.length === 0) {
      setError("No clips in timeline to create highlight from")
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      const session = await createHighlightSession(
        contentId, clipIds, targetDuration,
        { sourceModule: "editor-ui", platform: "web" }
      )
      if (onSessionCreated) onSessionCreated(session)
      setIsHighlightMode(false)
      setError(null)
    } catch (err) {
      console.error("Failed to create highlight session:", err)
      setError(err.message)
    } finally {
      setIsCreating(false)
    }
  }

  // Auto: fetch all clips, pick best ones by score, populate timeline
  const handleAutoGenerate = async () => {
    if (!contentId) {
      setError("No content ID provided")
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      // Fetch all available clips
      const allClips = await fetchClips(contentId)
      if (!allClips || allClips.length === 0) {
        setError("No clips available for auto-generation")
        return
      }

      // Sort by score (highest first) for best quality selection
      const sorted = [...allClips].sort((a, b) => (b.score || 0) - (a.score || 0))

      // Pick clips until we hit target duration
      const selected = []
      let totalDuration = 0
      for (const clip of sorted) {
        const clipDur = clip.duration || (clip.end_time - clip.start_time) || 5
        if (totalDuration + clipDur <= targetDuration) {
          selected.push(clip)
          totalDuration += clipDur
        }
        // Stop if we've reached the target
        if (totalDuration >= targetDuration * 0.9) break
      }

      if (selected.length === 0) {
        setError("Could not select clips for the target duration")
        return
      }

      // Ensure video track exists
      const hasVideoTrack = timeline.tracks.some(t => t.type === "video")
      if (!hasVideoTrack) {
        addTrack("video")
      }

      // Wait a tick for track to be added to store
      await new Promise(r => setTimeout(r, 50))

      // Get the video track ID
      const currentTimeline = useEditorStore.getState().timeline
      const videoTrack = currentTimeline.tracks.find(t => t.type === "video")
      if (!videoTrack) {
        setError("Failed to create video track")
        return
      }

      // Add selected clips to timeline
      for (const clip of selected) {
        addClipFromLibrary(videoTrack.track_id, clip)
      }

      setError(null)
      setIsHighlightMode(false)

    } catch (err) {
      console.error("Auto-generate failed:", err)
      setError(err.message)
    } finally {
      setIsCreating(false)
    }
  }

  const handleCreate = () => {
    if (mode === "auto") {
      handleAutoGenerate()
    } else {
      handleCreateManual()
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.toggleSection}>
        <label style={styles.toggleLabel}>
          <input
            type="checkbox"
            checked={isHighlightMode}
            onChange={(e) => setIsHighlightMode(e.target.checked)}
            style={styles.checkbox}
          />
          <span style={styles.toggleText}>
            Highlight Reel Mode
          </span>
        </label>
      </div>

      {isHighlightMode && (
        <div style={styles.controlsSection}>
          {/* Mode selector */}
          <div style={styles.modeSelector}>
            <button
              onClick={() => setMode("manual")}
              style={{
                ...styles.modeButton,
                background: mode === "manual" ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255,255,255,0.06)',
                borderColor: mode === "manual" ? '#3b82f6' : 'rgba(255,255,255,0.15)',
              }}
            >
              ✋ Manual
            </button>
            <button
              onClick={() => setMode("auto")}
              style={{
                ...styles.modeButton,
                background: mode === "auto" ? 'rgba(34, 211, 238, 0.4)' : 'rgba(255,255,255,0.06)',
                borderColor: mode === "auto" ? '#22d3ee' : 'rgba(255,255,255,0.15)',
              }}
            >
              ⚡ Auto-Generate
            </button>
          </div>

          <div style={styles.modeDescription}>
            {mode === "manual"
              ? "Uses clips currently on your timeline to create a highlight session."
              : "Automatically selects the best-scoring clips to fill your target duration."
            }
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.inputLabel}>
              Target Duration (seconds):
            </label>
            <input
              type="number"
              min="1"
              max="300"
              value={targetDuration}
              onChange={(e) => setTargetDuration(Number(e.target.value))}
              style={styles.input}
            />
          </div>

          <button
            onClick={handleCreate}
            disabled={isCreating}
            style={{
              ...styles.createButton,
              background: mode === "auto"
                ? 'linear-gradient(135deg, #22d3ee, #0891b2)'
                : 'linear-gradient(135deg, #3b82f6, #2563eb)',
              opacity: isCreating ? 0.5 : 1,
              cursor: isCreating ? 'not-allowed' : 'pointer'
            }}
          >
            {isCreating
              ? "Creating..."
              : mode === "auto"
                ? "⚡ Auto-Generate Highlight"
                : "Create Highlight Session"
            }
          </button>

          {error && (
            <div style={styles.error}>
              ⚠️ {error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const styles = {
  container: {
    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(34, 211, 238, 0.15))',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '8px',
    padding: '14px',
    marginBottom: '12px'
  },
  toggleSection: {
    display: 'flex',
    alignItems: 'center'
  },
  toggleLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    cursor: 'pointer',
    userSelect: 'none'
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
    accentColor: '#3b82f6'
  },
  toggleText: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#FFFFFF'
  },
  controlsSection: {
    marginTop: '14px',
    paddingTop: '14px',
    borderTop: '1px solid rgba(255,255,255,0.1)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  modeSelector: {
    display: 'flex',
    gap: '8px'
  },
  modeButton: {
    flex: 1,
    padding: '10px 14px',
    border: '1px solid',
    borderRadius: '8px',
    color: '#FFFFFF',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  modeDescription: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 1.5,
    fontStyle: 'italic'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  inputLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)'
  },
  input: {
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '6px',
    color: '#FFFFFF',
    fontSize: '14px',
    fontWeight: '500',
    outline: 'none',
    transition: 'all 0.2s'
  },
  createButton: {
    padding: '12px 20px',
    border: 'none',
    borderRadius: '8px',
    color: '#FFFFFF',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
  },
  error: {
    padding: '10px 12px',
    background: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '6px',
    color: '#fca5a5',
    fontSize: '12px',
    fontWeight: '500'
  }
}
