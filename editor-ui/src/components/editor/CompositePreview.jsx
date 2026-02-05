import { useRef, useEffect, useState } from "react"
import { useEditorStore } from "../../store/editorStore"

export default function CompositePreview() {
  const timeline = useEditorStore((s) => s.timeline)
  const setPlayhead = useEditorStore((s) => s.setPlayhead)
  const updateClip = useEditorStore((s) => s.updateClip) // We'll need to add this to store
  const playheadPosition = timeline.playhead_position
  
  const canvasRef = useRef(null)
  const previewRef = useRef(null)
  const videoRefs = useRef({})
  const audioRefs = useRef({})
  const animationFrameRef = useRef(null)
  
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [draggingText, setDraggingText] = useState(null)
  const [textPositions, setTextPositions] = useState({}) // Store text positions

  const getAllVideoClips = () => {
    return timeline.tracks
      .filter(track => track.type === "video")
      .flatMap(track => track.clips)
      .sort((a, b) => a.start - b.start)
  }

  const getAllAudioClips = () => {
    return timeline.tracks
      .filter(track => track.type === "audio")
      .flatMap(track => track.clips)
      .sort((a, b) => a.start - b.start)
  }

  const getAllTextClips = () => {
    return timeline.tracks
      .filter(track => track.type === "text")
      .flatMap(track => track.clips)
      .sort((a, b) => a.start - b.start)
  }

  const getClipAtTime = (clips, time) => {
    return clips.find(clip => time >= clip.start && time < clip.end)
  }

  const renderFrame = (time) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const videoClips = getAllVideoClips()
    const activeVideo = getClipAtTime(videoClips, time)

    if (activeVideo) {
      const videoEl = videoRefs.current[activeVideo.clip_id]
      if (videoEl && videoEl.readyState >= 2) {
        const videoAspect = videoEl.videoWidth / videoEl.videoHeight
        const canvasAspect = canvas.width / canvas.height

        let drawWidth, drawHeight, drawX, drawY

        if (videoAspect > canvasAspect) {
          drawWidth = canvas.width
          drawHeight = canvas.width / videoAspect
          drawX = 0
          drawY = (canvas.height - drawHeight) / 2
        } else {
          drawHeight = canvas.height
          drawWidth = canvas.height * videoAspect
          drawX = (canvas.width - drawWidth) / 2
          drawY = 0
        }

        ctx.drawImage(videoEl, drawX, drawY, drawWidth, drawHeight)
      }
    }
  }

  useEffect(() => {
    if (isPlaying) return
    const videoClips = getAllVideoClips()
    const activeVideo = getClipAtTime(videoClips, playheadPosition)
    
    if (activeVideo) {
      const videoEl = videoRefs.current[activeVideo.clip_id]
      if (videoEl) {
        videoEl.currentTime = playheadPosition - activeVideo.start
      }
    }
    renderFrame(playheadPosition)
  }, [playheadPosition, timeline.tracks, isPlaying])

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false)
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
      Object.values(videoRefs.current).forEach(el => el?.pause())
      Object.values(audioRefs.current).forEach(el => el?.pause())
    } else {
      setIsPlaying(true)
      setCurrentTime(playheadPosition)
      playLoop(playheadPosition)
    }
  }

  const playLoop = (startTime) => {
    let lastTime = performance.now()
    let time = startTime

    const update = () => {
      const now = performance.now()
      const delta = (now - lastTime) / 1000
      lastTime = now
      time += delta

      setCurrentTime(time)
      setPlayhead(time)

      const videoClips = getAllVideoClips()
      const audioClips = getAllAudioClips()
      
      const activeVideo = getClipAtTime(videoClips, time)
      
      if (activeVideo) {
        const videoEl = videoRefs.current[activeVideo.clip_id]
        if (videoEl) {
          const timeInClip = time - activeVideo.start
          if (Math.abs(videoEl.currentTime - timeInClip) > 0.3) {
            videoEl.currentTime = timeInClip
          }
          if (videoEl.paused) videoEl.play().catch(() => {})
        }

        Object.entries(videoRefs.current).forEach(([id, el]) => {
          if (id !== activeVideo.clip_id && el && !el.paused) el.pause()
        })
      } else {
        Object.values(videoRefs.current).forEach(el => el?.pause())
      }

      audioClips.forEach(clip => {
        const audioEl = audioRefs.current[clip.clip_id]
        if (!audioEl) return
        const isActive = time >= clip.start && time < clip.end
        
        if (isActive) {
          const timeInClip = time - clip.start
          if (Math.abs(audioEl.currentTime - timeInClip) > 0.3) audioEl.currentTime = timeInClip
          if (audioEl.paused) audioEl.play().catch(() => {})
        } else if (!audioEl.paused) {
          audioEl.pause()
        }
      })

      renderFrame(time)

      const allClips = [...videoClips, ...audioClips]
      const maxEnd = allClips.length > 0 ? Math.max(...allClips.map(c => c.end)) : 0
      
      if (time >= maxEnd || time >= timeline.duration) {
        setIsPlaying(false)
        setPlayhead(0)
        setCurrentTime(0)
        Object.values(videoRefs.current).forEach(el => { if (el) { el.pause(); el.currentTime = 0 } })
        Object.values(audioRefs.current).forEach(el => { if (el) { el.pause(); el.currentTime = 0 } })
        return
      }

      animationFrameRef.current = requestAnimationFrame(update)
    }

    animationFrameRef.current = requestAnimationFrame(update)
  }

  // Handle text dragging
  const handleTextMouseDown = (e, clip) => {
    if (isPlaying) return
    e.stopPropagation()
    
    const rect = previewRef.current.getBoundingClientRect()
    const offsetX = e.clientX - rect.left - (textPositions[clip.clip_id]?.x || rect.width / 2)
    const offsetY = e.clientY - rect.top - (textPositions[clip.clip_id]?.y || rect.height / 2)
    
    setDraggingText({ clipId: clip.clip_id, offsetX, offsetY })
  }

  const handleMouseMove = (e) => {
    if (!draggingText || !previewRef.current) return
    
    const rect = previewRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left - draggingText.offsetX
    const y = e.clientY - rect.top - draggingText.offsetY
    
    // Clamp to preview bounds
    const clampedX = Math.max(0, Math.min(x, rect.width))
    const clampedY = Math.max(0, Math.min(y, rect.height))
    
    setTextPositions(prev => ({
      ...prev,
      [draggingText.clipId]: { x: clampedX, y: clampedY }
    }))
  }

  const handleMouseUp = () => {
    setDraggingText(null)
  }

  useEffect(() => {
    if (draggingText) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [draggingText])

  useEffect(() => () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current) }, [])

  const allVideoClips = getAllVideoClips()
  const allAudioClips = getAllAudioClips()
  const allTextClips = getAllTextClips()
  const activeTexts = allTextClips.filter(clip => playheadPosition >= clip.start && playheadPosition < clip.end)

  return (
    <div 
      ref={previewRef}
      style={{ 
        width: "100%", 
        height: "100%", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center", 
        position: "relative", 
        background: "#000"
      }}
    >
      <canvas 
        ref={canvasRef} 
        width={1280} 
        height={720} 
        style={{ 
          maxWidth: "100%", 
          maxHeight: "100%", 
          objectFit: "contain", 
          borderRadius: "8px" 
        }} 
      />

      {/* Draggable text overlays */}
      {activeTexts.map(clip => {
        const style = clip.textStyle || {}
        const position = textPositions[clip.clip_id] || { 
          x: previewRef.current ? previewRef.current.offsetWidth / 2 : 0, 
          y: previewRef.current ? previewRef.current.offsetHeight / 2 : 0 
        }
        
        return (
          <div
            key={clip.clip_id}
            onMouseDown={(e) => handleTextMouseDown(e, clip)}
            style={{
              position: 'absolute',
              left: `${position.x}px`,
              top: `${position.y}px`,
              transform: 'translate(-50%, -50%)',
              cursor: draggingText?.clipId === clip.clip_id ? 'grabbing' : 'grab',
              fontSize: `${(style.fontSize || 48) * 0.5}px`, // Scale down for preview
              fontFamily: style.fontFamily || 'Arial',
              fontWeight: style.fontWeight || 'bold',
              color: style.color || '#FFFFFF',
              backgroundColor: style.backgroundColor !== 'transparent' ? (style.backgroundColor || 'rgba(0, 0, 0, 0.7)') : 'transparent',
              padding: style.backgroundColor !== 'transparent' ? '10px 20px' : '0',
              borderRadius: '8px',
              textAlign: style.textAlign || 'center',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
              border: draggingText?.clipId === clip.clip_id ? '2px dashed #22d3ee' : '2px solid transparent',
              userSelect: 'none',
              whiteSpace: 'nowrap',
              pointerEvents: isPlaying ? 'none' : 'auto'
            }}
          >
            {clip.text || style.text || 'Text'}
          </div>
        )
      })}

      <div style={{ display: "none" }}>
        {allVideoClips.map(clip => (
          <video key={clip.clip_id} ref={el => videoRefs.current[clip.clip_id] = el} src={clip.src} muted={false} playsInline preload="auto" />
        ))}
        {allAudioClips.map(clip => (
          <audio key={clip.clip_id} ref={el => audioRefs.current[clip.clip_id] = el} src={clip.src} preload="auto" />
        ))}
      </div>

      <button onClick={togglePlay} style={{ position: "absolute", bottom: "20px", width: "60px", height: "60px", borderRadius: "50%", background: isPlaying ? "rgba(239, 68, 68, 0.95)" : "rgba(59, 130, 246, 0.95)", border: "none", color: "white", fontSize: "20px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.4)", transition: "all 0.2s", zIndex: 999 }} onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.1)"} onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}>
        {isPlaying ? "⏸" : "▶"}
      </button>

      <div style={{ position: "absolute", bottom: "90px", background: "rgba(0,0,0,0.7)", color: "white", padding: "8px 16px", borderRadius: "20px", fontSize: "14px", fontWeight: "500" }}>
        {currentTime.toFixed(1)}s / {Math.max(...[...allVideoClips, ...allAudioClips].map(c => c.end), 0).toFixed(1)}s
      </div>

      {allVideoClips.length === 0 && (
        <div style={{ position: "absolute", color: "rgba(255,255,255,0.5)", fontSize: "16px", textAlign: "center" }}>
          No video clips<br /><span style={{ fontSize: "12px" }}>Add videos to see preview</span>
        </div>
      )}
    </div>
  )
}