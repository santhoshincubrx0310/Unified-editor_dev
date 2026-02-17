// src/components/editor/Clip.jsx
import { useEditorStore } from "../../store/editorStore"
import { normalizeTimeline } from "../../utils/timelineUtils"
import { useRef, useEffect, useState } from "react"

const SNAP_THRESHOLD = 10 // pixels
const SNAP_DISTANCE = 0.2 // seconds

export default function Clip({ clip, trackType, trackHeight, pixelsPerSecond }) {
  const zoom = pixelsPerSecond || useEditorStore((s) => s.timeline.zoom_level)
  const timeline = useEditorStore((s) => s.timeline)
  const moveClip = useEditorStore((s) => s.moveClip)
  const trimClipLeft = useEditorStore((s) => s.trimClipLeft)
  const trimClipRight = useEditorStore((s) => s.trimClipRight)
  const deleteClip = useEditorStore((s) => s.deleteClip)
  const selectedClipId = useEditorStore((s) => s.timeline.selectedClipId)
  const selectClip = useEditorStore((s) => s.selectClip)
  const currentTime = useEditorStore((s) => s.currentTime)

  const isSelected = selectedClipId === clip.clip_id
  const dragMode = useRef(null)
  const startX = useRef(0)
  const startClipStart = useRef(0)
  const startClipEnd = useRef(0)

  const [filmstripUrl, setFilmstripUrl] = useState(null)
  const [snapGuide, setSnapGuide] = useState(null)

  const clipLeft = (clip.timelineStart ?? clip.start) * zoom
  const clipWidth = (clip.duration ?? (clip.end - clip.start)) * zoom
  const clipHeightValue = trackHeight ? trackHeight - 8 : 60

  useEffect(() => {
    if (clip.type !== "video" || !clip.src || clipWidth < 50) return

    let cancelled = false
    const generateFilmstrip = async () => {
      try {
        const video = document.createElement('video')
        video.src = clip.src
        video.crossOrigin = "anonymous"
        video.muted = true
        
        await new Promise((resolve, reject) => {
          video.onloadedmetadata = resolve
          video.onerror = reject
          setTimeout(reject, 5000)
        })

        if (cancelled) return

        const frameWidth = 60
        const frameHeight = clipHeightValue
        const numFrames = Math.max(3, Math.ceil(clipWidth / frameWidth))
        
        const canvas = document.createElement('canvas')
        canvas.width = frameWidth * numFrames
        canvas.height = frameHeight
        const ctx = canvas.getContext('2d')

        for (let i = 0; i < numFrames && !cancelled; i++) {
          const time = (video.duration / numFrames) * i
          video.currentTime = Math.min(time, video.duration - 0.1)
          await new Promise((resolve) => { 
            video.onseeked = resolve
            setTimeout(resolve, 100)
          })
          if (!cancelled) {
            ctx.drawImage(video, i * frameWidth, 0, frameWidth, frameHeight)
          }
        }

        if (!cancelled) {
          setFilmstripUrl(canvas.toDataURL())
        }
      } catch (err) {
        console.warn('Filmstrip generation skipped')
      }
    }

    generateFilmstrip()
    return () => { cancelled = true }
  }, [clip.src, clip.type, clipWidth, clipHeightValue])

  // Get all snap points (other clips, playhead)
  const getSnapPoints = () => {
    const points = []

    // Add playhead as snap point
    points.push(currentTime)

    // Add all other clips' normalized boundaries as snap points
    for (const track of timeline.tracks) {
      if (track.clips) {
        const normalized = track.type === 'video'
          ? normalizeTimeline(track.clips, timeline.transitions || [])
          : track.clips.map(c => ({ ...c, timelineStart: c.start, timelineEnd: c.end }))

        for (const otherClip of normalized) {
          if (otherClip.clip_id !== clip.clip_id) {
            points.push(otherClip.timelineStart)
            points.push(otherClip.timelineEnd)
          }
        }
      }
    }

    return points
  }

  const findSnapPoint = (targetTime) => {
    const snapPoints = getSnapPoints()
    let closestSnap = null
    let minDistance = SNAP_DISTANCE

    for (const point of snapPoints) {
      const distance = Math.abs(targetTime - point)
      if (distance < minDistance) {
        minDistance = distance
        closestSnap = point
      }
    }

    return closestSnap
  }

  const onMouseDown = (e, mode) => {
    e.preventDefault()
    e.stopPropagation()

    dragMode.current = mode
    startX.current = e.clientX
    startClipStart.current = clip.start
    startClipEnd.current = clip.end

    const handleMouseMove = (e) => {
      const deltaX = e.clientX - startX.current
      const deltaTime = deltaX / zoom
      let newPosition = null

      if (mode === "move") {
        let targetStart = startClipStart.current + deltaTime

        // Check for snap points
        const snapToStart = findSnapPoint(targetStart)
        const clipDuration = clip.end - clip.start
        const snapToEnd = findSnapPoint(targetStart + clipDuration)

        if (snapToStart !== null) {
          targetStart = snapToStart
          setSnapGuide(snapToStart)
        } else if (snapToEnd !== null) {
          targetStart = snapToEnd - clipDuration
          setSnapGuide(snapToEnd)
        } else {
          setSnapGuide(null)
        }

        moveClip(clip.clip_id, targetStart)
      } else if (mode === "trim-left") {
        let targetStart = startClipStart.current + deltaTime
        const snapPoint = findSnapPoint(targetStart)

        if (snapPoint !== null) {
          targetStart = snapPoint
          setSnapGuide(snapPoint)
        } else {
          setSnapGuide(null)
        }

        trimClipLeft(clip.clip_id, targetStart)
      } else if (mode === "trim-right") {
        let targetEnd = startClipEnd.current + deltaTime
        const snapPoint = findSnapPoint(targetEnd)

        if (snapPoint !== null) {
          targetEnd = snapPoint
          setSnapGuide(snapPoint)
        } else {
          setSnapGuide(null)
        }

        trimClipRight(clip.clip_id, targetEnd)
      }
    }

    const handleMouseUp = () => {
      dragMode.current = null
      setSnapGuide(null)
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
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
        background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
        borderLeft: '3px solid #22d3ee'
      }
    }
    return { background: '#1e293b' }
  }

  return (
    <>
      {/* Snap Guide Line */}
      {snapGuide !== null && (
        <div
          style={{
            position: 'absolute',
            left: `${snapGuide * zoom}px`,
            top: '-10px',
            bottom: '-10px',
            width: '2px',
            background: '#fbbf24',
            boxShadow: '0 0 8px rgba(251, 191, 36, 0.6)',
            zIndex: 50,
            pointerEvents: 'none'
          }}
        />
      )}

      <div
        style={{
          position: "absolute",
          left: `${clipLeft}px`,
          top: '4px',
          width: `${Math.max(clipWidth, 50)}px`,
          height: `${clipHeightValue}px`,
          ...getClipStyle(),
          border: isSelected ? '2px solid #22d3ee' : '1px solid rgba(255,255,255,0.1)',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: dragMode.current ? 'grabbing' : 'grab',
          userSelect: 'none',
          overflow: 'hidden',
          boxShadow: isSelected
            ? '0 0 0 3px rgba(34, 211, 238, 0.3), 0 4px 12px rgba(0, 0, 0, 0.4)'
            : '0 2px 8px rgba(0, 0, 0, 0.3)',
          zIndex: isSelected ? 20 : 10
        }}
        onClick={(e) => {
          e.stopPropagation()
          selectClip(clip.clip_id)
        }}
        onMouseDown={(e) => onMouseDown(e, "move")}
      >
      {clip.type === "video" && !filmstripUrl && (
        <div style={{ color: "rgba(255, 255, 255, 0.5)", fontSize: "11px", fontWeight: '500' }}>
          Loading...
        </div>
      )}

      {clip.type === "audio" && (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>🎵</span>
          {clipWidth > 80 && <span style={{ color: 'white', fontSize: '13px', fontWeight: '600' }}>Audio</span>}
        </div>
      )}

      {clip.type === "text" && (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>📝</span>
          {clipWidth > 80 && (
            <span style={{ color: 'white', fontSize: '12px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {clip.text || "Text"}
            </span>
          )}
        </div>
      )}

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
        <div style={{ width: '2px', height: '24px', background: isSelected ? '#22d3ee' : 'rgba(255, 255, 255, 0.6)', borderRadius: '1px' }} />
      </div>
      
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
        <div style={{ width: '2px', height: '24px', background: isSelected ? '#22d3ee' : 'rgba(255, 255, 255, 0.6)', borderRadius: '1px' }} />
      </div>

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
      </div>
    </>
  )
}