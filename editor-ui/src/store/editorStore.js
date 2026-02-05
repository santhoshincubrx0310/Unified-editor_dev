import { create } from "zustand"

export const useEditorStore = create((set, get) => ({
  sessionId: null,

  timeline: {
    duration: 120,
    zoom_level: 5,
    playhead_position: 0,
    selectedClipId: null,
    tracks: [] // NO PRE-BUILT TRACKS - user must add them
  },

  isPlaying: false,

  togglePlayPause: () =>
    set((state) => ({
      isPlaying: !state.isPlaying
    })),

  setPlayhead: (position) =>
    set((state) => ({
      timeline: {
        ...state.timeline,
        playhead_position: position
      }
    })),

  addTrack: (type) =>
    set((state) => ({
      timeline: {
        ...state.timeline,
        tracks: [
          ...state.timeline.tracks,
          {
            track_id: `track_${type}_${Date.now()}`,
            type,
            visible: true,
            muted: false,
            clips: []
          }
        ]
      }
    })),

  selectClip: (clipId) =>
    set((state) => ({
      timeline: {
        ...state.timeline,
        selectedClipId: clipId
      }
    })),

  addClip: (trackId, clipData) =>
    set((state) => ({
      timeline: {
        ...state.timeline,
        tracks: state.timeline.tracks.map((track) => {
          if (track.track_id !== trackId) return track

          return {
            ...track,
            clips: [
              ...track.clips,
              {
                ...clipData,
                trim_start: clipData.start,
                trim_end: clipData.end
              }
            ]
          }
        })
      }
    })),

  moveClip: (clipId, newStart) =>
    set((state) => ({
      timeline: {
        ...state.timeline,
        tracks: state.timeline.tracks.map((track) => ({
          ...track,
          clips: track.clips.map((clip) => {
            if (clip.clip_id !== clipId) return clip

            const duration = clip.end - clip.start
            const maxStart = state.timeline.duration - duration

            const clampedStart = Math.max(0, Math.min(Math.round(newStart), maxStart))

            return {
              ...clip,
              start: clampedStart,
              end: clampedStart + duration
            }
          })
        }))
      }
    })),

  deleteClip: (clipId) =>
    set((state) => ({
      timeline: {
        ...state.timeline,
        selectedClipId: null,
        tracks: state.timeline.tracks.map((track) => ({
          ...track,
          clips: track.clips.filter((clip) => clip.clip_id !== clipId)
        }))
      }
    })),

  trimClipLeft: (clipId, newStart) =>
    set((state) => ({
      timeline: {
        ...state.timeline,
        tracks: state.timeline.tracks.map((track) => ({
          ...track,
          clips: track.clips.map((clip) => {
            if (clip.clip_id !== clipId) return clip

            const minDuration = 1
            const maxStart = clip.end - minDuration

            const clampedStart = Math.max(0, Math.min(newStart, maxStart))

            return {
              ...clip,
              start: clampedStart,
              trim_start: clampedStart
            }
          })
        }))
      }
    })),

  trimClipRight: (clipId, newEnd) =>
    set((state) => ({
      timeline: {
        ...state.timeline,
        tracks: state.timeline.tracks.map((track) => ({
          ...track,
          clips: track.clips.map((clip) => {
            if (clip.clip_id !== clipId) return clip

            const minDuration = 1
            const maxEnd = state.timeline.duration
            const minEnd = clip.start + minDuration

            const clampedEnd = Math.max(minEnd, Math.min(newEnd, maxEnd))

            return {
              ...clip,
              end: clampedEnd,
              trim_end: clampedEnd
            }
          })
        }))
      }
    })),

  zoomIn: () =>
    set((state) => ({
      timeline: {
        ...state.timeline,
        zoom_level: Math.min(state.timeline.zoom_level + 2, 50)
      }
    })),

  zoomOut: () =>
    set((state) => ({
      timeline: {
        ...state.timeline,
        zoom_level: Math.max(state.timeline.zoom_level - 2, 2)
      }
    }))
}))