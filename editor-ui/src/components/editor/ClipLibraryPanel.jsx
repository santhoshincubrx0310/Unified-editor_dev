// src/components/editor/ClipLibraryPanel.jsx
import { useState, useEffect } from "react"
import { fetchClips } from "../../api/editorClipApi"

export default function ClipLibraryPanel({ contentId, jobId, onClipDragStart }) {
  const [clips, setClips] = useState([])
  const [hubClips, setHubClips] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [filterPlatform, setFilterPlatform] = useState("all")
  const [sortBy, setSortBy] = useState("score")
  const [hoveredClip, setHoveredClip] = useState(null)
  const [sourceTab, setSourceTab] = useState("recent") // "recent" | "hub"

  // Load recent clips from repurposer
  useEffect(() => {
    if (!contentId) return

    async function loadClips() {
      setLoading(true)
      setError(null)
      try {
        const fetchedClips = await fetchClips(contentId)
        // If jobId provided, filter to only clips from that job
        if (jobId) {
          const jobFiltered = fetchedClips.filter(c =>
            c.clip_id && c.clip_id.startsWith(jobId.replace('job_', '').substring(0, 10))
            || c.clip_id && c.clip_id.includes(jobId)
          )
          // Use filtered if we got results, otherwise show all
          setClips(jobFiltered.length > 0 ? jobFiltered : fetchedClips)
        } else {
          setClips(fetchedClips)
        }
      } catch (err) {
        console.error("Failed to fetch clips:", err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadClips()
  }, [contentId, jobId])

  // Load Content Hub clips (video assets) when tab switches
  useEffect(() => {
    if (sourceTab !== "hub" || hubClips.length > 0) return

    async function loadHubClips() {
      setLoading(true)
      try {
        const res = await fetch("/api/assets", {
          headers: { "Content-Type": "application/json" }
        })
        if (res.ok) {
          const data = await res.json()
          const assets = (data.assets || data || []).filter(a =>
            a.content_type && (a.content_type.startsWith("video/") || a.content_type.includes("mp4"))
            || a.name && (a.name.endsWith(".mp4") || a.name.endsWith(".mov") || a.name.endsWith(".webm"))
          )
          const mapped = assets.map((a, idx) => ({
            clip_id: a.id || ("hub_" + idx),
            source_video: a.cloudfront_url || a.s3_url || "",
            s3_url: a.cloudfront_url || a.s3_url || "",
            duration: a.duration_seconds || 0,
            platform: "content_hub",
            score: 0,
            topic: a.name || "Untitled",
            title: a.name || "Untitled",
            asset_id: a.id || "",
          }))
          setHubClips(mapped)
        }
      } catch (err) {
        console.error("Failed to load Content Hub clips:", err)
      } finally {
        setLoading(false)
      }
    }

    loadHubClips()
  }, [sourceTab, hubClips.length])

  const activeClips = sourceTab === "recent" ? clips : hubClips

  const filteredAndSortedClips = activeClips
    .filter(clip => {
      if (filterPlatform === "all") return true
      return clip.platform === filterPlatform
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "score":   return (b.score || 0) - (a.score || 0)
        case "duration": return (b.duration || 0) - (a.duration || 0)
        case "platform": return (a.platform || "").localeCompare(b.platform || "")
        default: return 0
      }
    })

  const platforms = ["all", ...new Set(activeClips.map(c => c.platform).filter(Boolean))]

  const handleDragStart = (e, clip) => {
    e.dataTransfer.effectAllowed = "copy"
    e.dataTransfer.setData("application/json", JSON.stringify({
      type: "library-clip",
      clip: clip
    }))
    if (onClipDragStart) onClipDragStart(clip)
  }

  if (!contentId) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span style={styles.headerTitle}>Clip Library</span>
        </div>
        <div style={styles.emptyState}>No content ID provided</div>
      </div>
    )
  }

  return (
    <>
      {/* ✅ Global style fix for select dropdowns */}
      <style>{`
        .clip-library-select {
          appearance: none;
          -webkit-appearance: none;
          padding: 8px 32px 8px 12px;
          background: rgba(10, 14, 26, 0.95) !important;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2322d3ee' d='M6 8L1 3h10z'/%3E%3C/svg%3E") !important;
          background-repeat: no-repeat !important;
          background-position: right 10px center !important;
          border: 1px solid rgba(34, 211, 238, 0.3) !important;
          border-radius: 6px !important;
          color: #e2e8f0 !important;
          font-size: 13px !important;
          font-weight: 500 !important;
          cursor: pointer !important;
          outline: none !important;
          width: 100% !important;
          transition: border-color 0.2s, box-shadow 0.2s !important;
        }
        .clip-library-select:hover {
          border-color: rgba(34, 211, 238, 0.6) !important;
          box-shadow: 0 0 0 2px rgba(34, 211, 238, 0.1) !important;
        }
        .clip-library-select:focus {
          border-color: #22d3ee !important;
          box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.2) !important;
        }

        /* ✅ THIS is what fixes the white dropdown options */
        .clip-library-select option {
          background: #0a0e1a !important;
          color: #e2e8f0 !important;
          padding: 8px 12px !important;
          font-size: 13px !important;
        }
        .clip-library-select option:hover,
        .clip-library-select option:checked {
          background: #1e3a5f !important;
          color: #22d3ee !important;
        }

        .clip-card-hover:hover {
          background: linear-gradient(135deg, rgba(34, 211, 238, 0.08), rgba(59, 130, 246, 0.08)) !important;
          border-color: rgba(34, 211, 238, 0.4) !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 4px 16px rgba(34, 211, 238, 0.15) !important;
        }

        .clip-library-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .clip-library-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
        }
        .clip-library-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(34, 211, 238, 0.3);
          border-radius: 2px;
        }
        .clip-library-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(34, 211, 238, 0.5);
        }
      `}</style>

      <div style={styles.container}>

        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.headerIcon}>🎬</div>
            <span style={styles.headerTitle}>Clip Library</span>
          </div>
          {clips.length > 0 && (
            <span style={styles.clipCount}>
              {filteredAndSortedClips.length}
              <span style={{ color: 'rgba(255,255,255,0.3)', marginLeft: '3px' }}>
                / {clips.length}
              </span>
            </span>
          )}
        </div>

        {/* Source Tabs: Recent Clips | Content Hub */}
        <div style={{
          display: 'flex',
          gap: '4px',
          padding: '4px',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: '8px',
          margin: '0 12px 8px 12px'
        }}>
          <button
            onClick={() => { setSourceTab("recent"); setFilterPlatform("all"); }}
            style={{
              flex: 1,
              padding: '8px 10px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: sourceTab === 'recent' ? 'rgba(34, 211, 238, 0.25)' : 'transparent',
              color: sourceTab === 'recent' ? '#22d3ee' : 'rgba(255,255,255,0.5)',
              borderBottom: sourceTab === 'recent' ? '2px solid #22d3ee' : '2px solid transparent'
            }}
          >
            Recent Clips ({clips.length})
          </button>
          <button
            onClick={() => { setSourceTab("hub"); setFilterPlatform("all"); }}
            style={{
              flex: 1,
              padding: '8px 10px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: sourceTab === 'hub' ? 'rgba(59, 130, 246, 0.25)' : 'transparent',
              color: sourceTab === 'hub' ? '#3b82f6' : 'rgba(255,255,255,0.5)',
              borderBottom: sourceTab === 'hub' ? '2px solid #3b82f6' : '2px solid transparent'
            }}
          >
            Content Hub ({hubClips.length})
          </button>
        </div>

        {/* Filter Controls */}
        <div style={styles.controls}>

          <div style={styles.filterGroup}>
            <label style={styles.label}>
              <span style={styles.labelDot} />
              Platform
            </label>
            <select
              className="clip-library-select"
              value={filterPlatform}
              onChange={(e) => setFilterPlatform(e.target.value)}
            >
              {platforms.map(platform => (
                <option key={platform} value={platform}>
                  {platform === "all" ? "All Platforms" : platform}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.filterGroup}>
            <label style={styles.label}>
              <span style={styles.labelDot} />
              Sort By
            </label>
            <select
              className="clip-library-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="score">Score (High → Low)</option>
              <option value="duration">Duration (Long → Short)</option>
              <option value="platform">Platform (A → Z)</option>
            </select>
          </div>
        </div>

        {/* Divider */}
        <div style={styles.divider} />

        {/* Clip List */}
        <div style={styles.clipList} className="clip-library-scrollbar">

          {loading && (
            <div style={styles.emptyState}>
              <div style={styles.loadingSpinner}>
                <div style={styles.spinner} />
              </div>
              <span>Loading clips...</span>
            </div>
          )}

          {error && (
            <div style={{ ...styles.emptyState }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>⚠️</div>
              <div style={{ color: '#f87171', fontWeight: '600', marginBottom: '4px' }}>Failed to load</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{error}</div>
            </div>
          )}

          {!loading && !error && filteredAndSortedClips.length === 0 && (
            <div style={styles.emptyState}>
              <div style={{ fontSize: '32px', marginBottom: '10px', opacity: 0.4 }}>📭</div>
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                {clips.length === 0 ? "No clips available" : "No matches"}
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
                {clips.length > 0 ? "Try changing your filters" : "Upload clips to get started"}
              </div>
            </div>
          )}

          {!loading && !error && filteredAndSortedClips.map((clip, index) => (
            <div
              key={clip.clip_id}
              draggable
              onDragStart={(e) => handleDragStart(e, clip)}
              onMouseEnter={() => setHoveredClip(clip.clip_id)}
              onMouseLeave={() => setHoveredClip(null)}
              className="clip-card-hover"
              style={{
                ...styles.clipCard,
                // Staggered subtle glow based on score
                boxShadow: hoveredClip === clip.clip_id
                  ? '0 4px 16px rgba(34, 211, 238, 0.15), inset 0 0 0 1px rgba(34, 211, 238, 0.2)'
                  : '0 2px 8px rgba(0, 0, 0, 0.3)'
              }}
            >
              {/* Thumbnail */}
              <div style={styles.thumbnail}>
                <div style={styles.thumbnailGradient} />
                <div style={styles.thumbnailIcon}>🎬</div>
                <div style={styles.durationBadge}>
                  {clip.duration?.toFixed(1)}s
                </div>
              </div>

              {/* Clip Info */}
              <div style={styles.clipInfo}>

                {/* Clip ID */}
                <div style={styles.clipId}>
                  {clip.clip_id?.substring(0, 10) || "Unknown"}
                </div>

                {/* Badges Row */}
                <div style={styles.clipMeta}>
                  {clip.platform && (
                    <span style={styles.platformBadge}>
                      {clip.platform}
                    </span>
                  )}
                  {clip.score !== undefined && (
                    <span style={styles.scoreBadge}>
                      ⭐ {clip.score.toFixed(2)}
                    </span>
                  )}
                </div>

                {/* Topic */}
                {clip.topic && (
                  <div style={styles.clipTopic}>
                    {clip.topic}
                  </div>
                )}
              </div>

              {/* Score Bar (Visual indicator on right) */}
              {clip.score !== undefined && (
                <div style={styles.scoreBarContainer}>
                  <div
                    style={{
                      ...styles.scoreBar,
                      height: `${Math.min(clip.score * 100, 100)}%`,
                      background: clip.score > 0.7
                        ? 'linear-gradient(to top, #22d3ee, #06b6d4)'
                        : clip.score > 0.4
                        ? 'linear-gradient(to top, #f59e0b, #d97706)'
                        : 'linear-gradient(to top, #6b7280, #4b5563)'
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        {clips.length > 0 && (
          <div style={styles.footer}>
            <span style={styles.footerText}>Drag clips onto the timeline</span>
            <span style={styles.footerIcon}>→</span>
          </div>
        )}
      </div>
    </>
  )
}

const styles = {
  container: {
    width: '100%',
    height: '100%',
    background: 'linear-gradient(180deg, #0a0f1e 0%, #080c18 100%)',
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid rgba(34, 211, 238, 0.12)',
    fontFamily: "'Segoe UI', system-ui, sans-serif"
  },

  // ─── Header ───────────────────────────────────────────────────────────────
  header: {
    padding: '14px 16px',
    borderBottom: '1px solid rgba(34, 211, 238, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
    background: 'rgba(34, 211, 238, 0.03)'
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  headerIcon: {
    fontSize: '18px',
    lineHeight: 1
  },
  headerTitle: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#e2e8f0',
    letterSpacing: '-0.2px'
  },
  clipCount: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#22d3ee',
    background: 'rgba(34, 211, 238, 0.1)',
    padding: '3px 8px',
    borderRadius: '20px',
    border: '1px solid rgba(34, 211, 238, 0.2)'
  },

  // ─── Controls ─────────────────────────────────────────────────────────────
  controls: {
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    flexShrink: 0,
    background: 'rgba(0, 0, 0, 0.2)'
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  label: {
    fontSize: '10px',
    fontWeight: '700',
    color: 'rgba(34, 211, 238, 0.7)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  labelDot: {
    width: '4px',
    height: '4px',
    borderRadius: '50%',
    background: '#22d3ee',
    display: 'inline-block',
    flexShrink: 0
  },

  divider: {
    height: '1px',
    background: 'linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.2), transparent)',
    flexShrink: 0
  },

  // ─── Clip List ────────────────────────────────────────────────────────────
  clipList: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },

  // ─── Clip Card ────────────────────────────────────────────────────────────
  clipCard: {
    background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(10, 15, 30, 0.9))',
    border: '1px solid rgba(34, 211, 238, 0.12)',
    borderRadius: '10px',
    padding: '10px',
    cursor: 'grab',
    transition: 'all 0.18s ease',
    display: 'flex',
    gap: '10px',
    alignItems: 'flex-start',
    position: 'relative',
    overflow: 'hidden'
  },
  thumbnail: {
    width: '72px',
    height: '54px',
    background: 'linear-gradient(135deg, rgba(15, 30, 60, 0.8), rgba(10, 20, 40, 0.8))',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    position: 'relative',
    border: '1px solid rgba(34, 211, 238, 0.15)',
    overflow: 'hidden'
  },
  thumbnailGradient: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.05), transparent)',
    pointerEvents: 'none'
  },
  thumbnailIcon: {
    fontSize: '22px',
    opacity: 0.5,
    zIndex: 1
  },
  durationBadge: {
    position: 'absolute',
    bottom: '3px',
    right: '3px',
    background: 'rgba(0, 0, 0, 0.85)',
    color: '#22d3ee',
    fontSize: '9px',
    fontWeight: '700',
    padding: '2px 5px',
    borderRadius: '3px',
    zIndex: 2,
    letterSpacing: '0.3px'
  },
  clipInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    minWidth: 0
  },
  clipId: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#cbd5e1',
    fontFamily: "'Courier New', monospace",
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  clipMeta: {
    display: 'flex',
    gap: '5px',
    flexWrap: 'wrap'
  },
  platformBadge: {
    fontSize: '9px',
    fontWeight: '700',
    color: '#93c5fd',
    background: 'rgba(59, 130, 246, 0.15)',
    border: '1px solid rgba(59, 130, 246, 0.25)',
    padding: '2px 7px',
    borderRadius: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  // ✅ FIX: Score badge now has proper dark background + cyan text so it's always readable
  scoreBadge: {
    fontSize: '9px',
    fontWeight: '700',
    color: '#fde68a',                           // warm yellow text
    background: 'rgba(251, 191, 36, 0.12)',     // subtle amber background
    border: '1px solid rgba(251, 191, 36, 0.25)',
    padding: '2px 7px',
    borderRadius: '4px',
    letterSpacing: '0.3px'
  },
  clipTopic: {
    fontSize: '11px',
    color: 'rgba(148, 163, 184, 0.8)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    lineHeight: 1.3
  },

  // ─── Score Bar (right side vertical indicator) ───────────────────────────
  scoreBarContainer: {
    width: '3px',
    height: '54px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '2px',
    flexShrink: 0,
    alignSelf: 'center',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    overflow: 'hidden'
  },
  scoreBar: {
    width: '100%',
    borderRadius: '2px',
    transition: 'height 0.3s ease'
  },

  // ─── Footer ───────────────────────────────────────────────────────────────
  footer: {
    padding: '10px 16px',
    borderTop: '1px solid rgba(34, 211, 238, 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    flexShrink: 0,
    background: 'rgba(34, 211, 238, 0.02)'
  },
  footerText: {
    fontSize: '11px',
    color: 'rgba(34, 211, 238, 0.5)',
    fontWeight: '500',
    letterSpacing: '0.3px'
  },
  footerIcon: {
    color: 'rgba(34, 211, 238, 0.4)',
    fontSize: '13px'
  },

  // ─── Empty / Loading States ───────────────────────────────────────────────
  emptyState: {
    textAlign: 'center',
    padding: '40px 20px',
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: '13px',
    fontWeight: '500',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px'
  },
  loadingSpinner: {
    marginBottom: '8px'
  },
  spinner: {
    width: '28px',
    height: '28px',
    border: '2px solid rgba(34, 211, 238, 0.1)',
    borderTop: '2px solid #22d3ee',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    margin: '0 auto'
  }
}