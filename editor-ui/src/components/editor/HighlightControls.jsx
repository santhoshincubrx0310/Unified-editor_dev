// src/components/editor/HighlightControls.jsx
import { useState } from "react"
import { createHighlightSession } from "../../api/clipApi"
import { useEditorStore } from "../../store/editorStore"

export default function HighlightControls({ contentId, onSessionCreated }) {
  const [isHighlightMode, setIsHighlightMode] = useState(false)
  const [targetDuration, setTargetDuration] = useState(60)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState(null)

  const timeline = useEditorStore((s) => s.timeline)

  const handleCreateHighlight = async () => {
    if (!contentId) {
      setError("No content ID provided")
      return
    }

    // Collect all clip IDs from the current timeline
    const clipIds = []
    for (const track of timeline.tracks) {
      if (track.type === "video" && track.clips) {
        for (const clip of track.clips) {
          if (clip.clip_id) {
            clipIds.push(clip.clip_id)
          }
        }
      }
    }

    if (clipIds.length === 0) {
      setError("No clips in timeline to create highlight from")
      return
    }

    if (targetDuration <= 0) {
      setError("Target duration must be greater than 0")
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      const session = await createHighlightSession(
        contentId,
        clipIds,
        targetDuration,
        {
          sourceModule: "editor-ui",
          platform: "web"
        }
      )

      // Notify parent component
      if (onSessionCreated) {
        onSessionCreated(session)
      }

      // Reset state
      setIsHighlightMode(false)
      setError(null)
    } catch (err) {
      console.error("Failed to create highlight session:", err)
      setError(err.message)
    } finally {
      setIsCreating(false)
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
            onClick={handleCreateHighlight}
            disabled={isCreating}
            style={{
              ...styles.createButton,
              opacity: isCreating ? 0.5 : 1,
              cursor: isCreating ? 'not-allowed' : 'pointer'
            }}
          >
            {isCreating ? "Creating..." : "Create Highlight Session"}
          </button>

          {error && (
            <div style={styles.error}>
              ⚠️ {error}
            </div>
          )}

          <div style={styles.infoText}>
            This will create a new highlight reel session with all clips currently in your timeline.
          </div>
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
    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
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
  },
  infoText: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 1.5
  }
}
