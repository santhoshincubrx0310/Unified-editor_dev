// src/components/editor/Timeline.jsx
import { useEditorStore, PIXELS_PER_SECOND } from "../../store/editorStore"
import Clip from "./Clip"
import TransitionOverlay from "./TransitionOverlay"
import { normalizeTimeline } from "../../utils/timelineUtils"
import { useRef } from "react"

export default function Timeline({ onTrackAdd }) {
  const timeline = useEditorStore((s) => s.timeline)
  const setPlayhead = useEditorStore((s) => s.setPlayhead)
  const selectClip = useEditorStore((s) => s.selectClip)
  const addClipFromLibrary = useEditorStore((s) => s.addClipFromLibrary)
  const updateClipTransition = useEditorStore((s) => s.updateClipTransition)
  const currentTime = useEditorStore((s) => s.currentTime)

  const timelineRef = useRef(null)

  // Use consistent pixel-to-time mapping
  const pixelsPerSecond = timeline.zoom_level || PIXELS_PER_SECOND
  const timelineWidth = timeline.duration * pixelsPerSecond

  const handlePlayheadDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()

    const container = timelineRef.current.parentElement
    const containerRect = container.getBoundingClientRect()
    const scrollLeft = container.scrollLeft || 0

    const handleMouseMove = (moveEvent) => {
      const x = moveEvent.clientX - containerRect.left + scrollLeft
      const newTime = Math.max(0, Math.min(x / pixelsPerSecond, timeline.duration))
      setPlayhead(newTime)
    }

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
  }

  const handleClick = (e) => {
    if (e.target.classList.contains('timeline-inner') ||
        e.target.classList.contains('timeline-ruler') ||
        e.target.classList.contains('tick') ||
        e.target.classList.contains('lane-content')) {
      const container = timelineRef.current.parentElement
      const rect = container.getBoundingClientRect()
      const scrollLeft = container.scrollLeft || 0
      const clickX = e.clientX - rect.left + scrollLeft
      const newTime = Math.max(0, Math.min(clickX / pixelsPerSecond, timeline.duration))
      setPlayhead(newTime)
      selectClip(null)
    }
  }

  const handleDrop = (e, trackId) => {
    e.preventDefault()
    e.stopPropagation()

    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"))

      if (data.type === "library-clip" && data.clip) {
        addClipFromLibrary(trackId, data.clip)
      }
    } catch (err) {
      console.error("Failed to handle drop:", err)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "copy"
  }

  const ticks = []
  for (let i = 0; i <= timeline.duration; i++) {
    ticks.push(i)
  }

  const getTrackConfig = (type) => {
    switch(type) {
      case 'video':
        return {
          height: '80px',
          background: 'linear-gradient(to bottom, rgba(30, 40, 75, 0.6), rgba(20, 30, 60, 0.6))',
          border: '1px solid rgba(80, 120, 200, 0.15)'
        }
      case 'audio':
        return {
          height: '70px',
          background: 'linear-gradient(to bottom, rgba(50, 30, 70, 0.6), rgba(40, 20, 60, 0.6))',
          border: '1px solid rgba(150, 80, 200, 0.15)'
        }
      case 'text':
        return {
          height: '65px',
          background: 'linear-gradient(to bottom, rgba(30, 45, 60, 0.6), rgba(20, 35, 50, 0.6))',
          border: '1px solid rgba(34, 211, 238, 0.15)'
        }
      default:
        return {
          height: '70px',
          background: 'rgba(30, 40, 80, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.05)'
        }
    }
  }

  return (
    <div style={{
      height: '280px',
      overflowX: 'auto',
      overflowY: 'auto',
      background: '#0a0e1a',
      position: 'relative'
    }}>
      <div
        ref={timelineRef}
        className="timeline-inner"
        style={{
          width: timelineWidth,
          minWidth: '100%',
          position: 'relative',
          paddingTop: '10px',
          paddingBottom: '20px'
        }}
        onClick={handleClick}
      >
        {/* Ruler */}
        <div className="timeline-ruler" style={{
          position: 'sticky',
          top: 0,
          height: '32px',
          background: 'rgba(15, 20, 35, 0.95)',
          borderBottom: '2px solid rgba(34, 211, 238, 0.3)',
          zIndex: 10,
          marginBottom: '12px'
        }}>
          {ticks.map((t) => (
            <div
              key={t}
              className="tick"
              style={{
                position: 'absolute',
                left: t * pixelsPerSecond,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
              }}
            >
              {t % 5 === 0 && (
                <>
                  <span style={{
                    fontSize: '11px',
                    color: '#94a3b8',
                    fontWeight: '500',
                    marginBottom: '4px'
                  }}>
                    {t}s
                  </span>
                  <div style={{
                    width: '2px',
                    height: '14px',
                    background: 'rgba(34, 211, 238, 0.4)'
                  }} />
                </>
              )}
              {t % 5 !== 0 && t % 1 === 0 && (
                <div style={{
                  width: '1px',
                  height: '8px',
                  background: 'rgba(255, 255, 255, 0.15)',
                  marginTop: 'auto'
                }} />
              )}
            </div>
          ))}
        </div>

        {/* Tracks */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          paddingLeft: '10px',
          paddingRight: '60px',
          position: 'relative'
        }}>
          {timeline.tracks.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: 'rgba(255, 255, 255, 0.3)',
              fontSize: '15px',
              fontWeight: '500'
            }}>
              Click buttons above to add tracks
            </div>
          )}
          
          {timeline.tracks.map((track) => {
            const config = getTrackConfig(track.type)

            // Normalize clips: video tracks get overlap-aware layout,
            // other tracks keep their stored positions.
            const normalizedClips = track.type === 'video' && track.clips
              ? normalizeTimeline(track.clips, timeline.transitions || [])
              : (track.clips || []).map(clip => ({
                  ...clip,
                  duration: clip.end - clip.start,
                  timelineStart: clip.start,
                  timelineEnd: clip.end
                }))

            return (
              <div
                key={track.track_id}
                style={{
                  ...config,
                  position: 'relative',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'stretch',
                  overflow: 'visible',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
                }}
                onDrop={(e) => handleDrop(e, track.track_id)}
                onDragOver={handleDragOver}
              >
                <div className="lane-content" style={{
                  position: 'relative',
                  flex: 1,
                  height: '100%',
                  minHeight: config.height
                }}>
                  {normalizedClips.length === 0 && (
                    <div style={{
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                      transform: 'translate(-50%, -50%)',
                      color: 'rgba(255, 255, 255, 0.15)',
                      fontSize: '12px',
                      fontWeight: '500',
                      pointerEvents: 'none',
                      whiteSpace: 'nowrap'
                    }}>
                      Empty {track.type} track
                    </div>
                  )}

                  {normalizedClips.map((clip, index) => {
                    const nextClip = normalizedClips[index + 1]

                    return (
                      <div key={clip.clip_id} style={{ position: 'relative' }}>
                        <Clip
                          clip={clip}
                          trackType={track.type}
                          trackHeight={parseInt(config.height)}
                          pixelsPerSecond={pixelsPerSecond}
                        />

                        {/* Transition Overlay between clips */}
                        {nextClip && (
                          <TransitionOverlay
                            fromClip={clip}
                            toClip={nextClip}
                            trackHeight={parseInt(config.height)}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>

                <button
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: 'rgba(59, 130, 246, 0.25)',
                    color: '#5b9eff',
                    fontSize: '20px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1.5px solid rgba(59, 130, 246, 0.4)',
                    padding: 0,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                    zIndex: 5
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onTrackAdd(track.track_id, track.type)
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.4)'
                    e.currentTarget.style.transform = 'translateY(-50%) scale(1.05)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.25)'
                    e.currentTarget.style.transform = 'translateY(-50%) scale(1)'
                  }}
                >
                  +
                </button>
              </div>
            )
          })}

          {/* Playhead - ONLY IN TIMELINE AREA - Synced with currentTime */}
          {timeline.tracks.length > 0 && (
            <div
              onMouseDown={handlePlayheadDrag}
              style={{
                position: 'absolute',
                left: currentTime * pixelsPerSecond,
                top: '-44px',
                height: 'calc(100% + 44px)',
                width: '2px',
                background: '#22d3ee',
                boxShadow: '0 0 8px rgba(34, 211, 238, 0.6)',
                cursor: 'ew-resize',
                zIndex: 100,
                pointerEvents: 'auto',
                transition: 'none' // No transition for smooth dragging
              }}
            >
              <div 
                style={{
                  position: 'absolute',
                  top: '0',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '12px',
                  height: '12px',
                  background: '#22d3ee',
                  borderRadius: '50%',
                  border: '2px solid white',
                  boxShadow: '0 2px 6px rgba(34, 211, 238, 0.5)',
                  cursor: 'grab'
                }} 
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}