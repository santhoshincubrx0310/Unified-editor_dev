// src/utils/timelineUtils.js
//
// Professional master timeline clock.
// Single source of truth for clip timing on the timeline.
//
// Architecture (matches CapCut / Premiere Pro / Final Cut):
//   1. TIMELINE TIME  – master clock, always starts at 0
//   2. CLIP POSITION  – timelineStart / timelineEnd on the master clock
//   3. MEDIA TIME     – sourceStart + (timelineTime - clip.timelineStart)
//
// Transitions overlap at clip boundaries (transitionStart = clipA.timelineEnd - duration).
// Clip positions themselves are NEVER shifted by transitions.

/**
 * Packs clips sequentially starting at timeline time 0.
 * First clip ALWAYS starts at timelineStart = 0.
 * No gaps between clips unless explicitly present in source data.
 *
 * @param {Array} clips  – Sorted array of clip objects (by clip.start)
 * @param {Array} _transitions – Kept for call-site compat; not used for positioning
 * @returns {Array} Clips augmented with timelineStart, timelineEnd, duration
 */
export function normalizeTimeline(clips, _transitions = []) {
  if (!clips || clips.length === 0) return []

  let currentTime = 0

  return clips.map((clip) => {
    const duration = clip.end - clip.start
    const timelineStart = currentTime
    const timelineEnd = currentTime + duration

    currentTime = timelineEnd

    return {
      ...clip,
      duration,
      timelineStart,
      timelineEnd
    }
  })
}

/**
 * Finds the active clip at a given timeline time.
 * Guarantees continuous playback – never returns null when clips exist.
 *
 * @param {number} time – Current timeline position in seconds
 * @param {Array}  normalizedClips – Output of normalizeTimeline()
 * @returns {Object|null} The active clip, or the last clip as fallback
 */
export function getClipAtTimelineTime(time, normalizedClips) {
  if (!normalizedClips || normalizedClips.length === 0) return null

  for (const clip of normalizedClips) {
    if (time >= clip.timelineStart && time <= clip.timelineEnd) {
      return clip
    }
  }

  // Fallback: return last clip so preview never enters "no active clip" state
  return normalizedClips[normalizedClips.length - 1]
}
