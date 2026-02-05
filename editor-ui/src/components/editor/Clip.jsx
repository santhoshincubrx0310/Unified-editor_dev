import { useEditorStore } from "../../store/editorStore"
import { useRef, useEffect, useState } from "react"

export default function Clip({ clip, trackType, trackHeight }) {
  const zoom = useEditorStore((s) => s.timeline.zoom_level)
  const moveClip = useEditorStore((s) => s.moveClip)
  const trimClipLeft = useEditorStore((s) => s.trimClipLeft)
  const trimClipRight = useEditorStore((s) => s.trimClipRight)
  const deleteClip = useEditorStore((s) => s.deleteClip)
  const selectedClipId = useEditorStore((s) => s.timeline.selectedClipId)
  const selectClip = useEditorStore((s) => s.selectClip)

  const isSelected = selectedClipId === clip.clip_id
  const dragMode = useRef(null)
  const startX = useRef(0)
  
  const [filmstripUrl, setFilmstripUrl] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)

  const clipLeft = clip.start * zoom
  const clipWidth = (clip.end - clip.start) * zoom
  
  // Use full track height minus padding
  const clipHeight = trackHeight ? trackHeight - 8 : 60

  // Generate filmstrip for video
  useEffect(() => {
    if (clip.type !== "video" || !clip.src || clipWidth < 50) return
    if (isGenerating) return

    setIsGenerating(true)

    const generateFilmstrip = async () => {
      try {
        const video = document.createElement('video')
        video.src = clip.src
        video.crossOrigin = "anonymous"
        video.muted = true
        
        await new Promise((resolve, reject) => {
          video.onloadedmetadata = resolve
          video.onerror = reject
        })

        const frameWidth = 60
        const frameHeight = clipHeight
        const numFrames = Math.max(3, Math.ceil(clipWidth / frameWidth))
        
        const canvas = document.createElement('canvas')
        canvas.width = frameWidth * numFrames
        canvas.height = frameHeight
        const ctx = canvas.getContext('2d')

        for (let i = 0; i < numFrames; i++) {
          const time = (video.duration / numFrames) * i
          video.currentTime = Math.min(time, video.duration - 0.1)

          await new Promise((resolve) => {
            video.onseeked = resolve
          })

          ctx.drawImage(video, i * frameWidth, 0, frameWidth, frameHeight)
        }

        setFilmstripUrl(canvas.toDataURL())
      } catch (error) {
        console.error('Failed to generate filmstrip:', error)
      } finally {
        setIsGenerating(false)
      }
    }

    generateFilmstrip()
  }, [clip.src, clip.type, clipWidth, clipHeight, clip.start, clip.end])

  const onMouseDown = (e, mode) => {
    e.preventDefault()
    e.stopPropagation()
    dragMode.current = mode
    startX.current = e.clientX
    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
  }

  const onMouseMove = (e) => {
    const deltaX = e.clientX - startX.current
    const deltaTime = Math.round(deltaX / zoom)
    if (deltaTime === 0) return

    if (dragMode.current === "move") {
      moveClip(clip.clip_id, clip.start + deltaTime)
    } else if (dragMode.current === "trim-left") {
      trimClipLeft(clip.clip_id, clip.start + deltaTime)
    } else if (dragMode.current === "trim-right") {
      trimClipRight(clip.clip_id, clip.end + deltaTime)
    }

    startX.current = e.clientX
  }

  const onMouseUp = () => {
    dragMode.current = null
    document.removeEventListener("mousemove", onMouseMove)
    document.removeEventListener("mouseup", onMouseUp)
  }

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Delete" && isSelected) {
        deleteClip(clip.clip_id)
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [isSelected, clip.clip_id, deleteClip])

  // Get clip styling based on type
  const getClipStyle = () => {
    if (clip.type === "video" && filmstripUrl) {
      return {
        backgroundImage: `url(${filmstripUrl})`,
        backgroundSize: 'auto 100%',
        backgroundRepeat: 'repeat-x',
        backgroundPosition: '0 0',
        backgroundColor: '#1a1f35'
      }
    } else if (clip.type === "audio") {
      return {
        background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
        borderLeft: '3px solid #c084fc'
      }
    } else if (clip.type === "text") {
      return {
        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        borderLeft: '3px solid #fbbf24'
      }
    } else {
      return {
        background: '#1e293b'
      }
    }
  }

  return (
    <div
      style={{
        position: "absolute",
        left: `${clipLeft}px`,
        top: '4px',
        width: `${Math.max(clipWidth, 50)}px`,
        height: `${clipHeight}px`,
        
        ...getClipStyle(),
        
        border: isSelected ? '2px solid #22d3ee' : '1px solid rgba(255,255,255,0.1)',
        borderRadius: '6px',
        
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        
        cursor: 'grab',
        userSelect: 'none',
        overflow: 'hidden',
        
        boxShadow: isSelected 
          ? '0 0 0 3px rgba(34, 211, 238, 0.3), 0 4px 12px rgba(0, 0, 0, 0.4)'
          : '0 2px 8px rgba(0, 0, 0, 0.3)',
        
        zIndex: isSelected ? 20 : 10,
        transition: 'box-shadow 0.2s, border 0.2s'
      }}
      onClick={(e) => {
        e.stopPropagation()
        selectClip(clip.clip_id)
      }}
      onMouseDown={(e) => onMouseDown(e, "move")}
    >
      {/* Loading indicator for video */}
      {clip.type === "video" && !filmstripUrl && (
        <div style={{
          color: "rgba(255, 255, 255, 0.5)",
          fontSize: "11px",
          fontWeight: '500'
        }}>
          Loading preview...
        </div>
      )}

      {/* Audio waveform placeholder */}
      {clip.type === "audio" && (
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}>
          <span style={{ fontSize: '18px' }}>🎵</span>
          {clipWidth > 80 && (
            <span style={{ 
              color: 'white', 
              fontSize: '13px', 
              fontWeight: '600' 
            }}>
              Audio
            </span>
          )}
        </div>
      )}

      {/* Text preview */}
      {clip.type === "text" && (
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 12px',
          gap: '8px'
        }}>
          <span style={{ fontSize: '16px' }}>📝</span>
          {clipWidth > 80 && (
            <span style={{
              color: 'white',
              fontSize: '12px',
              fontWeight: '600',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {clip.text || "Text"}
            </span>
          )}
        </div>
      )}

      {/* Left trim handle */}
      <div
        onMouseDown={(e) => onMouseDown(e, "trim-left")}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '10px',
          background: isSelected 
            ? 'linear-gradient(90deg, rgba(34, 211, 238, 0.8), transparent)'
            : 'linear-gradient(90deg, rgba(255, 255, 255, 0.2), transparent)',
          cursor: 'ew-resize',
          borderRadius: '6px 0 0 6px',
          zIndex: 5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div style={{
          width: '2px',
          height: '24px',
          background: isSelected ? '#22d3ee' : 'rgba(255, 255, 255, 0.6)',
          borderRadius: '1px'
        }} />
      </div>
      
      {/* Right trim handle */}
      <div
        onMouseDown={(e) => onMouseDown(e, "trim-right")}
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: '10px',
          background: isSelected 
            ? 'linear-gradient(270deg, rgba(34, 211, 238, 0.8), transparent)'
            : 'linear-gradient(270deg, rgba(255, 255, 255, 0.2), transparent)',
          cursor: 'ew-resize',
          borderRadius: '0 6px 6px 0',
          zIndex: 5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div style={{
          width: '2px',
          height: '24px',
          background: isSelected ? '#22d3ee' : 'rgba(255, 255, 255, 0.6)',
          borderRadius: '1px'
        }} />
      </div>

      {/* Duration label */}
      {clipWidth > 100 && (
        <div style={{
          position: 'absolute',
          bottom: '6px',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '10px',
          color: 'white',
          background: 'rgba(0, 0, 0, 0.7)',
          padding: '3px 8px',
          borderRadius: '4px',
          fontWeight: '600',
          pointerEvents: 'none',
          whiteSpace: 'nowrap'
        }}>
          {(clip.end - clip.start).toFixed(1)}s
        </div>
      )}

      {/* Clip name/type */}
      {clipWidth > 120 && (
        <div style={{
          position: 'absolute',
          top: '6px',
          left: '12px',
          fontSize: '10px',
          color: 'white',
          background: 'rgba(0, 0, 0, 0.6)',
          padding: '3px 8px',
          borderRadius: '4px',
          fontWeight: '600',
          pointerEvents: 'none',
          maxWidth: `${clipWidth - 40}px`,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {clip.type === "video" ? "🎬 Video" : 
           clip.type === "audio" ? "🎵 Audio" : 
           "📝 " + (clip.text || "Text")}
        </div>
      )}
    </div>
  )
}