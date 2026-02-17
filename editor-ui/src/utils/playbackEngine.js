// src/utils/playbackEngine.js
//
// Continuous Timeline Playback Engine
// Provides smooth playback across multiple clips without reload delays

/**
 * Gets the active clip and local playback time for a given timeline position.
 * Expects NORMALIZED clips (with timelineStart / timelineEnd from normalizeTimeline).
 *
 * @param {Array} clips - Normalized clip objects (must have timelineStart, timelineEnd)
 * @param {number} currentTime - Current timeline position in seconds
 * @param {Array} transitions - Array of transition objects
 * @returns {Object} { clip, localTime, nextClip, transition, isInTransition, transitionProgress }
 */
export function getClipAtTime(clips, currentTime, transitions = []) {
  if (!clips || clips.length === 0) {
    return { clip: null, localTime: 0, nextClip: null, transition: null, isInTransition: false, transitionProgress: 0 }
  }

  // Find active clip using normalized timeline positions
  let activeClip = null
  let nextClip = null

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i]
    if (currentTime >= clip.timelineStart && currentTime <= clip.timelineEnd) {
      activeClip = clip
      nextClip = clips[i + 1] || null
      break
    }
  }

  if (!activeClip) {
    // Before first clip
    if (currentTime < clips[0].timelineStart) {
      return { clip: null, localTime: 0, nextClip: clips[0], transition: null, isInTransition: false, transitionProgress: 0 }
    }
    // After last clip – return last clip to guarantee continuous playback
    activeClip = clips[clips.length - 1]
    return { clip: activeClip, localTime: 0, nextClip: null, transition: null, isInTransition: false, transitionProgress: 0 }
  }

  // Calculate local time within the clip using timelineStart
  const timeIntoClip = currentTime - activeClip.timelineStart
  const trimStart = activeClip.trim_start || 0
  const localTime = trimStart + timeIntoClip

  // Check if we're in a transition zone
  let transition = null
  let isInTransition = false
  let transitionProgress = 0

  if (nextClip && transitions) {
    transition = transitions.find(
      t => t.fromClipId === activeClip.clip_id && t.toClipId === nextClip.clip_id
    )

    if (transition) {
      // Transition boundary: overlap region at the end of activeClip
      const transitionStart = activeClip.timelineEnd - transition.duration
      isInTransition = currentTime >= transitionStart && currentTime <= activeClip.timelineEnd

      if (isInTransition) {
        transitionProgress = Math.max(0, Math.min(1,
          (currentTime - transitionStart) / transition.duration
        ))
      }
    }
  }

  return {
    clip: activeClip,
    localTime: Math.max(0, localTime),
    nextClip,
    transition,
    isInTransition,
    transitionProgress
  }
}

/**
 * Calculates transition blend factor for smooth visual transitions
 * @param {string} type - Transition type (fade, crossfade, slide-left, etc.)
 * @param {number} progress - Progress from 0 to 1
 * @returns {Object} { fromOpacity, toOpacity, fromTransform, toTransform }
 */
export function getTransitionBlend(type, progress) {
  const easeInOut = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t

  switch (type) {
    case 'fade':
      return {
        fromOpacity: 1 - easeInOut(progress),
        toOpacity: easeInOut(progress),
        fromTransform: 'translate(0, 0) scale(1)',
        toTransform: 'translate(0, 0) scale(1)'
      }

    case 'crossfade':
      return {
        fromOpacity: 1 - progress,
        toOpacity: progress,
        fromTransform: 'translate(0, 0) scale(1)',
        toTransform: 'translate(0, 0) scale(1)'
      }

    case 'slide-left':
      return {
        fromOpacity: 1,
        toOpacity: 1,
        fromTransform: `translateX(-${progress * 100}%)`,
        toTransform: `translateX(${(1 - progress) * 100}%)`
      }

    case 'slide-right':
      return {
        fromOpacity: 1,
        toOpacity: 1,
        fromTransform: `translateX(${progress * 100}%)`,
        toTransform: `translateX(-${(1 - progress) * 100}%)`
      }

    case 'zoom':
      return {
        fromOpacity: 1 - progress,
        toOpacity: progress,
        fromTransform: `scale(${1 + progress * 0.2})`,
        toTransform: `scale(${1 - progress * 0.2 + 1})`
      }

    case 'blur':
      return {
        fromOpacity: 1 - progress,
        toOpacity: progress,
        fromTransform: 'translate(0, 0) scale(1)',
        toTransform: 'translate(0, 0) scale(1)',
        fromFilter: `blur(${progress * 10}px)`,
        toFilter: `blur(${(1 - progress) * 10}px)`
      }

    default:
      return {
        fromOpacity: 1,
        toOpacity: 0,
        fromTransform: 'translate(0, 0) scale(1)',
        toTransform: 'translate(0, 0) scale(1)'
      }
  }
}

/**
 * Gets all clips sorted by start time from timeline tracks
 * @param {Array} tracks - Timeline tracks array
 * @param {string} type - Track type filter (video, audio, text)
 * @returns {Array} Sorted clips array
 */
export function getClipsByType(tracks, type) {
  return tracks
    .filter(track => track.type === type)
    .flatMap(track => track.clips || [])
    .sort((a, b) => a.start - b.start)
}

/**
 * Checks if clips have gaps between them
 * @param {Array} clips - Sorted clips array
 * @returns {boolean} True if there are gaps
 */
export function hasGapsBetweenClips(clips) {
  for (let i = 0; i < clips.length - 1; i++) {
    if (clips[i].end < clips[i + 1].start) {
      return true
    }
  }
  return false
}

/**
 * Auto-arranges clips without gaps (for highlight mode)
 * @param {Array} clips - Clips array
 * @returns {Array} Rearranged clips
 */
export function autoArrangeClips(clips) {
  if (!clips || clips.length === 0) return []

  let currentPosition = 0
  return clips.map(clip => {
    const duration = clip.end - clip.start
    const newClip = {
      ...clip,
      start: currentPosition,
      end: currentPosition + duration
    }
    currentPosition += duration
    return newClip
  })
}
