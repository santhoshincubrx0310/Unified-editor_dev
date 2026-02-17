// src/api/clipApi.js
//
// API client for fetching clip metadata from the Repurposer backend.
// Used by ClipLibraryPanel to display available clips for editing.

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8087/api/v1"
const DEV_USER_ID = "11111111-1111-1111-1111-111111111111"

/**
 * Fetches clips for a given content ID from the Repurposer backend.
 * Returns an array of clip objects with metadata.
 *
 * @param {string} contentId - UUID of the content to fetch clips for
 * @returns {Promise<Array>} Array of RepurposerClip objects
 */
export async function fetchClips(contentId) {
  const res = await fetch(`${BASE_URL}/clips/${contentId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-User-ID": DEV_USER_ID
    },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown error" }))
    throw new Error(err.error || `fetchClips failed: ${res.status}`)
  }

  const data = await res.json()
  return data.clips || []
}

/**
 * Creates a highlight reel session from selected clips.
 * Calls the backend to create a new session with the clips preloaded.
 *
 * @param {string} contentId - UUID of the source content
 * @param {Array<string>} clipIds - Array of clip IDs to include
 * @param {number} targetDuration - Target duration for the highlight reel in seconds
 * @param {Object} options - Optional source tracking metadata
 * @returns {Promise<Object>} Created session object
 */
export async function createHighlightSession(contentId, clipIds, targetDuration, options = {}) {
  const res = await fetch(`${BASE_URL}/highlight/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-ID": DEV_USER_ID
    },
    body: JSON.stringify({
      content_id: contentId,
      clip_ids: clipIds,
      target_duration: targetDuration,
      source_asset_id: options.sourceAssetId,
      source_job_id: options.sourceJobId,
      source_module: options.sourceModule || "editor-ui",
      platform: options.platform
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown error" }))
    throw new Error(err.error || `createHighlightSession failed: ${res.status}`)
  }

  return res.json()
}
