import { useEffect, useMemo, useState, useRef } from "react";
import ToggleSwitch from "./ToggleSwitch.jsx";
import { useAppStore } from "./useAppStore.js";
import ActionInput from "./ActionInput.jsx";

// ── Thin themed scrollbar injected once ───────────────────────────────────────
const SCROLLBAR_STYLE = `
.editor-sidebar::-webkit-scrollbar { width: 4px; }
.editor-sidebar::-webkit-scrollbar-track { background: transparent; }
.editor-sidebar::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
.editor-sidebar::-webkit-scrollbar-thumb:hover { background: #4f46e5; }
`;
if (typeof document !== "undefined" && !document.getElementById("editor-sidebar-sb")) {
    const s = document.createElement("style");
    s.id = "editor-sidebar-sb";
    s.textContent = SCROLLBAR_STYLE;
    document.head.appendChild(s);
}

function SidebarSection({ title, defaultOpen = true, children, indent = false }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div style={{ borderRadius: 8, overflow: 'hidden', background: indent ? 'transparent' : 'rgba(255,255,255,0.03)', border: indent ? 'none' : '1px solid #1e293b', flexShrink: 0 }}>
            <button
                onClick={() => setOpen(o => !o)}
                style={{
                    width: '100%', display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: indent ? '6px 0' : '9px 14px',
                    background: 'transparent', border: 'none',
                    borderBottom: open ? (indent ? '1px solid #1e293b' : '1px solid #1e293b') : 'none',
                    cursor: 'pointer', color: indent ? '#94a3b8' : '#e2e8f0',
                    fontSize: indent ? 11 : 12,
                    fontWeight: indent ? 500 : 700,
                    textTransform: indent ? 'uppercase' : 'none',
                    letterSpacing: indent ? 1 : 0,
                }}
            >
                <span>{title}</span>
                <span style={{ fontSize: 10, color: '#64748b', transition: 'transform 0.2s', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', display: 'inline-block' }}>▼</span>
            </button>
            {open && (
                <div style={{ padding: indent ? '6px 0 0' : '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {children}
                </div>
            )}
        </div>
    );
}

const STATUS_COLORS = {
    running:   { bg: "rgba(245,158,11,0.15)",  border: "rgba(245,158,11,0.45)",  color: "#fbbf24" },
    completed: { bg: "rgba(5,150,105,0.12)",   border: "rgba(5,150,105,0.4)",    color: "#34d399" },
    done:      { bg: "rgba(5,150,105,0.12)",   border: "rgba(5,150,105,0.4)",    color: "#34d399" },
    error:     { bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.4)",    color: "#f87171" },
    stopped:   { bg: "rgba(100,116,139,0.12)", border: "rgba(100,116,139,0.35)", color: "#94a3b8" },
};

function SessionChip({ session, selected, onClick, onStop }) {
    const c = STATUS_COLORS[session.status] || STATUS_COLORS.stopped;
    const isRunning = session.status === "running";
    const label = "Batch Edit Session";
    const time  = session.startedAt ? new Date(session.startedAt).toLocaleTimeString() : "";

    return (
        <span
            onClick={onClick}
            title={session.commandPreview || label}
            style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: c.bg, border: "1px solid " + c.border, borderRadius: 20,
                padding: "3px 10px", fontSize: 11, color: c.color,
                cursor: "pointer", userSelect: "none",
                outline: selected ? "2px solid " + c.color : "none", outlineOffset: 2,
                transition: "opacity 0.15s",
                whiteSpace: "nowrap"
            }}
        >
            <span style={{
                width: 6, height: 6, borderRadius: "50%", background: c.color, flexShrink: 0,
                boxShadow: isRunning ? "0 0 6px " + c.color : "none"
            }} />
            <span>{label}</span>
            {time && <span style={{ opacity: 0.55, fontSize: 9 }}>{time}</span>}
            {isRunning && onStop && (
                <span
                    onClick={function(e) { e.stopPropagation(); onStop(session.sessionId); }}
                    title="Stop process"
                    style={{
                        marginLeft: 2, padding: "0px 4px", borderRadius: 3,
                        background: "rgba(239,68,68,0.3)", color: "#fca5a5",
                        fontSize: 9, cursor: "pointer", fontWeight: 700
                    }}
                >
                    ✕
                </span>
            )}
        </span>
    );
}

const sideRow = {
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', padding: '5px 0',
};

const sideInput = {
    padding: '4px 8px', borderRadius: 4,
    border: '1px solid #334155', background: '#1a1a2e',
    color: '#fff', fontSize: 13, width: 110,
};

export default function BatchEditor() {
    const [leftOpen, setLeftOpen] = useState(true);
    const [searchFilter, setSearchFilter] = useState("");
    const [selectedSessionId, setSelectedSessionId] = useState(null);

    const options       = useAppStore(s => s.uploadOptions);
    const setUploadOption   = useAppStore(s => s.setUploadOption);
    const stopUpload        = useAppStore(s => s.stopUpload);
    const syncUploadStatus  = useAppStore(s => s.syncUploadStatus);
    const logEntries   = useAppStore(s => s.logEntries);
    const clearLogs    = useAppStore(s => s.clearLogs);
    const startConsole = useAppStore(s => s.startConsole);
    const stopSession  = useAppStore(s => s.stopSession);
    const uploadSessions = useAppStore(s => s.uploadSessions);

    const logEndRef = useRef(null);

    useEffect(function pollStatus() {
        syncUploadStatus();
        const interval = setInterval(syncUploadStatus, 2000);
        return function() { clearInterval(interval); };
    }, [syncUploadStatus]);

    const editorSessions = useMemo(function() {
        const list = Object.values(uploadSessions).filter(s => s.commandPreview && s.commandPreview.includes("--edit-only"));
        list.sort(function(a, b) { return (b.startedAt || "") < (a.startedAt || "") ? -1 : 1; });
        return list;
    }, [uploadSessions]);

    const runningCount = editorSessions.filter(s => s.status === 'running').length;
    const isRunning = runningCount > 0;

    const visibleLogs = useMemo(function() {
        let logs = logEntries;
        // Only show log entries belonging to edit-only sessions on this page
        const editSessionIds = new Set(editorSessions.map(s => s.sessionId));
        logs = logs.filter(e => e.sessionId && editSessionIds.has(e.sessionId));

        if (selectedSessionId) {
            logs = logs.filter(e => e.sessionId === selectedSessionId);
        }
        if (searchFilter) {
            const q = searchFilter.toLowerCase();
            logs = logs.filter(e => e.message && e.message.toLowerCase().includes(q));
        }
        return logs;
    }, [logEntries, editorSessions, selectedSessionId, searchFilter]);

    useEffect(function scrollLogs() {
        if (logEndRef.current) {
            logEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [visibleLogs]);

    async function handleStartEditing() {
        if (!window.api || !window.api.runUpload) return;

        // editOnly mode — no platform needed, bypasses platform validation
        const response = await window.api.runUpload({
            platforms: { youtube: false, instagram: false, facebook: false },
            options: Object.assign({}, options, { editOnly: true }),
            metadata: { title: "", description: "", musicTrack: "No Track" },
            schedule: { enabled: false }
        });

        if (response && response.sessionId) {
            useAppStore.setState(function(s) {
                const map = Object.assign({}, s.uploadSessions, { [response.sessionId]: response });
                return { uploadSessions: map };
            });
        }
    }

    function handleExportLogs() {
        var text = visibleLogs.map(function(e) {
            return "[" + (e.timestamp ? new Date(e.timestamp).toLocaleTimeString() : "--:--:--") + "] " + (e.message || "");
        }).join("\n");
        var blob = new Blob([text], { type: "text/plain" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "batch_edit_log_" + new Date().toISOString().slice(0, 10) + ".txt";
        a.click();
        URL.revokeObjectURL(url);
    }

    return (
        <section
            style={{ 
                margin: 0,
                padding: 0, 
                display: 'flex', 
                gap: 16, 
                overflow: 'hidden', 
                height: 'calc(100vh - 120px)', 
                background: 'transparent'
            }}
        >
            {/* ── LEFT COLUMN: Editor Settings ── */}
            <div style={{
                width: leftOpen ? 320 : 0,
                opacity: leftOpen ? 1 : 0,
                transition: 'width 0.22s ease-in-out, opacity 0.15s ease-in-out',
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
                overflowY: leftOpen ? 'auto' : 'hidden',
                background: '#111622',
                borderRadius: 16,
                border: leftOpen ? '1px solid var(--border)' : 'none',
                padding: leftOpen ? '16px' : '0px',
                gap: 12
            }} className="editor-sidebar">
                <h3 style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: 0.8 }}>Editor Settings</h3>
                
                {/* Formatting */}
                <SidebarSection title="Core Formatting" defaultOpen={true}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <ToggleSwitch
                            label="Crop to 9:16 Shorts"
                            checked={options.includeShorts}
                            onChange={v => setUploadOption('includeShorts', v)}
                        />
                        <ToggleSwitch
                            label="Background Music"
                            checked={options.includeMusic}
                            onChange={v => setUploadOption('includeMusic', v)}
                        />
                        <ToggleSwitch
                            label="Generate AI Metadata"
                            checked={options.includeMetadata}
                            onChange={v => setUploadOption('includeMetadata', v)}
                        />
                    </div>
                </SidebarSection>

                {/* Batch Settings */}
                <SidebarSection title="Batch Settings" defaultOpen={true}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                        <div style={sideRow}>
                            <span style={{ fontSize: 13 }}>Max Videos</span>
                            <ActionInput type="number" min={1} max={500} style={{ ...sideInput, width: 60 }}
                                value={options.maxVideos || 1}
                                onChange={e => setUploadOption('maxVideos', Math.max(1, parseInt(e.target.value, 10) || 1))} />
                        </div>
                        <div style={sideRow}>
                            <span style={{ fontSize: 13 }}>Shorts Max (sec)</span>
                            <ActionInput type="number" min={11} max={3600} style={{ ...sideInput, width: 80 }}
                                value={options.appendMaxSeconds || 180}
                                onChange={e => setUploadOption('appendMaxSeconds', Math.max(11, parseInt(e.target.value, 10) || 180))} />
                        </div>
                    </div>
                </SidebarSection>

                {/* Paths and Assets */}
                <SidebarSection title="Discovery & Paths" defaultOpen={true}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={sideRow}>
                            <span style={{ fontSize: 13 }}>Video Root</span>
                            <ActionInput type="text" placeholder="raw clips folder" style={sideInput}
                                value={options.videosRoot || ''}
                                onChange={e => setUploadOption('videosRoot', e.target.value)} />
                        </div>
                        <div style={sideRow}>
                            <span style={{ fontSize: 13 }}>Music Folder</span>
                            <ActionInput type="text" placeholder="MP3 directory" style={sideInput}
                                value={options.musicDir || ''}
                                onChange={e => setUploadOption('musicDir', e.target.value)} />
                        </div>
                        <div style={sideRow}>
                            <span style={{ fontSize: 13 }}>Extensions</span>
                            <ActionInput type="text" placeholder=".mp4,.mov" style={sideInput}
                                value={options.extensions || ''}
                                onChange={e => setUploadOption('extensions', e.target.value)} />
                        </div>
                    </div>
                </SidebarSection>
            </div>

            {/* ── RIGHT COLUMN: Console Log Viewer ── */}
            <div style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                background: '#0b0e13',
                borderRadius: 16,
                border: '1px solid var(--border)',
                overflow: 'hidden'
            }}>
                {/* Console Top Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 18px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.015)'
                }}>
                    <button
                        onClick={() => setLeftOpen(o => !o)}
                        style={{
                            fontSize: 12, padding: '5px 10px', borderRadius: 6,
                            background: '#1a1d24', border: '1px solid #334155', color: '#94a3b8',
                            display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer'
                        }}
                    >
                        {leftOpen ? "◀ Hide Settings" : "⚙️ Editor Settings"}
                    </button>
                    
                    <div style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: 10, color: '#f43f5e', textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: 700 }}>Local Processing</span>
                        <h4 style={{ margin: '2px 0 0', fontSize: 14, color: '#fff', fontWeight: 600 }}>Batch Video Editor</h4>
                    </div>

                    <div style={{ width: 100 }} />
                </div>

                {/* Control Actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            onClick={handleStartEditing}
                            disabled={isRunning}
                            style={{
                                display: 'inline-flex', alignItems: 'center', padding: '6px 14px', borderRadius: 6,
                                background: isRunning ? '#1f2937' : 'linear-gradient(135deg, rgba(244, 63, 94, 0.2), rgba(244, 63, 94, 0.08))',
                                border: isRunning ? '1px solid #374151' : '1px solid rgba(244, 63, 94, 0.3)', color: isRunning ? '#94a3b8' : '#fb7185', cursor: isRunning ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600
                            }}
                        >
                            {isRunning ? "Running Batch Edit..." : "Start Batch Edit"}
                        </button>
                        <button
                            onClick={() => stopUpload()}
                            disabled={!isRunning}
                            style={{
                                display: 'inline-flex', alignItems: 'center', padding: '6px 14px', borderRadius: 6,
                                background: !isRunning ? '#1f2937' : '#7f1d1d',
                                border: '1px solid #991b1b', color: '#fff', cursor: !isRunning ? 'not-allowed' : 'pointer', fontSize: 12
                            }}
                        >
                            Stop Process
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={clearLogs} style={{ padding: '5px 12px', borderRadius: 6, background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', fontSize: 11, cursor: 'pointer' }}>Clear</button>
                        <button onClick={handleExportLogs} style={{ padding: '5px 12px', borderRadius: 6, background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', fontSize: 11, cursor: 'pointer' }}>Export</button>
                    </div>
                </div>

                {/* Session Filter Chips */}
                {editorSessions.length > 0 && (
                    <div style={{ padding: "8px 16px", display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.1)' }}>
                        <span
                            onClick={function() { setSelectedSessionId(null); }}
                            style={{
                                display: "inline-flex", alignItems: "center", gap: 6,
                                background: "rgba(244, 63, 94, 0.1)", border: "1px solid rgba(244, 63, 94, 0.35)",
                                borderRadius: 20, padding: "2px 10px", fontSize: 11, color: "#fda4af",
                                cursor: "pointer", userSelect: "none",
                                outline: !selectedSessionId ? "2px solid #f43f5e" : "none", outlineOffset: 1
                            }}
                        >
                            All ({editorSessions.length})
                        </span>
                        {editorSessions.slice(0, 10).map(function(session) {
                            return (
                                <SessionChip
                                    key={session.sessionId}
                                    session={session}
                                    selected={selectedSessionId === session.sessionId}
                                    onClick={function() { setSelectedSessionId(session.sessionId); }}
                                    onStop={session.status === "running" ? stopSession : null}
                                />
                            );
                        })}
                    </div>
                )}

                {/* Search Bar */}
                <div style={{ padding: '8px 16px', background: 'rgba(0,0,0,0.15)', borderBottom: '1px solid var(--border)' }}>
                    <input
                        type="text"
                        placeholder={selectedSessionId ? "Search logs in selected session…" : "Search all logs…"}
                        value={searchFilter}
                        onChange={function(e) { setSearchFilter(e.target.value); }}
                        style={{
                            width: "100%", padding: "6px 10px", borderRadius: 6,
                            border: "1px solid #334155", background: "#0d0d1a", color: "#ccc", fontSize: 12, outline: 'none'
                        }}
                    />
                </div>

                {/* Autoscrolling Logs Viewer */}
                <div style={{ flex: 1, padding: 14, overflow: 'auto', background: '#080a0f', fontFamily: 'Consolas, monospace', fontSize: 12 }}>
                    {visibleLogs.length === 0 && (
                        <div style={{ padding: "40px 16px", textAlign: "center", color: "#475569", fontSize: 13 }}>
                            {logEntries.length === 0
                                ? "No batch editing logs available. Press 'Start Batch Edit' to run."
                                : "No logs match the current search filter."}
                        </div>
                    )}
                    {visibleLogs.map(function(entry) {
                        const stream = entry.stream || entry.type || "log";
                        const streamColor = stream === 'stderr' ? '#f87171' : stream === 'system' ? '#38bdf8' : '#cbd5e1';

                        return (
                            <div key={entry.id} style={{ color: streamColor, marginBottom: 4, whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                                <span style={{ color: 'rgba(255,255,255,0.3)', marginRight: 6 }}>
                                    [{entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : "--:--:--"}]
                                </span>
                                {entry.message || ""}
                            </div>
                        );
                    })}
                    <div ref={logEndRef} />
                </div>
            </div>
        </section>
    );
}
