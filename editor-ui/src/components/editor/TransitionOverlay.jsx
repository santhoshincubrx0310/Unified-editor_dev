// src/components/editor/TransitionOverlay.jsx
import { useEditorStore, PIXELS_PER_SECOND } from "../../store/editorStore"

const TRANSITION_TYPES = [
  { value: 'none', label: 'None', icon: '→' },
  { value: 'fade', label: 'Fade', icon: '⟳' },
  { value: 'crossfade', label: 'Crossfade', icon: '⨯' },
  { value: 'slide-left', label: 'Slide Left', icon: '←' },
  { value: 'slide-right', label: 'Slide Right', icon: '→' },
  { value: 'zoom', label: 'Zoom', icon: '⊕' },
  { value: 'blur', label: 'Blur', icon: '◉' }
]

export default function TransitionOverlay({ fromClip, toClip, trackHeight }) {
  const timeline = useEditorStore((s) => s.timeline)
  const addTransition = useEditorStore((s) => s.addTransition)
  const removeTransition = useEditorStore((s) => s.removeTransition)
  const getTransition = useEditorStore((s) => s.getTransition)

  if (!fromClip || !toClip) return null

  const existingTransition = getTransition(fromClip.clip_id, toClip.clip_id)
  const transitionType = existingTransition?.type || 'none'
  const transitionDuration = existingTransition?.duration || 0.5

  const handleTransitionClick = (e) => {
    e.stopPropagation()

    // Cycle through transition types
    const currentIndex = TRANSITION_TYPES.findIndex(t => t.value === transitionType)
    const nextIndex = (currentIndex + 1) % TRANSITION_TYPES.length
    const nextType = TRANSITION_TYPES[nextIndex].value

    if (nextType === 'none') {
      removeTransition(fromClip.clip_id, toClip.clip_id)
    } else {
      addTransition(fromClip.clip_id, toClip.clip_id, nextType, transitionDuration)
    }
  }

  const handleDurationChange = (e) => {
    e.stopPropagation()
    const newDuration = parseFloat(e.target.value)
    if (newDuration > 0 && transitionType !== 'none') {
      addTransition(fromClip.clip_id, toClip.clip_id, transitionType, newDuration)
    }
  }

  // Calculate position and width using normalized timeline positions
  const fromEnd = fromClip.timelineEnd ?? fromClip.end
  const toStart = toClip.timelineStart ?? toClip.start
  const gapBetweenClips = toStart - fromEnd
  const hasGap = gapBetweenClips > 0

  // Position at the boundary between clips
  const leftPosition = fromEnd * timeline.zoom_level
  const width = hasGap
    ? gapBetweenClips * timeline.zoom_level
    : transitionType !== 'none'
      ? transitionDuration * timeline.zoom_level
      : 8 // Minimal width for button

  const currentTypeObj = TRANSITION_TYPES.find(t => t.value === transitionType)

  return (
    <div
      style={{
        position: 'absolute',
        left: `${leftPosition}px`,
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: `${Math.max(width, 8)}px`,
        height: hasGap ? `${trackHeight - 8}px` : 'auto',
        zIndex: 30,
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px'
      }}
    >
      {/* Transition Button */}
      <div
        onClick={handleTransitionClick}
        style={{
          background: transitionType !== 'none'
            ? 'linear-gradient(90deg, #a855f7, #ec4899)'
            : 'rgba(255,255,255,0.15)',
          border: '1px solid rgba(255,255,255,0.3)',
          borderRadius: '6px',
          padding: '4px 10px',
          fontSize: '10px',
          fontWeight: '600',
          color: '#FFFFFF',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          userSelect: 'none',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)'
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(168, 85, 247, 0.5)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)'
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)'
        }}
        title={`Click to cycle transitions\nCurrent: ${currentTypeObj?.label || 'None'}`}
      >
        {currentTypeObj?.icon || '→'} {currentTypeObj?.label || 'None'}
      </div>

      {/* Duration Input (only show if transition is active) */}
      {transitionType !== 'none' && (
        <input
          type="number"
          min="0.1"
          max="5"
          step="0.1"
          value={transitionDuration}
          onChange={handleDurationChange}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '50px',
            padding: '3px 6px',
            background: 'rgba(0,0,0,0.6)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '4px',
            color: '#FFFFFF',
            fontSize: '9px',
            textAlign: 'center',
            outline: 'none'
          }}
          title="Transition duration (seconds)"
        />
      )}

      {/* Visual transition indicator */}
      {transitionType !== 'none' && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'linear-gradient(90deg, rgba(168, 85, 247, 0.1), rgba(236, 72, 153, 0.1))',
            border: '1px dashed rgba(168, 85, 247, 0.4)',
            borderRadius: '4px',
            pointerEvents: 'none',
            zIndex: -1
          }}
        />
      )}
    </div>
  )
}
