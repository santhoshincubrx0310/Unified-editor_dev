// src/api/sessionApi.js
//
// API client for the editor backend.
//
// Key design decisions:
//   - createSession() only sends content_id — never user_id
//   - user_id is handled by the API gateway (X-User-ID header)
//   - All errors are thrown so callers can handle them properly
//   - BASE_URL from env — works across dev/staging/production without code changes

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8087/api/v1"
const DEV_USER_ID = "11111111-1111-1111-1111-111111111111"


// createSession: creates or retrieves an existing session for this content.
// Backend uses FindOrCreate — safe to call on every page load without creating orphans.
export async function createSession(contentId) {
  const res = await fetch(`${BASE_URL}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json","X-User-ID": DEV_USER_ID },
    body: JSON.stringify({
      content_id: contentId,
      // No user_id here — comes from X-User-ID header injected by API gateway
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown error" }))
    throw new Error(err.error || `createSession failed: ${res.status}`)
  }

  return res.json()
}

// saveSession: persists the current timeline state.
export async function saveSession(sessionId, timeline) {
  const res = await fetch(`${BASE_URL}/sessions/${sessionId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json","X-User-ID": DEV_USER_ID },
    body: JSON.stringify({ timeline }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown error" }))
    throw new Error(err.error || `saveSession failed: ${res.status}`)
  }

  return res.json()
}

// deleteSession: permanently removes the session.
export async function deleteSession(sessionId) {
  const res = await fetch(`${BASE_URL}/sessions/${sessionId}`, {
    method: "DELETE",
    headers: {
  "X-User-ID": DEV_USER_ID,   
},

  }
)

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown error" }))
    throw new Error(err.error || `deleteSession failed: ${res.status}`)
  }

  return res.json()
}

// uploadFile: uploads a media file and returns its URL.
export async function uploadFile(file) {
  const formData = new FormData()
  formData.append("file", file)

  const res = await fetch(`${BASE_URL}/upload`, {
    method: "POST",
    body: formData,
    headers: {
  "X-User-ID": DEV_USER_ID,   
},

  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown error" }))
    throw new Error(err.error || `uploadFile failed: ${res.status}`)
  }

  return res.json() // { file_url: "..." }
}