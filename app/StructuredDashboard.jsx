import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "./useAppStore.js";

function Windows7ProgressBar({ progress, label, color = "#2bd057", height = 12 }) {
    return (
        <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: '#e2e8f0', textShadow: '0 1px 1px rgba(0,0,0,0.8)' }}>
                <span style={{ fontWeight: 500 }}>{label}</span>
                <span>{Math.round(progress)}%</span>
            </div>
            <div className="aero-progress-track" style={{ height }}>
                <div 
                    className="aero-progress-fill" 
                    style={{ 
                        width: `${progress}%`,
                        background: color === "#2bd057" 
                            ? 'linear-gradient(to bottom, #7fefa0 0%, #2bd057 40%, #17a93e 100%)'
                            : `linear-gradient(to bottom, ${color}99 0%, ${color} 40%, ${color}dd 100%)`
                    }}
                />
            </div>
        </div>
    );
}

function VideoCard({ video, index }) {
    const [expanded, setExpanded] = useState(index === 0); // first is expanded by default
    
    const isError = video.status === 'error';
    const isSuccess = video.status === 'success';
    
    // Calculate overall progress for this video based on steps
    const totalSteps = video.steps.length;
    let completedSteps = 0;
    let currentStepProgress = 0;
    video.steps.forEach(s => {
        if (s.status === 'success') completedSteps++;
        else if (s.status === 'active') currentStepProgress = s.progress;
    });
    
    const overallProgress = isSuccess ? 100 : Math.min(100, ((completedSteps * 100) + currentStepProgress) / totalSteps);

    const statusColor = isError ? '#ef4444' : isSuccess ? '#22c55e' : '#3b82f6';
    const bgGradient = isError ? 'linear-gradient(to right, rgba(239,68,68,0.05), rgba(0,0,0,0))' :
                       isSuccess ? 'linear-gradient(to right, rgba(34,197,94,0.05), rgba(0,0,0,0))' :
                       'linear-gradient(to right, rgba(59,130,246,0.08), rgba(0,0,0,0))';

    return (
        <div style={{ background: '#1e293b', borderRadius: 12, border: `1px solid ${isError ? '#7f1d1d' : '#334155'}`, overflow: 'hidden', marginBottom: 12, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
            <div 
                onClick={() => setExpanded(!expanded)}
                style={{ padding: '12px 16px', background: bgGradient, borderBottom: expanded ? '1px solid #334155' : 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0, paddingRight: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, boxShadow: `0 0 8px ${statusColor}` }} />
                            <h3 style={{ margin: 0, fontSize: 14, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>
                                {video.title}
                            </h3>
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {video.sourceFile}
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', color: '#64748b', fontSize: 12 }}>
                        {expanded ? '▲' : '▼'}
                    </div>
                </div>

                {/* Info Row: Clips, Duration, Next Video, Final Name */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: 11, color: '#cbd5e1', background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: 6 }}>
                    {video.sidecarInfo && <div><span style={{color:'#64748b'}}>Context:</span> {video.sidecarInfo}</div>}
                    {video.clipsUsed && <div><span style={{color:'#64748b'}}>Clips:</span> {video.clipsUsed}</div>}
                    {video.duration && <div><span style={{color:'#64748b'}}>Length:</span> {video.duration}s</div>}
                    {video.finalVideoName && <div><span style={{color:'#64748b'}}>Output:</span> <span title={video.finalVideoName} style={{maxWidth: 150, display:'inline-block', overflow:'hidden', textOverflow:'ellipsis', verticalAlign:'bottom', whiteSpace:'nowrap'}}>{video.finalVideoName}</span></div>}
                    {video.nextUploadVideo && <div><span style={{color:'#64748b'}}>Next:</span> {video.nextUploadVideo}</div>}
                </div>

                {/* Mini progress bar if collapsed, or just overall progress */}
                {!expanded && (
                     <div style={{ height: 4, background: '#0f172a', borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
                         <div style={{ width: `${overallProgress}%`, height: '100%', background: statusColor, transition: 'width 0.3s ease' }} />
                     </div>
                )}
            </div>
            
            <AnimatePresence>
                {expanded && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: 'hidden' }}
                    >
                        <div style={{ padding: '16px 20px', background: 'rgba(0,0,0,0.1)' }}>
                            {video.tags && video.tags.length > 0 && (
                                <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                                    {video.tags.slice(0, 8).map(tag => (
                                        <span key={tag} style={{ background: '#0f172a', padding: '3px 8px', borderRadius: 4, fontSize: 11, color: '#38bdf8', border: '1px solid #1e293b' }}>{tag}</span>
                                    ))}
                                </div>
                            )}

                            <div>
                                {video.steps.map((step, idx) => {
                                    const isActive = step.status === 'active';
                                    const isSuccess = step.status === 'success';
                                    const isError = step.status === 'error';
                                    const isPending = step.status === 'pending';
                                    
                                    return (
                                        <div key={step.id} style={{ display: 'flex', gap: 16, marginBottom: idx === video.steps.length - 1 ? 0 : 16, opacity: isPending ? 0.4 : 1 }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                <div style={{ 
                                                    width: 20, height: 20, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    background: isError ? '#ef4444' : isSuccess ? '#22c55e' : isActive ? '#3b82f6' : '#334155',
                                                    color: '#fff', zIndex: 2, fontSize: 10,
                                                    boxShadow: isError ? '0 0 10px rgba(239, 68, 68, 0.4)' : isActive ? '0 0 10px rgba(59, 130, 246, 0.4)' : 'none'
                                                }}>
                                                    {isError ? "✖" : isSuccess ? "✓" : isActive ? "▶" : "•"}
                                                </div>
                                                {idx !== video.steps.length - 1 && (
                                                    <div style={{ width: 2, height: '100%', background: isError ? '#ef4444' : isSuccess ? '#22c55e' : '#334155', marginTop: 4 }} />
                                                )}
                                            </div>
                                            <div style={{ flex: 1, paddingBottom: 0 }}>
                                                <div style={{ fontSize: 13, fontWeight: 500, color: isError ? '#ef4444' : isActive ? '#fff' : '#cbd5e1', marginBottom: 2 }}>
                                                    {step.label}
                                                </div>
                                                {isActive && (
                                                    <div style={{ marginTop: 8, marginBottom: 8 }}>
                                                        <Windows7ProgressBar progress={step.progress} label={video.activeDetail} height={8} color={isError ? '#ef4444' : '#3b82f6'} />
                                                    </div>
                                                )}
                                                {isError && isActive && (
                                                    <div style={{ fontSize: 11, color: '#fca5a5', marginTop: 4, background: 'rgba(239,68,68,0.1)', padding: 6, borderRadius: 4 }}>
                                                        {video.activeDetail}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default function StructuredDashboard({ logs }) {
    const uploadSessions = useAppStore(s => s.uploadSessions);

    const sessionsData = useMemo(() => {
        let sessions = {};

        logs.forEach(entry => {
            if (entry.stream !== 'stdout' || !entry.message) return;
            const sid = entry.sessionId || 'unknown';

            if (!sessions[sid]) {
                sessions[sid] = {
                    sessionId: sid,
                    status: 'idle',
                    currentIndex: 0,
                    maxVideos: 0,
                    videos: [], // array of video objects
                    completedCount: 0,
                    failedCount: 0
                };
            }

            let bs = sessions[sid];
            const msg = entry.message;
            
            if (msg.match(/\[(\d+)\/(\d+)\] processing:/)) {
                const m = msg.match(/\[(\d+)\/(\d+)\] processing:\s*(.*)/);
                if (m) {
                    // Mark previous active videos as skipped since we are moving on
                    bs.videos.forEach(v => {
                        if (v.status === 'active') {
                            v.status = 'skipped';
                            v.activeDetail = 'Skipped by engine rules';
                            bs.skippedCount = (bs.skippedCount || 0) + 1;
                        }
                    });

                    bs.currentIndex = parseInt(m[1], 10);
                    bs.maxVideos = parseInt(m[2], 10);
                    bs.status = 'running';
                    
                    const sourceFile = m[3];
                    let video = bs.videos.find(v => v.sourceFile === sourceFile);
                    if (!video) {
                        video = {
                            sourceFile: sourceFile,
                            title: 'Generating Metadata...',
                            tags: [],
                            clipsUsed: null,
                            duration: null,
                            finalVideoName: null,
                            nextUploadVideo: null,
                            status: 'active',
                            steps: [
                                { id: 'metadata', status: 'active', progress: 0, label: 'Prepare Metadata & Cache' },
                                { id: 'combine', status: 'pending', progress: 0, label: 'Extract & Combine Clips' },
                                { id: 'convert', status: 'pending', progress: 0, label: 'Convert for Vertical Shorts' },
                                { id: 'music', status: 'pending', progress: 0, label: 'Mix Audio' },
                                { id: 'upload_yt', status: 'pending', progress: 0, label: 'Publish to YouTube' },
                                { id: 'upload_ig', status: 'pending', progress: 0, label: 'Publish to Instagram' },
                                { id: 'upload_fb', status: 'pending', progress: 0, label: 'Publish to Facebook' },
                            ],
                            activeDetail: 'Analyzing source file...'
                        };
                        // Add to top of stack
                        bs.videos.unshift(video);
                        // Limit to 10 max
                        if (bs.videos.length > 10) bs.videos.pop();
                        
                        // Set the nextUploadVideo of the previous item if any
                        if (bs.videos.length > 1) {
                            bs.videos[1].nextUploadVideo = sourceFile.split(/[/\\]/).pop();
                        }
                    } else {
                        video.status = 'active'; 
                    }
                }
            } else if (msg.includes("[done] uploads completed:")) {
                bs.status = 'stopped';
                // End of script: mark any remaining active video as skipped if it didn't complete/fail
                bs.videos.forEach(v => {
                    if (v.status === 'active') {
                        v.status = 'skipped';
                        v.activeDetail = 'Skipped or filtered out at end of run';
                        bs.skippedCount = (bs.skippedCount || 0) + 1;
                    }
                });
            } 
            
            const activeVideo = bs.videos.find(v => v.status === 'active' || v.status === 'error');

            if (activeVideo && activeVideo.status !== 'error') {
                if (msg.includes("[meta] title: ")) {
                    activeVideo.title = msg.replace("[meta] title: ", "").trim();
                    const step = activeVideo.steps.find(s=>s.id==='metadata');
                    if (step) { step.status = 'success'; step.progress = 100; }
                } else if (msg.includes("[meta] tags: ")) {
                    activeVideo.tags = msg.replace("[meta] tags: ", "").split(",").map(s => s.trim());
                } else if (msg.includes("[meta] sidecar context: ")) {
                    activeVideo.sidecarInfo = msg.replace("[meta] sidecar context: ", "").trim();
                } else if (msg.includes("[combine] merged ")) {
                    const m = msg.match(/\[combine\] merged (\d+) clips into (.*?)\s*\(target/);
                    if (m) {
                        activeVideo.clipsUsed = m[1];
                        activeVideo.finalVideoName = m[2];
                        const step = activeVideo.steps.find(s => s.id === 'combine');
                        if (step) { step.status = 'success'; step.progress = 100; }
                    }
                } else if (msg.includes("[video] source:")) {
                    const m = msg.match(/\[video\] source:.*?, ([\d\.]+)s/);
                    if (m) activeVideo.duration = m[1];
                } else if (msg.includes("converted for Shorts:")) {
                    const m = msg.match(/converted for Shorts: (.*?)\s*\(/);
                    if (m) activeVideo.finalVideoName = m[1].trim();
                    const dm = msg.match(/([\d\.]+)s\)$/);
                    if (dm) activeVideo.duration = dm[1];

                    const step = activeVideo.steps.find(s => s.id === 'convert');
                    if (step) { step.status = 'success'; step.progress = 100; }
                } else if (msg.includes("[cache-hit][pre-edited]")) {
                    const m = msg.match(/Found pre-edited video: (.*?)\./);
                    if (m) activeVideo.finalVideoName = m[1].trim();
                    const step1 = activeVideo.steps.find(s => s.id === 'combine');
                    if (step1) { step1.status = 'success'; step1.progress = 100; }
                    const step2 = activeVideo.steps.find(s => s.id === 'convert');
                    if (step2) { step2.status = 'success'; step2.progress = 100; }
                } else if (msg.includes("[cache-hit][combined]")) {
                    const m = msg.match(/reusing (.*)$/);
                    if (m) activeVideo.finalVideoName = m[1].trim();
                    const step = activeVideo.steps.find(s => s.id === 'combine');
                    if (step) { step.status = 'success'; step.progress = 100; }
                } else if (msg.includes("[cache-hit][converted]")) {
                    const m = msg.match(/reusing (.*)$/);
                    if (m) activeVideo.finalVideoName = m[1].trim();
                    const step = activeVideo.steps.find(s => s.id === 'convert');
                    if (step) { step.status = 'success'; step.progress = 100; }
                } else if (msg.includes("[progress][combine]")) {
                    const step = activeVideo.steps.find(s => s.id === 'combine');
                    if (step) {
                        const m_step = activeVideo.steps.find(s=>s.id==='metadata');
                        if (m_step) { m_step.status = 'success'; m_step.progress = 100; }
                        step.status = 'active';
                        const m = msg.match(/\[progress\]\[combine\]\s*(\d+)%/);
                        if (m) step.progress = parseInt(m[1], 10);
                        activeVideo.activeDetail = 'Combining clips...';
                    }
                } else if (msg.includes("[cache-hit][combined]")) {
                    const step = activeVideo.steps.find(s => s.id === 'combine');
                    if (step) { step.status = 'success'; step.progress = 100; }
                } else if (msg.includes("[progress][converted]")) {
                    const step = activeVideo.steps.find(s => s.id === 'convert');
                    if (step) {
                        step.status = 'active';
                        const m = msg.match(/\[progress\]\[converted\]\s*(\d+)%/);
                        if (m) step.progress = parseInt(m[1], 10);
                        activeVideo.activeDetail = 'Converting format...';
                    }
                } else if (msg.includes("[cache-hit][converted]")) {
                    const step = activeVideo.steps.find(s => s.id === 'convert');
                    if (step) { step.status = 'success'; step.progress = 100; }
                } else if (msg.includes("[music] mixed")) {
                    const step = activeVideo.steps.find(s => s.id === 'music');
                    if (step) { step.status = 'success'; step.progress = 100; }
                } else if (msg.includes("[instagram] Uploading chunk offset")) {
                    const step = activeVideo.steps.find(s => s.id === 'upload_ig');
                    if (step) {
                        step.status = 'active';
                        const m = msg.match(/Uploading chunk offset (\d+) size (\d+)/);
                        if (m) {
                            activeVideo.activeDetail = `Uploading IG chunk... (${Math.floor(parseInt(m[1])/1024/1024)}MB)`;
                            step.progress = Math.min(95, step.progress + 5); 
                        }
                    }
                } else if (msg.includes("[ok][instagram] media_id=")) {
                    const step = activeVideo.steps.find(s => s.id === 'upload_ig');
                    if (step) { step.status = 'success'; step.progress = 100; activeVideo.activeDetail = 'IG Upload Complete'; }
                    activeVideo.status = 'success';
                    bs.completedCount++;
                } else if (msg.includes("[youtube] Uploaded successfully")) {
                    const step = activeVideo.steps.find(s => s.id === 'upload_yt');
                    if (step) { step.status = 'success'; step.progress = 100; activeVideo.activeDetail = 'YouTube Upload Complete'; }
                    activeVideo.status = 'success';
                    bs.completedCount++;
                } else if (msg.includes("[ok][facebook] uploaded:")) {
                     const step = activeVideo.steps.find(s => s.id === 'upload_fb');
                     if (step) { step.status = 'success'; step.progress = 100; activeVideo.activeDetail = 'FB Upload Complete'; }
                     activeVideo.status = 'success';
                     bs.completedCount++;
                } else if (msg.includes("[error]") || msg.includes("Upload error") || msg.includes("ProcessingFailedError") || msg.includes("failed; skipping batch")) {
                    bs.status = 'error';
                    activeVideo.status = 'error';
                    bs.failedCount++;
                    
                    const activeStep = activeVideo.steps.find(s => s.status === 'active');
                    if (activeStep) {
                        activeStep.status = 'error';
                        activeVideo.activeDetail = 'Failed: ' + msg.replace(/\[.*?\]\s*/g, '').substring(0, 60) + '...';
                    } else {
                         activeVideo.activeDetail = 'Error: ' + msg.replace(/\[.*?\]\s*/g, '').substring(0, 60);
                    }
                }
            }
        });
        
        return sessions;
    }, [logs]);

    // Group active sessions
    const activeSessions = Object.values(sessionsData).filter(s => s.status !== 'idle' && s.videos.length > 0);

    if (activeSessions.length === 0) {
        return (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                <h3 style={{ fontWeight: 400 }}>No Active Upload Session</h3>
                <p style={{ fontSize: 13, marginTop: 8 }}>Start the upload pipeline to see live progress.</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: 20 }}>
            {activeSessions.map((sessionState) => {
                const storeSession = uploadSessions[sessionState.sessionId] || {};
                const platformLabel = storeSession.platform ? storeSession.platform.toUpperCase() : 'UPLOAD PIPELINE';
                const isRunning = storeSession.status === 'running' || sessionState.status === 'running';

                const overallProgress = sessionState.maxVideos > 0 
                    ? ((sessionState.currentIndex - (sessionState.videos[0]?.status === 'success' ? 0 : 1)) / sessionState.maxVideos) * 100 
                    : 0;

                return (
                    <div key={sessionState.sessionId} style={{ background: '#0f172a', padding: 20, borderRadius: 12, border: '1px solid #1e293b' }}>
                        {/* Session Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <h2 style={{ fontSize: 16, fontWeight: 600, color: '#f8fafc', margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>
                                        {platformLabel}
                                    </h2>
                                    {isRunning && (
                                        <span style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700, border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                                            CURRENT RUN
                                        </span>
                                    )}
                                    {sessionState.status === 'error' && (
                                        <span style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700, border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                                            ERROR
                                        </span>
                                    )}
                                </div>
                                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                                    Session ID: {sessionState.sessionId.split('-')[0]}...
                                </div>
                            </div>
                            
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 14, color: '#94a3b8', fontWeight: 500 }}>
                                    Video {Math.min(sessionState.currentIndex, sessionState.maxVideos || 1)} of {sessionState.maxVideos || 1}
                                </div>
                            </div>
                        </div>

                        <Windows7ProgressBar progress={Math.max(0, Math.min(100, overallProgress))} label="Overall Batch Progress" color="#3b82f6" height={10} />
                        
                        <div style={{ display: 'flex', gap: 16, marginTop: 12, marginBottom: 20 }}>
                            <div style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                                {sessionState.completedCount} Completed
                            </div>
                            {sessionState.failedCount > 0 && (
                                <div style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                                    {sessionState.failedCount} Failed
                                </div>
                            )}
                            {sessionState.skippedCount > 0 && (
                                <div style={{ background: 'rgba(148,163,184,0.1)', color: '#94a3b8', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                                    {sessionState.skippedCount} Skipped
                                </div>
                            )}
                        </div>

                        {/* Stacked Videos */}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <h4 style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 12px 0' }}>Processed Videos</h4>
                            {sessionState.videos.map((video, idx) => (
                                <VideoCard key={video.sourceFile + idx} video={video} index={idx} />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
