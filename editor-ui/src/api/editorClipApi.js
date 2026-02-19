// src/api/editorClipApi.js
//
// API client for fetching clip metadata from the Repurposer backend.
// Uses Vite proxy paths — no hardcoded URLs.
// Proxy: /api/repurposer/clips → localhost:8083
// Proxy: /api/editor → localhost:8087

import { getCurrentUser } from '../services/authService';

/**
 * Get auth headers from current user session (reuses your existing auth)
 */
async function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    try {
        const user = await getCurrentUser();
        if (user) {
            headers['X-User-ID'] = user.userId || user.sub;
            headers['X-User-Email'] = user.email || '';
            headers['X-User-Name'] = user.name || '';
        }
    } catch (e) {
        console.warn('Auth headers unavailable:', e);
    }
    return headers;
}

/**
 * Fetches clips for a given content ID from the Repurposer backend.
 * Route: /api/repurposer/clips/{contentId} → Vite proxy → localhost:8083
 */
export async function fetchClips(contentId) {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/repurposer/clips/${contentId}`, {
        method: 'GET',
        headers,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'unknown error' }));
        throw new Error(err.error || `fetchClips failed: ${res.status}`);
    }

    const data = await res.json();
    return data.clips || [];
}

/**
 * Creates a highlight reel session from selected clips.
 * Route: /api/editor/highlight/create → Vite proxy → localhost:8087/api/v1/highlight/create
 */
export async function createHighlightSession(contentId, clipIds, targetDuration, options = {}) {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/editor/highlight/create', {
        method: 'POST',
        headers,
        body: JSON.stringify({
            content_id: contentId,
            clip_ids: clipIds,
            target_duration: targetDuration,
            source_asset_id: options.sourceAssetId,
            source_job_id: options.sourceJobId,
            source_module: options.sourceModule || 'repurposer',
            platform: options.platform,
        }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'unknown error' }));
        throw new Error(err.error || `createHighlightSession failed: ${res.status}`);
    }

    return res.json();
}
