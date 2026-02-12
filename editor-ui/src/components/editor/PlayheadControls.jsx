// src/components/editor/PlayheadControls.jsx
import { useEditorStore } from "../../store/editorStore"

export default function PlayheadControls() {
  const playheadPosition = useEditorStore((s) => s.timeline.playhead_position)
  const zoom = useEditorStore((s) => s.timeline.zoom_level)
  const setPlayhead = useEditorStore((s) => s.setPlayhead)

  const playheadX = playheadPosition * zoom

  const handlePlayheadDrag = (e) => {
    e.preventDefault()
    
    const timeline = e.currentTarget.parentElement
    const timelineRect = timeline.getBoundingClientRect()
    
    const handleMouseMove = (e) => {
      const x = e.clientX - timelineRect.left
      const newTime = Math.max(0, x / zoom)
      setPlayhead(newTime)
    }

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
  }

  return (
    <div
      onMouseDown={handlePlayheadDrag}
      style={{
        position: "absolute",
        left: `${playheadX}px`,
        top: "-8px",
        height: "calc(100% + 8px)",
        width: "2px",
        background: "#22d3ee",
        cursor: "ew-resize",
        zIndex: 100,
        pointerEvents: "auto"
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "0",
          left: "50%",
          transform: "translateX(-50%)",
          width: "12px",
          height: "12px",
          background: "#22d3ee",
          borderRadius: "50%",
          border: "2px solid white",
          boxShadow: "0 2px 8px rgba(34, 211, 238, 0.5)",
          cursor: "grab"
        }}
      />
    </div>
  )
}