// src/store/editorStore.js
import { create } from "zustand"

export const useEditorStore = create((set, get) => ({
  sessionId: null,

  timeline: {
    duration: 120,
    zoom_level: 5,
    playhead_position: 0,
    selectedClipId: null,
    tracks: []
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

  loadTimeline: (timelineData) =>
    set((state) => ({
      timeline: {
        ...state.timeline,
        ...timelineData,
        playhead_position: 0,
        selectedClipId: null
      }
    })),

  addTrack: (type) =>
    set((state) => {
      // Check if track of this type already exists
      const trackExists = state.timeline.tracks.some(track => track.type === type)
      
      if (trackExists) {
        console.warn(`${type} track already exists. Only one track per type allowed.`)
        return state // Don't add, return unchanged state
      }
      
      return {
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
      }
    }),

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
          
          // Calculate duration from end if start not provided
          const duration = clipData.end - (clipData.start || 0)
          
          return {
            ...track,
            clips: [
              ...track.clips,
              {
                ...clipData,
                start: clipData.start !== undefined ? clipData.start : 0,
                end: clipData.start !== undefined ? clipData.start + duration : duration,
                trim_start: clipData.trim_start || 0,
                trim_end: clipData.trim_end || duration,
                position: clipData.position || (clipData.type === 'text' ? { x: 640, y: 360 } : undefined),
                size: clipData.size || (clipData.type === 'text' ? { width: 400, height: 100 } : undefined)
              }
            ]
          }
        })
      }
    })),

  updateClip: (clipId, updates) =>
    set((state) => ({
      timeline: {
        ...state.timeline,
        tracks: state.timeline.tracks.map((track) => ({
          ...track,
          clips: track.clips.map((clip) =>
            clip.clip_id === clipId ? { ...clip, ...updates } : clip
          )
        }))
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
            const clampedStart = Math.max(0, Math.min(Math.round(newStart * 2) / 2, maxStart))
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
            const minDuration = 0.5
            const maxStart = clip.end - minDuration
            const clampedStart = Math.max(0, Math.min(newStart, maxStart))
            const trimDelta = clampedStart - clip.start
            return {
              ...clip,
              start: clampedStart,
              trim_start: (clip.trim_start || 0) + trimDelta
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
            const minDuration = 0.5
            const maxEnd = state.timeline.duration
            const minEnd = clip.start + minDuration
            const clampedEnd = Math.max(minEnd, Math.min(newEnd, maxEnd))
            return {
              ...clip,
              end: clampedEnd,
              trim_end: (clip.trim_start || 0) + (clampedEnd - clip.start)
            }
          })
        }))
      }
    })),

  splitClip: (clipId) =>
    set((state) => {
      const playheadPos = state.timeline.playhead_position
      return {
        timeline: {
          ...state.timeline,
          tracks: state.timeline.tracks.map((track) => {
            const clipToSplit = track.clips.find(c => c.clip_id === clipId)
            if (!clipToSplit) return track
            if (playheadPos <= clipToSplit.start || playheadPos >= clipToSplit.end) return track

            const timeInClip = playheadPos - clipToSplit.start
            const leftClip = {
              ...clipToSplit,
              clip_id: `${clipToSplit.clip_id}_L${Date.now()}`,
              end: playheadPos,
              trim_end: (clipToSplit.trim_start || 0) + timeInClip
            }

            const rightClip = {
              ...clipToSplit,
              clip_id: `${clipToSplit.clip_id}_R${Date.now()}`,
              start: playheadPos,
              trim_start: (clipToSplit.trim_start || 0) + timeInClip
            }

            return {
              ...track,
              clips: track.clips
                .filter(c => c.clip_id !== clipId)
                .concat([leftClip, rightClip])
                .sort((a, b) => a.start - b.start)
            }
          })
        }
      }
    }),

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