const BASE_URL = "http://localhost:8083";

// Create session
export async function createSession(userId, contentId) {
  const response = await fetch(`${BASE_URL}/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: userId,
      content_id: contentId,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to create session");
  }

  return response.json();
}

// Get session
export async function getSession(sessionId) {
  const response = await fetch(`${BASE_URL}/sessions/${sessionId}`);

  if (!response.ok) {
    throw new Error("Failed to fetch session");
  }

  return response.json();
}

// Save session
export async function saveSession(sessionId, timeline) {
  const response = await fetch(`${BASE_URL}/sessions/${sessionId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeline,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to save session");
  }

  return response.json();
}

// Delete session
export async function deleteSession(sessionId) {
  const response = await fetch(`${BASE_URL}/sessions/${sessionId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to delete session");
  }

  return response.json();
}
export async function uploadFile(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("http://localhost:8083/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Upload failed");
  }

  return response.json();
}

