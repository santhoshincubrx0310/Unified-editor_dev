// src/components/editor/CompositePreview.jsx
import { useRef, useEffect, useState } from "react"
import { useEditorStore } from "../../store/editorStore"
import { getClipAtTime, getTransitionBlend, getClipsByType } from "../../utils/playbackEngine"
import { normalizeTimeline } from "../../utils/timelineUtils"

export default function CompositePreview() {
  const timeline = useEditorStore((s) => s.timeline)
  const setPlayhead = useEditorStore((s) => s.setPlayhead)
  const updateClip = useEditorStore((s) => s.updateClip)
  const selectClip = useEditorStore((s) => s.selectClip)
  const currentTime = useEditorStore((s) => s.currentTime)
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime)
  const playheadPosition = timeline.playhead_position
  const selectedClipId = timeline.selectedClipId
  const transitions = timeline.transitions || []
  
  const canvasRef = useRef(null)
  const previewRef = useRef(null)
  const videoRefs = useRef({})
  const audioRefs = useRef({})
  const animationFrameRef = useRef(null)

  // Dual video layer refs for transitions
  const videoLayerARef = useRef(null)
  const videoLayerBRef = useRef(null)
  const [activeTransition, setActiveTransition] = useState(null)
  const [transitionProgress, setTransitionProgress] = useState(0)

  const [isPlaying, setIsPlaying] = useState(false)
  const [dragging, setDragging] = useState(null)
  const [resizing, setResizing] = useState(null)
  const [editingText, setEditingText] = useState(null) // Inline editing state

  const PREVIEW_WIDTH = 1280
  const PREVIEW_HEIGHT = 720

  // Normalized clip helpers – single source of truth for timing
  const getNormalizedVideoClips = () => {
    return normalizeTimeline(getClipsByType(timeline.tracks, "video"), transitions)
  }

  const getNormalizedAudioClips = () => {
    return getClipsByType(timeline.tracks, "audio").map(clip => ({
      ...clip,
      timelineStart: clip.start,
      timelineEnd: clip.end,
      duration: clip.end - clip.start
    }))
  }

  const getNormalizedTextClips = () => {
    return getClipsByType(timeline.tracks, "text").map(clip => ({
      ...clip,
      timelineStart: clip.start,
      timelineEnd: clip.end,
      duration: clip.end - clip.start
    }))
  }

  const getMediaTime = (clip, timelineTime) => {
    if (!clip) return 0
    const timeIntoClip = timelineTime - clip.timelineStart
    const trimStart = clip.trim_start || 0
    const mediaTime = trimStart + timeIntoClip
    return Math.max(0, mediaTime)
  }

  // Apply transition styles to video layers
  const applyTransitionStyles = (type, progress, layerA, layerB) => {
    if (!layerA || !layerB) return

    // Reset styles first - use proper transform reset
    layerA.style.opacity = '1'
    layerB.style.opacity = '0'
    layerA.style.transform = 'translateX(0) scale(1)'
    layerB.style.transform = 'translateX(0) scale(1)'
    layerA.style.filter = 'none'
    layerB.style.filter = 'none'
    layerA.style.transformOrigin = 'center center'
    layerB.style.transformOrigin = 'center center'

    switch (type) {
      case 'fade':
        // Video A fades out, Video B fades in
        layerA.style.opacity = String(1 - progress)
        layerB.style.opacity = String(progress)
        break

      case 'crossfade':
        // Both visible, smooth crossfade
        layerA.style.opacity = String(1 - progress)
        layerB.style.opacity = String(progress)
        break

      case 'zoom':
        // Video B scales up while fading in - contained within bounds
        layerA.style.opacity = String(1 - progress)
        layerB.style.opacity = String(progress)
        layerB.style.transform = `scale(${1 + progress * 0.3})`
        break

      case 'slide-left':
        // Video B slides from right, Video A slides to left - safe contained slide
        layerA.style.transform = `translateX(${-progress * 100}%)`
        layerB.style.transform = `translateX(${(1 - progress) * 100}%)`
        layerB.style.opacity = '1'
        break

      case 'slide-right':
        // Video B slides from left, Video A slides to right - safe contained slide
        layerA.style.transform = `translateX(${progress * 100}%)`
        layerB.style.transform = `translateX(${-(1 - progress) * 100}%)`
        layerB.style.opacity = '1'
        break

      case 'blur':
        // Both videos blur and crossfade
        layerA.style.filter = `blur(${progress * 10}px)`
        layerA.style.opacity = String(1 - progress)
        layerB.style.filter = `blur(${(1 - progress) * 10}px)`
        layerB.style.opacity = String(progress)
        break

      default:
        // No transition
        layerB.style.opacity = '0'
        break
    }
  }

  const renderFrame = (timelineTime) => {
    const canvas = canvasRef.current
    const layerA = videoLayerARef.current
    const layerB = videoLayerBRef.current

    if (!canvas) return

    const videoClips = getNormalizedVideoClips()
    const { clip: activeVideo, nextClip, transition, isInTransition, transitionProgress: tProgress } =
      getClipAtTime(videoClips, timelineTime, transitions)

    // Update transition state
    if (isInTransition && transition && nextClip) {
      setActiveTransition(transition)
      setTransitionProgress(tProgress)

      // Use video layers for transition rendering
      if (layerA && layerB) {
        const videoElA = videoRefs.current[activeVideo.clip_id]
        const videoElB = videoRefs.current[nextClip.clip_id]

        if (videoElA && videoElB) {
          // Update video sources
          if (layerA.src !== videoElA.src) layerA.src = videoElA.src
          if (layerB.src !== videoElB.src) layerB.src = videoElB.src

          // Sync video times
          const mediaTimeA = getMediaTime(activeVideo, timelineTime)
          const mediaTimeB = getMediaTime(nextClip, timelineTime)

          if (Math.abs(layerA.currentTime - mediaTimeA) > 0.1) {
            layerA.currentTime = mediaTimeA
          }
          if (Math.abs(layerB.currentTime - mediaTimeB) > 0.1) {
            layerB.currentTime = mediaTimeB
          }

          // Apply transition animations
          applyTransitionStyles(transition.type, tProgress, layerA, layerB)

          // Hide canvas during transition
          canvas.style.opacity = '0'
          if (layerA) layerA.style.display = 'block'
          if (layerB) layerB.style.display = 'block'
          return
        }
      }
    } else {
      setActiveTransition(null)
      setTransitionProgress(0)

      // Reset video layers with proper transform reset
      if (layerA) {
        layerA.style.opacity = '0'
        layerA.style.display = 'none'
        layerA.style.transform = 'translateX(0) scale(1)'
        layerA.style.filter = 'none'
      }
      if (layerB) {
        layerB.style.opacity = '0'
        layerB.style.display = 'none'
        layerB.style.transform = 'translateX(0) scale(1)'
        layerB.style.filter = 'none'
      }

      // Show canvas for normal rendering
      canvas.style.opacity = '1'
    }

    // Standard canvas rendering (non-transition)
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    if (activeVideo) {
      const videoEl = videoRefs.current[activeVideo.clip_id]
      if (videoEl && videoEl.readyState >= 2) {
        drawVideoToCanvas(ctx, videoEl, canvas)
      }
    }
  }

  const drawVideoToCanvas = (ctx, videoEl, canvas) => {
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

  useEffect(() => {
    if (isPlaying) return

    const videoClips = getNormalizedVideoClips()
    const { clip: activeVideo, nextClip } = getClipAtTime(videoClips, currentTime, transitions)

    // Seek active video to correct position
    if (activeVideo) {
      const videoEl = videoRefs.current[activeVideo.clip_id]
      if (videoEl) {
        const mediaTime = getMediaTime(activeVideo, currentTime)
        if (Math.abs(videoEl.currentTime - mediaTime) > 0.1) {
          videoEl.currentTime = mediaTime
        }
      }
    }

    // Preload next clip and LayerB for smooth transitions
    if (nextClip) {
      const nextVideoEl = videoRefs.current[nextClip.clip_id]
      if (nextVideoEl && nextVideoEl.readyState < 2) {
        nextVideoEl.load()
      }
      // Preload LayerB so it's ready before transition begins
      const layerB = videoLayerBRef.current
      if (layerB && nextVideoEl && layerB.src !== nextVideoEl.src) {
        layerB.src = nextVideoEl.src
        layerB.load()
      }
    }

    renderFrame(currentTime)
  }, [currentTime, timeline.tracks, isPlaying, transitions])

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false)
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
      Object.values(videoRefs.current).forEach(el => el?.pause())
      Object.values(audioRefs.current).forEach(el => el?.pause())
    } else {
      setIsPlaying(true)
      playLoop(playheadPosition)
    }
  }

  const playLoop = (startTime) => {
    let lastTime = performance.now()
    let currentTimelineTime = startTime

    const update = () => {
      const now = performance.now()
      const delta = (now - lastTime) / 1000
      lastTime = now

      currentTimelineTime += delta
      setPlayhead(currentTimelineTime)
      setCurrentTime(currentTimelineTime)

      const videoClips = getNormalizedVideoClips()
      const audioClips = getNormalizedAudioClips()

      const { clip: activeVideo, nextClip, isInTransition, transition } =
        getClipAtTime(videoClips, currentTimelineTime, transitions)

      const layerA = videoLayerARef.current
      const layerB = videoLayerBRef.current

      if (activeVideo) {
        // If in transition, use video layers
        if (isInTransition && nextClip && transition) {
          if (layerA && layerB) {
            const videoElA = videoRefs.current[activeVideo.clip_id]
            const videoElB = videoRefs.current[nextClip.clip_id]

            if (videoElA && videoElB) {
              // Sync layer A
              if (layerA.src !== videoElA.src) layerA.src = videoElA.src
              const mediaTimeA = getMediaTime(activeVideo, currentTimelineTime)
              if (Math.abs(layerA.currentTime - mediaTimeA) > 0.1) {
                layerA.currentTime = mediaTimeA
              }
              if (layerA.paused) {
                layerA.play().catch(e => console.warn('Layer A play failed:', e))
              }

              // Sync layer B
              if (layerB.src !== videoElB.src) layerB.src = videoElB.src
              const mediaTimeB = getMediaTime(nextClip, currentTimelineTime)
              if (Math.abs(layerB.currentTime - mediaTimeB) > 0.1) {
                layerB.currentTime = mediaTimeB
              }
              if (layerB.paused) {
                layerB.play().catch(e => console.warn('Layer B play failed:', e))
              }
            }
          }

          // Pause hidden video refs
          Object.entries(videoRefs.current).forEach(([id, el]) => {
            if (el && !el.paused) {
              el.pause()
            }
          })
        } else {
          // Normal playback - use video refs
          const videoEl = videoRefs.current[activeVideo.clip_id]
          if (videoEl) {
            const targetMediaTime = getMediaTime(activeVideo, currentTimelineTime)

            if (Math.abs(videoEl.currentTime - targetMediaTime) > 0.1) {
              videoEl.currentTime = targetMediaTime
            }

            if (videoEl.paused) {
              videoEl.play().catch(e => console.warn('Play failed:', e))
            }
          }

          // Pause video layers
          if (layerA && !layerA.paused) layerA.pause()
          if (layerB && !layerB.paused) layerB.pause()

          // Pause clips that aren't active
          Object.entries(videoRefs.current).forEach(([id, el]) => {
            if (id !== activeVideo.clip_id && el && !el.paused) {
              el.pause()
            }
          })
        }
      } else {
        Object.values(videoRefs.current).forEach(el => el?.pause())
        if (layerA && !layerA.paused) layerA.pause()
        if (layerB && !layerB.paused) layerB.pause()
      }

      audioClips.forEach(clip => {
        const audioEl = audioRefs.current[clip.clip_id]
        if (!audioEl) return
        
        const isActive = currentTimelineTime >= clip.timelineStart && currentTimelineTime < clip.timelineEnd
        
        if (isActive) {
          const targetMediaTime = getMediaTime(clip, currentTimelineTime)
          
          if (Math.abs(audioEl.currentTime - targetMediaTime) > 0.3) {
            audioEl.currentTime = targetMediaTime
          }
          
          if (audioEl.paused) {
            audioEl.play().catch(e => console.warn('Audio play failed:', e))
          }
        } else if (!audioEl.paused) {
          audioEl.pause()
        }
      })

      renderFrame(currentTimelineTime)

      const allClips = [...videoClips, ...audioClips]
      const maxEnd = allClips.length > 0 ? Math.max(...allClips.map(c => c.timelineEnd)) : 0
      
      if (currentTimelineTime >= maxEnd || currentTimelineTime >= timeline.duration) {
        setIsPlaying(false)
        setPlayhead(0)
        Object.values(videoRefs.current).forEach(el => { 
          if (el) { 
            el.pause()
            el.currentTime = 0
          } 
        })
        Object.values(audioRefs.current).forEach(el => { 
          if (el) { 
            el.pause()
            el.currentTime = 0
          } 
        })
        return
      }

      animationFrameRef.current = requestAnimationFrame(update)
    }

    animationFrameRef.current = requestAnimationFrame(update)
  }

  // Handle double-click for inline editing
  const handleTextDoubleClick = (e, clip) => {
    if (isPlaying) return
    e.stopPropagation()
    setEditingText(clip.clip_id)
    selectClip(clip.clip_id)
  }

  // Handle inline text edit with proper event handling
  const handleTextChange = (clipId, newText) => {
    updateClip(clipId, { text: newText })
  }

  // Handle blur to exit editing
  const handleTextBlur = () => {
    setEditingText(null)
  }

  // Handle key events for better editing experience
  const handleTextKeyDown = (e, clipId) => {
    if (e.key === 'Escape') {
      setEditingText(null)
      e.target.blur()
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      setEditingText(null)
      e.target.blur()
    }
  }

  // Auto-select all text when entering edit mode
  useEffect(() => {
    if (editingText) {
      // Small delay to ensure textarea is rendered
      setTimeout(() => {
        const textarea = document.querySelector(`[data-clip-id="${editingText}"]`)
        if (textarea) {
          textarea.select()
        }
      }, 0)
    }
  }, [editingText])

  const handleTextMouseDown = (e, clip) => {
    if (isPlaying || editingText === clip.clip_id) return
    e.stopPropagation()
    
    selectClip(clip.clip_id)
    
    const canvas = canvasRef.current
    if (!canvas) return
    
    const canvasRect = canvas.getBoundingClientRect()
    const previewRect = previewRef.current.getBoundingClientRect()
    
    const scaleX = PREVIEW_WIDTH / canvasRect.width
    const scaleY = PREVIEW_HEIGHT / canvasRect.height
    
    const posX = clip.position?.x || PREVIEW_WIDTH / 2
    const posY = clip.position?.y || PREVIEW_HEIGHT / 2
    
    const displayX = canvasRect.left - previewRect.left + (posX / scaleX)
    const displayY = canvasRect.top - previewRect.top + (posY / scaleY)
    
    const offsetX = e.clientX - displayX
    const offsetY = e.clientY - displayY
    
    setDragging({ clipId: clip.clip_id, offsetX, offsetY })
  }

  const handleResizeMouseDown = (e, clip, corner) => {
    if (isPlaying) return
    e.stopPropagation()
    
    selectClip(clip.clip_id)
    
    setResizing({
      clipId: clip.clip_id,
      corner,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: clip.size?.width || 400,
      startHeight: clip.size?.height || 100,
      startPosX: clip.position?.x || PREVIEW_WIDTH / 2,
      startPosY: clip.position?.y || PREVIEW_HEIGHT / 2
    })
  }

  useEffect(() => {
    const handleMouseMove = (e) => {
      const canvas = canvasRef.current
      const preview = previewRef.current
      if (!canvas || !preview) return
      
      const canvasRect = canvas.getBoundingClientRect()
      const previewRect = preview.getBoundingClientRect()
      const scaleX = PREVIEW_WIDTH / canvasRect.width
      const scaleY = PREVIEW_HEIGHT / canvasRect.height
      
      if (dragging) {
        const mouseX = e.clientX - (canvasRect.left - previewRect.left) - dragging.offsetX
        const mouseY = e.clientY - (canvasRect.top - previewRect.top) - dragging.offsetY
        
        const x = Math.max(0, Math.min(mouseX * scaleX, PREVIEW_WIDTH))
        const y = Math.max(0, Math.min(mouseY * scaleY, PREVIEW_HEIGHT))
        
        updateClip(dragging.clipId, { position: { x, y } })
      }
      
      if (resizing) {
        const deltaX = (e.clientX - resizing.startX) * scaleX
        const deltaY = (e.clientY - resizing.startY) * scaleY
        
        let newWidth = resizing.startWidth
        let newHeight = resizing.startHeight
        let newX = resizing.startPosX
        let newY = resizing.startPosY
        
        if (resizing.corner === 'se') {
          newWidth = Math.max(100, resizing.startWidth + deltaX)
          newHeight = Math.max(50, resizing.startHeight + deltaY)
        } else if (resizing.corner === 'sw') {
          newWidth = Math.max(100, resizing.startWidth - deltaX)
          newHeight = Math.max(50, resizing.startHeight + deltaY)
          newX = resizing.startPosX + deltaX / 2
        } else if (resizing.corner === 'ne') {
          newWidth = Math.max(100, resizing.startWidth + deltaX)
          newHeight = Math.max(50, resizing.startHeight - deltaY)
          newY = resizing.startPosY + deltaY / 2
        } else if (resizing.corner === 'nw') {
          newWidth = Math.max(100, resizing.startWidth - deltaX)
          newHeight = Math.max(50, resizing.startHeight - deltaY)
          newX = resizing.startPosX + deltaX / 2
          newY = resizing.startPosY + deltaY / 2
        }
        
        updateClip(resizing.clipId, {
          size: { width: newWidth, height: newHeight },
          position: { x: newX, y: newY }
        })
      }
    }

    const handleMouseUp = () => {
      setDragging(null)
      setResizing(null)
    }

    if (dragging || resizing) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [dragging, resizing, updateClip])

  useEffect(() => () => { 
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current) 
  }, [])

  const allVideoClips = getNormalizedVideoClips()
  const allAudioClips = getNormalizedAudioClips()
  const allTextClips = getNormalizedTextClips()
  const activeTexts = allTextClips.filter(clip =>
    playheadPosition >= clip.timelineStart && playheadPosition < clip.timelineEnd
  )

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
        background: "#000",
        overflow: "hidden" // CRITICAL: prevents escape
      }}
    >
      {/* Canvas for normal rendering */}
      <canvas
        ref={canvasRef}
        width={PREVIEW_WIDTH}
        height={PREVIEW_HEIGHT}
        style={{
          maxWidth: "100%",
          maxHeight: "100%",
          objectFit: "contain",
          borderRadius: "8px",
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 1
        }}
      />

      {/* Transition Container - ensures video layers stay contained */}
      <div
        className="transition-container"
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "100%",
          height: "100%",
          maxWidth: "100%",
          maxHeight: "100%",
          overflow: "hidden", // CRITICAL: clips content
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none"
        }}
      >
        {/* Video Layer A - for transitions */}
        <video
          ref={videoLayerARef}
          muted={false}
          playsInline
          preload="auto"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: "none",
            transformOrigin: "center center",
            willChange: "transform, opacity, filter",
            transition: "none", // Disable CSS transitions for immediate updates
            zIndex: 2
          }}
        />

        {/* Video Layer B - for transitions */}
        <video
          ref={videoLayerBRef}
          muted={false}
          playsInline
          preload="auto"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: "none",
            transformOrigin: "center center",
            willChange: "transform, opacity, filter",
            transition: "none", // Disable CSS transitions for immediate updates
            zIndex: 3
          }}
        />
      </div>

      {activeTexts.map(clip => {
        const style = clip.textStyle || {}
        const canvas = canvasRef.current
        const preview = previewRef.current
        
        if (!canvas || !preview) return null
        
        const canvasRect = canvas.getBoundingClientRect()
        const previewRect = preview.getBoundingClientRect()
        
        const scaleX = canvasRect.width / PREVIEW_WIDTH
        const scaleY = canvasRect.height / PREVIEW_HEIGHT
        
        const posX = clip.position?.x || PREVIEW_WIDTH / 2
        const posY = clip.position?.y || PREVIEW_HEIGHT / 2
        const width = clip.size?.width || 400
        const height = clip.size?.height || 100
        
        const displayX = canvasRect.left - previewRect.left + (posX * scaleX)
        const displayY = canvasRect.top - previewRect.top + (posY * scaleY)
        const displayWidth = width * scaleX
        const displayHeight = height * scaleY
        
        const isSelected = clip.clip_id === selectedClipId
        const isDragging = dragging?.clipId === clip.clip_id
        const isResizing = resizing?.clipId === clip.clip_id
        const isEditing = editingText === clip.clip_id
        
        return (
          <div
            key={clip.clip_id}
            onMouseDown={(e) => handleTextMouseDown(e, clip)}
            onDoubleClick={(e) => handleTextDoubleClick(e, clip)}
            style={{
              position: 'absolute',
              left: `${displayX}px`,
              top: `${displayY}px`,
              transform: 'translate(-50%, -50%)',
              width: `${displayWidth}px`,
              height: `${displayHeight}px`,
              cursor: isDragging ? 'grabbing' : (isEditing ? 'text' : 'grab'),
              fontSize: `${(style.fontSize || 48) * scaleY}px`,
              fontFamily: style.fontFamily || 'Arial',
              fontWeight: style.fontWeight || 'bold',
              color: style.color || '#FFFFFF',
              backgroundColor: style.backgroundColor || 'transparent',
              padding: '10px 20px',
              borderRadius: '12px',
              textAlign: style.textAlign || 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isSelected 
                ? '0 0 0 3px #22d3ee, 0 4px 16px rgba(0, 0, 0, 0.5)' 
                : '0 4px 12px rgba(0, 0, 0, 0.5)',
              border: isSelected ? '2px solid #22d3ee' : '2px solid transparent',
              userSelect: isEditing ? 'text' : 'none',
              wordWrap: 'break-word',
              pointerEvents: isPlaying ? 'none' : 'auto',
              transition: isDragging || isResizing ? 'none' : 'box-shadow 0.2s',
              outline: isEditing ? '2px solid #22d3ee' : 'none',
              outlineOffset: '2px'
            }}
          >
            {isEditing ? (
              <textarea
                data-clip-id={clip.clip_id}
                value={clip.text || ''}
                onChange={(e) => handleTextChange(clip.clip_id, e.target.value)}
                onBlur={handleTextBlur}
                onKeyDown={(e) => handleTextKeyDown(e, clip.clip_id)}
                placeholder="Type your text here..."
                style={{
                  width: '100%',
                  height: '100%',
                  outline: 'none',
                  border: 'none',
                  background: 'transparent',
                  color: 'inherit',
                  fontSize: 'inherit',
                  fontFamily: 'inherit',
                  fontWeight: 'inherit',
                  textAlign: style.textAlign || 'center',
                  resize: 'none',
                  overflow: 'hidden',
                  padding: '0',
                  margin: '0'
                }}
              />
            ) : (
              <span>{clip.text || 'Double click to edit'}</span>
            )}
            
            {isSelected && !isPlaying && !isEditing && (
              <>
                <div
                  onMouseDown={(e) => handleResizeMouseDown(e, clip, 'nw')}
                  style={{
                    position: 'absolute',
                    top: '-6px',
                    left: '-6px',
                    width: '14px',
                    height: '14px',
                    background: '#22d3ee',
                    border: '2px solid white',
                    borderRadius: '50%',
                    cursor: 'nw-resize',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                    zIndex: 10
                  }}
                />
                <div
                  onMouseDown={(e) => handleResizeMouseDown(e, clip, 'ne')}
                  style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-6px',
                    width: '14px',
                    height: '14px',
                    background: '#22d3ee',
                    border: '2px solid white',
                    borderRadius: '50%',
                    cursor: 'ne-resize',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                    zIndex: 10
                  }}
                />
                <div
                  onMouseDown={(e) => handleResizeMouseDown(e, clip, 'sw')}
                  style={{
                    position: 'absolute',
                    bottom: '-6px',
                    left: '-6px',
                    width: '14px',
                    height: '14px',
                    background: '#22d3ee',
                    border: '2px solid white',
                    borderRadius: '50%',
                    cursor: 'sw-resize',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                    zIndex: 10
                  }}
                />
                <div
                  onMouseDown={(e) => handleResizeMouseDown(e, clip, 'se')}
                  style={{
                    position: 'absolute',
                    bottom: '-6px',
                    right: '-6px',
                    width: '14px',
                    height: '14px',
                    background: '#22d3ee',
                    border: '2px solid white',
                    borderRadius: '50%',
                    cursor: 'se-resize',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                    zIndex: 10
                  }}
                />
              </>
            )}
          </div>
        )
      })}

      <div style={{ display: "none" }}>
        {allVideoClips.map(clip => (
          <video 
            key={clip.clip_id} 
            ref={el => videoRefs.current[clip.clip_id] = el} 
            src={clip.src} 
            muted={false} 
            playsInline 
            preload="auto" 
          />
        ))}
        {allAudioClips.map(clip => (
          <audio 
            key={clip.clip_id} 
            ref={el => audioRefs.current[clip.clip_id] = el} 
            src={clip.src} 
            preload="auto" 
          />
        ))}
      </div>

      <button 
        onClick={togglePlay} 
        style={{ 
          position: "absolute", 
          bottom: "20px", 
          width: "64px", 
          height: "64px", 
          borderRadius: "50%", 
          background: isPlaying ? "rgba(239, 68, 68, 0.95)" : "rgba(59, 130, 246, 0.95)", 
          border: "none", 
          color: "white", 
          fontSize: "24px", 
          cursor: "pointer", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center", 
          boxShadow: "0 4px 16px rgba(0,0,0,0.5)", 
          transition: "all 0.2s", 
          zIndex: 999 
        }} 
        onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.1)"} 
        onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
      >
        {isPlaying ? "⏸" : "▶"}
      </button>

      <div style={{ 
        position: "absolute", 
        top: "20px", 
        left: "20px",
        background: "rgba(0,0,0,0.8)", 
        color: "white", 
        padding: "10px 20px", 
        borderRadius: "24px", 
        fontSize: "15px", 
        fontWeight: "600",
        boxShadow: "0 4px 12px rgba(0,0,0,0.4)"
      }}>
        Timeline: {playheadPosition.toFixed(1)}s
      </div>

      {allVideoClips.length === 0 && (
        <div style={{ 
          position: "absolute", 
          color: "rgba(255,255,255,0.4)", 
          fontSize: "18px", 
          textAlign: "center",
          fontWeight: "500"
        }}>
          No video clips<br /><span style={{ fontSize: "14px" }}>Add videos to see preview</span>
        </div>
      )}
    </div>
  )
}