// ============================================================================
// UNIFIED EDITOR PAGE — Phase 2
// Full CapCut-style editor with timeline, clip library, and highlight creation.
// Wraps colleague's editor components inside IncuBrix AppLayout.
// ============================================================================
// SAN :: February 2026 :: Phase 2 Integration
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Download, Loader2, AlertCircle } from 'lucide-react';
import { AppLayout } from '@/components/layout/SharedLayout';
import { getCurrentUser } from '../services/authService';

// Editor components (from colleague's editor-ui)
import Timeline from '../components/editor/Timeline';
import CompositePreview from '../components/editor/CompositePreview';
import TextPropertiesPanel from '../components/editor/TextPropertiesPanel';
import ClipLibraryPanel from '../components/editor/ClipLibraryPanel';
import HighlightControls from '../components/editor/HighlightControls';
import { useEditorStore } from '../store/editorStore';

// API clients (using your Vite proxy paths + auth)
import { getSession, saveSession } from '../api/editorSessionApi';

// ============================================
// Editor Content Component
// ============================================

function EditorContent() {
    const { sessionId } = useParams();
    const [searchParams] = useSearchParams();
    const jobId = searchParams.get('jobId') || session?.source_job_id || '';
    const navigate = useNavigate();

    // Zustand store
    const addTrack = useEditorStore((s) => s.addTrack);
    const addClip = useEditorStore((s) => s.addClip);
    const deleteClip = useEditorStore((s) => s.deleteClip);
    const splitClip = useEditorStore((s) => s.splitClip);
    const timeline = useEditorStore((s) => s.timeline);
    const loadTimeline = useEditorStore((s) => s.loadTimeline);
    const zoomIn = useEditorStore((s) => s.zoomIn);
    const zoomOut = useEditorStore((s) => s.zoomOut);

    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState(null);

    // Resizable panels
    const [dividerPosition, setDividerPosition] = useState(Math.min(300, window.innerHeight * 0.4));
    const [leftPanelWidth, setLeftPanelWidth] = useState(Math.min(260, window.innerWidth * 0.18));
    const [dragging, setDragging] = useState(false);
    const [draggingLeftPanel, setDraggingLeftPanel] = useState(false);

    // File inputs for adding media
    const videoInputRef = useRef(null);
    const audioInputRef = useRef(null);
    const [pendingTrack, setPendingTrack] = useState(null);

    // Panel drag handlers
    const startDrag = () => setDragging(true);
    const stopDrag = () => setDragging(false);
    const startLeftPanelDrag = () => setDraggingLeftPanel(true);
    const stopLeftPanelDrag = () => setDraggingLeftPanel(false);

    useEffect(() => {
        const move = (e) => { if (dragging) setDividerPosition(e.clientY); };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', stopDrag);
        return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', stopDrag); };
    }, [dragging]);

    useEffect(() => {
        const move = (e) => { if (draggingLeftPanel) setLeftPanelWidth(Math.max(200, Math.min(e.clientX, 500))); };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', stopLeftPanelDrag);
        return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', stopLeftPanelDrag); };
    }, [draggingLeftPanel]);

    // ── Load session on mount ──
    useEffect(() => {
        async function init() {
            try {
                setLoading(true);
                setError('');
                const data = await getSession(sessionId);
                setSession(data);

                // Load timeline into Zustand store if session has one
                if (data.timeline && data.timeline.tracks) {
                    loadTimeline(data.timeline);
                }
            } catch (err) {
                console.error('Failed to load session:', err);
                setError(err.message || 'Failed to load editor session');
            } finally {
                setLoading(false);
            }
        }
        if (sessionId) init();
    }, [sessionId]);

    // ── Auto-save every 10 seconds ──
    useEffect(() => {
        if (!sessionId || !session) return;
        const interval = setInterval(async () => {
            try {
                setIsSaving(true);
                await saveSession(sessionId, timeline);
                setLastSaved(new Date());
            } catch (err) {
                console.error('Auto-save failed:', err);
            } finally {
                setIsSaving(false);
            }
        }, 10000);
        return () => clearInterval(interval);
    }, [timeline, sessionId, session]);

    // ── Manual save ──
    const handleSave = async () => {
        if (!sessionId) return;
        setIsSaving(true);
        try {
            await saveSession(sessionId, timeline);
            setLastSaved(new Date());
        } catch (err) {
            console.error('Save failed:', err);
        } finally {
            setIsSaving(false);
        }
    };

    // ── Track add handler ──
    const handleTrackAdd = (trackId, type) => {
        setPendingTrack(trackId);
        if (type === 'video') {
            videoInputRef.current?.click();
        } else if (type === 'audio') {
            audioInputRef.current?.click();
        } else if (type === 'text') {
            const newClipId = `clip_${Date.now()}`;
            addClip(trackId, {
                clip_id: newClipId,
                start: timeline.playhead_position,
                end: timeline.playhead_position + 5,
                type: 'text',
                text: 'Double click to edit',
                textStyle: {
                    fontSize: 48, fontFamily: 'Arial', fontWeight: 'bold',
                    color: '#FFFFFF', backgroundColor: 'transparent', textAlign: 'center',
                },
            });
            useEditorStore.getState().selectClip(newClipId);
        }
    };

    const handleVideoSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file || !pendingTrack) return;
        const url = URL.createObjectURL(file);
        const video = document.createElement('video');
        video.src = url;
        video.onloadedmetadata = () => {
            const clipDuration = Math.min(video.duration, 120);
            const newClipId = `clip_${Date.now()}`;
            addClip(pendingTrack, { clip_id: newClipId, end: clipDuration, src: url, type: 'video' });
            useEditorStore.getState().selectClip(newClipId);
        };
        setPendingTrack(null);
        e.target.value = '';
    };

    const handleAudioSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file || !pendingTrack) return;
        const url = URL.createObjectURL(file);
        const audio = document.createElement('audio');
        audio.src = url;
        audio.onloadedmetadata = () => {
            const clipDuration = Math.min(audio.duration, 120);
            const newClipId = `clip_${Date.now()}`;
            addClip(pendingTrack, { clip_id: newClipId, end: clipDuration, src: url, type: 'audio' });
            useEditorStore.getState().selectClip(newClipId);
        };
        setPendingTrack(null);
        e.target.value = '';
    };

    const handleSplit = () => {
        const selectedClipId = timeline.selectedClipId;
        const playheadPos = timeline.playhead_position;
        if (!selectedClipId) { alert('Please select a clip first'); return; }
        let selectedClip = null;
        for (const track of timeline.tracks) {
            const clip = track.clips.find((c) => c.clip_id === selectedClipId);
            if (clip) { selectedClip = clip; break; }
        }
        if (!selectedClip) { alert('Clip not found'); return; }
        if (playheadPos <= selectedClip.start || playheadPos >= selectedClip.end) {
            alert('Move the playhead inside the clip you want to split');
            return;
        }
        splitClip(selectedClipId);
    };

    const handleHighlightSessionCreated = (highlightSession) => {
        console.log('Highlight session created:', highlightSession);
        navigate(`/editor/${highlightSession.session_id}`);
    };

    // Derive contentId from session for clip library
    // source_asset_id = the original video that was repurposed (has clips in repurposer_clips)
    // content_id = random UUID generated per editor session (has NO clips)
    const contentId = session?.source_asset_id || session?.content_id || '';

    // ── Loading State ──
    if (loading) {
        return (
            <div className="min-h-[calc(100vh-80px)] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 text-[#4EFFEF] animate-spin" />
                    <p className="text-[#B0B7C3]">Loading editor session...</p>
                </div>
            </div>
        );
    }

    // ── Error State ──
    if (error) {
        return (
            <div className="min-h-[calc(100vh-80px)] flex items-center justify-center">
                <div className="bg-[#0d1129] border border-red-500/30 rounded-2xl p-8 max-w-md text-center">
                    <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                    <h3 className="text-white font-semibold text-lg mb-2">Session Not Found</h3>
                    <p className="text-[#B0B7C3] mb-6">{error}</p>
                    <button
                        onClick={() => navigate(-1)}
                        className="px-6 py-3 bg-white/10 hover:bg-white/15 text-white rounded-xl transition-colors border border-white/10"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    // ── Editor View ──
    return (
        <div style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', background: '#0a0e1a' }}>
            {/* Header Bar */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(10, 14, 26, 0.95)', flexShrink: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-[#B0B7C3] hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span style={{ fontSize: '13px' }}>Back</span>
                    </button>
                    <span style={{ fontSize: '15px', fontWeight: '600', color: '#FFFFFF' }}>
                        Unified Content Editor
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{
                        fontSize: '12px',
                        color: isSaving ? '#fbbf24' : '#22c55e',
                        fontWeight: '500',
                    }}>
                        {isSaving ? '💾 Saving...' : lastSaved ? `✓ Saved ${lastSaved.toLocaleTimeString()}` : ''}
                    </span>
                    <button
                        onClick={handleSave}
                        className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white rounded-lg flex items-center gap-2 border border-white/10 text-xs transition-colors"
                    >
                        <Save className="w-3.5 h-3.5" /> Save
                    </button>
                    <button
                        onClick={() => { if (timeline.selectedClipId) deleteClip(timeline.selectedClipId); }}
                        disabled={!timeline.selectedClipId}
                        style={{
                            padding: '6px 12px', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.3)',
                            borderRadius: '8px', color: '#fca5a5', fontSize: '12px', cursor: timeline.selectedClipId ? 'pointer' : 'not-allowed',
                            opacity: timeline.selectedClipId ? 1 : 0.4,
                        }}
                    >
                        Delete Clip
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* Left Panel: Clip Library */}
                <div style={{ width: `${leftPanelWidth}px`, minWidth: '200px', maxWidth: '280px', flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <ClipLibraryPanel contentId={contentId} jobId={jobId} />
                </div>

                {/* Vertical Divider */}
                <div
                    style={{
                        width: '4px', background: '#1e293b', cursor: 'col-resize',
                        flexShrink: 0, position: 'relative',
                    }}
                    onMouseDown={startLeftPanelDrag}
                >
                    <div style={{
                        position: 'absolute', top: '50%', left: '50%',
                        transform: 'translate(-50%, -50%)', width: '12px', height: '40px',
                        background: 'rgba(34, 211, 238, 0.3)', borderRadius: '4px', pointerEvents: 'none',
                    }} />
                </div>

                {/* Right Panel: Preview + Timeline */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {/* Preview Area */}
                    <div style={{ height: dividerPosition, overflow: 'hidden' }}>
                        <CompositePreview />
                    </div>

                    {/* Horizontal Divider */}
                    <div style={{ height: '4px', background: '#00f0ff', cursor: 'row-resize', flexShrink: 0 }} onMouseDown={startDrag} />

                    {/* Bottom: Controls + Timeline */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0a0e1a' }}>
                        {/* Track Controls */}
                        <div style={{
                            display: 'flex', gap: '8px', padding: '8px 12px',
                            borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0, flexWrap: 'wrap',
                        }}>
                            <button
                                onClick={() => addTrack('video')}
                                disabled={timeline.tracks.some((t) => t.type === 'video')}
                                style={{
                                    padding: '6px 12px', background: 'rgba(34,211,238,0.15)', border: '1px solid rgba(34,211,238,0.3)',
                                    borderRadius: '6px', color: '#22d3ee', fontSize: '12px', fontWeight: '600',
                                    opacity: timeline.tracks.some((t) => t.type === 'video') ? 0.4 : 1,
                                    cursor: timeline.tracks.some((t) => t.type === 'video') ? 'not-allowed' : 'pointer',
                                }}
                            >
                                {timeline.tracks.some((t) => t.type === 'video') ? '✓ Video Track' : '+ Video Track'}
                            </button>
                            <button
                                onClick={() => addTrack('audio')}
                                disabled={timeline.tracks.some((t) => t.type === 'audio')}
                                style={{
                                    padding: '6px 12px', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
                                    borderRadius: '6px', color: '#93c5fd', fontSize: '12px', fontWeight: '600',
                                    opacity: timeline.tracks.some((t) => t.type === 'audio') ? 0.4 : 1,
                                    cursor: timeline.tracks.some((t) => t.type === 'audio') ? 'not-allowed' : 'pointer',
                                }}
                            >
                                {timeline.tracks.some((t) => t.type === 'audio') ? '✓ Audio Track' : '+ Audio Track'}
                            </button>
                            <button
                                onClick={() => addTrack('text')}
                                disabled={timeline.tracks.some((t) => t.type === 'text')}
                                style={{
                                    padding: '6px 12px', background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)',
                                    borderRadius: '6px', color: '#c4b5fd', fontSize: '12px', fontWeight: '600',
                                    opacity: timeline.tracks.some((t) => t.type === 'text') ? 0.4 : 1,
                                    cursor: timeline.tracks.some((t) => t.type === 'text') ? 'not-allowed' : 'pointer',
                                }}
                            >
                                {timeline.tracks.some((t) => t.type === 'text') ? '✓ Text Track' : '+ Text Track'}
                            </button>
                            <button
                                onClick={zoomIn}
                                style={{
                                    padding: '6px 12px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                                    borderRadius: '6px', color: '#e2e8f0', fontSize: '12px',
                                }}
                            >
                                Zoom In ({timeline.zoom_level})
                            </button>
                            <button
                                onClick={zoomOut}
                                style={{
                                    padding: '6px 12px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                                    borderRadius: '6px', color: '#e2e8f0', fontSize: '12px',
                                }}
                            >
                                Zoom Out
                            </button>
                            <button
                                onClick={handleSplit}
                                style={{
                                    padding: '6px 12px', background: '#2563eb', border: 'none',
                                    borderRadius: '6px', color: '#FFFFFF', fontSize: '12px', fontWeight: '600',
                                }}
                            >
                                ✂️ Split Clip
                            </button>
                        </div>

                        {/* Highlight Controls */}
                        <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
                            <HighlightControls
                                contentId={contentId}
                                onSessionCreated={handleHighlightSessionCreated}
                            />
                        </div>

                        {/* Timeline */}
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                            <Timeline onTrackAdd={handleTrackAdd} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Hidden file inputs */}
            <input type="file" accept="video/*" ref={videoInputRef} style={{ display: 'none' }} onChange={handleVideoSelect} />
            <input type="file" accept="audio/*" ref={audioInputRef} style={{ display: 'none' }} onChange={handleAudioSelect} />

            {/* Text properties panel (floating) */}
            <TextPropertiesPanel />
        </div>
    );
}

// ============================================
// Main Export - Uses AppLayout (same as all your pages)
// ============================================

export default function EditorPage() {
    return (
        <AppLayout activeItem="Repurposer">
            <EditorContent />
        </AppLayout>
    );
}
