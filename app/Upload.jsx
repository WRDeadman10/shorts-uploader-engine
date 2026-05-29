import { useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ToggleSwitch from "./ToggleSwitch.jsx";
import UploadAdvancedOptions from './UploadAdvancedOptions.jsx';
import { useAppStore } from "./useAppStore.js";
import ActionInput from "./ActionInput.jsx";

// ── Thin themed scrollbar injected once ───────────────────────────────────────
const SCROLLBAR_STYLE = `
.upload-sidebar::-webkit-scrollbar { width: 4px; }
.upload-sidebar::-webkit-scrollbar-track { background: transparent; }
.upload-sidebar::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
.upload-sidebar::-webkit-scrollbar-thumb:hover { background: #4f46e5; }
`;
if (typeof document !== "undefined" && !document.getElementById("upload-sidebar-sb")) {
    const s = document.createElement("style");
    s.id = "upload-sidebar-sb";
    s.textContent = SCROLLBAR_STYLE;
    document.head.appendChild(s);
}

// ── Collapsible section wrapper ────────────────────────────────────────────────
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

// ── Console Status Colors ─────────────────────────────────────────────────────
const STATUS_COLORS = {
    running:   { bg: "rgba(245,158,11,0.15)",  border: "rgba(245,158,11,0.45)",  color: "#fbbf24" },
    completed: { bg: "rgba(5,150,105,0.12)",   border: "rgba(5,150,105,0.4)",    color: "#34d399" },
    done:      { bg: "rgba(5,150,105,0.12)",   border: "rgba(5,150,105,0.4)",    color: "#34d399" },
    error:     { bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.4)",    color: "#f87171" },
    stopped:   { bg: "rgba(100,116,139,0.12)", border: "rgba(100,116,139,0.35)", color: "#94a3b8" },
};

function SessionChip({ session, selected, onClick, onStop })
{
    const c = STATUS_COLORS[session.status] || STATUS_COLORS.stopped;
    const isRunning = session.status === "running";
    const label = session.platform || session.toolName || ("…" + session.sessionId.slice(-4));
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
                    title="Stop this process"
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

const platformOptions = [
    { id: "youtube",   label: "YouTube Shorts" },
    { id: "instagram", label: "Instagram Reels" },
    { id: "facebook",  label: "Facebook Reels" }
];

const uploadOptions = [
    { id: "includeShorts",   label: "Shorts Format" },
    { id: "includeMusic",    label: "Music Overlay" },
    { id: "includeMetadata", label: "AI Metadata" },
    { id: "editOnly",        label: "Edit Only Mode" }
];

const sideRow = {
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', padding: '5px 0',
};

const sideInput = {
    padding: '4px 8px', borderRadius: 4,
    border: '1px solid #334155', background: '#1a1a2e',
    color: '#fff', fontSize: 13, width: 110,
};

const toolCardStyle = {
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    flexShrink: 0
};

const toolStatusStyle = {
    fontSize: 11,
    color: '#a3e635',
    marginTop: 4,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all'
};

const labelStyle = { display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 };

function Upload()
{
    // ── Collapsible Sidebars State ──
    const [leftOpen, setLeftOpen] = useState(true);
    const [rightOpen, setRightOpen] = useState(true);

    // ── Search & Filter State ──
    const [searchFilter, setSearchFilter] = useState("");
    const [selectedSessionId, setSelectedSessionId] = useState(null);
    const [historyOpen, setHistoryOpen] = useState(false);

    // ── Maintenance Tool Inputs State ──
    const [valorantPlayer, setValorantPlayer] = useState(() => {
        return localStorage.getItem("valorantPlayerName") || "";
    });

    useEffect(() => {
        localStorage.setItem("valorantPlayerName", valorantPlayer);
    }, [valorantPlayer]);
    const [deleteDryRun, setDeleteDryRun] = useState(true);

    // ── Maintenance Tool Run Statuses ──
    const [valorantStatus, setValorantStatus] = useState("");
    const [auditStatus, setAuditStatus] = useState("");
    const [deleteStatus, setDeleteStatus] = useState("");

    // ── Store Selectors ──
    const platforms     = useAppStore(s => s.uploadPlatforms);
    const options       = useAppStore(s => s.uploadOptions);
    const uploadStatus  = useAppStore(s => s.uploadStatus);
    const setUploadPlatform = useAppStore(s => s.setUploadPlatform);
    const setUploadOption   = useAppStore(s => s.setUploadOption);
    const runUpload         = useAppStore(s => s.runUpload);
    const stopUpload        = useAppStore(s => s.stopUpload);
    const syncUploadStatus  = useAppStore(s => s.syncUploadStatus);
    const logEntries   = useAppStore(s => s.logEntries);
    const clearLogs    = useAppStore(s => s.clearLogs);
    const startConsole = useAppStore(s => s.startConsole);
    const stopConsole  = useAppStore(s => s.stopConsole);
    const stopSession  = useAppStore(s => s.stopSession);
    const commandHistory = useAppStore(s => s.commandHistory);

    const scheduleEnabled   = useAppStore(s => s.scheduleEnabled);
    const scheduleDate      = useAppStore(s => s.scheduleDate);
    const youtubeSlots      = useAppStore(s => s.youtubeSlots);
    const facebookSlots     = useAppStore(s => s.facebookSlots);
    const instagramSlots    = useAppStore(s => s.instagramSlots);
    const setScheduleEnabled  = useAppStore(s => s.setScheduleEnabled);
    const setScheduleDate     = useAppStore(s => s.setScheduleDate);
    const addYoutubeSlot      = useAppStore(s => s.addYoutubeSlot);
    const removeYoutubeSlot   = useAppStore(s => s.removeYoutubeSlot);
    const updateYoutubeSlot   = useAppStore(s => s.updateYoutubeSlot);
    const addFacebookSlot     = useAppStore(s => s.addFacebookSlot);
    const removeFacebookSlot  = useAppStore(s => s.removeFacebookSlot);
    const updateFacebookSlot  = useAppStore(s => s.updateFacebookSlot);
    const addInstagramSlot    = useAppStore(s => s.addInstagramSlot);
    const removeInstagramSlot = useAppStore(s => s.removeInstagramSlot);
    const updateInstagramSlot = useAppStore(s => s.updateInstagramSlot);

    const uploadSessions = useAppStore(s => s.uploadSessions);
    const toolSessions   = useAppStore(s => s.toolSessions);

    // ── Scroll to Bottom Ref ──
    const logEndRef = useRef(null);

    useEffect(function pollStatus()
    {
        syncUploadStatus();
        const interval = setInterval(syncUploadStatus, 2000);
        return function() { clearInterval(interval); };
    }, [syncUploadStatus]);

    // ── Build Sessions & Logs Lists ──
    const allSessions = useMemo(function()
    {
        const list = Object.values(uploadSessions)
            .filter(s => !(s.commandPreview && s.commandPreview.includes("--edit-only")))
            .concat(Object.values(toolSessions));
        list.sort(function(a, b) { return (b.startedAt || "") < (a.startedAt || "") ? -1 : 1; });
        return list;
    }, [uploadSessions, toolSessions]);

    const runningCount = allSessions.filter(function(s) { return s.status === 'running'; }).length;
    const isRunning = runningCount > 0 || uploadStatus.status === 'running';

    const visibleLogs = useMemo(function()
    {
        let logs = logEntries;
        // Filter out edit-only session logs from this view
        const editSessionIds = new Set(
            Object.values(uploadSessions)
                .filter(s => s.commandPreview && s.commandPreview.includes("--edit-only"))
                .map(s => s.sessionId)
        );
        logs = logs.filter(e => !e.sessionId || !editSessionIds.has(e.sessionId));

        if (selectedSessionId)
        {
            logs = logs.filter(function(e) { return e.sessionId === selectedSessionId; });
        }
        if (searchFilter)
        {
            const q = searchFilter.toLowerCase();
            logs = logs.filter(function(e) { return e.message && e.message.toLowerCase().includes(q); });
        }
        return logs;
    }, [logEntries, uploadSessions, selectedSessionId, searchFilter]);

    // Autoscroll logs
    useEffect(function scrollLogs()
    {
        if (logEndRef.current)
        {
            logEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [visibleLogs]);

    const instagramDirectUpload = platforms.instagram && !platforms.youtube;
    const effectiveScheduleEnabled = !instagramDirectUpload && scheduleEnabled;

    // ── Export Logs Function ──
    function handleExportLogs()
    {
        var text = visibleLogs.map(function(e)
        {
            let platformOrTool = "";
            if (e.sessionId) {
                const uploadSession = uploadSessions[e.sessionId];
                if (uploadSession && uploadSession.platform) {
                    platformOrTool = uploadSession.platform.replace(/\+/g, ' + ');
                } else {
                    const toolSession = toolSessions[e.sessionId];
                    if (toolSession && toolSession.toolName) {
                        platformOrTool = toolSession.toolName.split(/[/\\]/).pop();
                    } else {
                        const initEntry = logEntries.find(le => le.sessionId === e.sessionId && le.message && (
                            le.message.startsWith('[tool] Starting ') ||
                            le.message.startsWith('Starting process: ')
                        ));
                        if (initEntry) {
                            if (initEntry.message.startsWith('[tool] Starting ')) {
                                const parts = initEntry.message.split(' ');
                                if (parts.length > 2) {
                                    platformOrTool = parts[2].split(/[/\\]/).pop();
                                }
                            }
                        }
                    }
                }
            }
            if (!platformOrTool) {
                platformOrTool = e.sessionType === 'tool' ? 'tool' : 'upload';
            }

            const sessionSuffix = (!selectedSessionId && allSessions.length > 1 && e.sessionId)
                ? ("…" + e.sessionId.slice(-4)) + " › "
                : "";

            return "[" + (e.timestamp ? new Date(e.timestamp).toLocaleTimeString() : "--:--:--") + "] [" + platformOrTool + "] [" + (e.stream || "log") + "]" + sessionSuffix + (e.message || "");
        }).join("\n");
        var blob = new Blob([text], { type: "text/plain" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "pipeline_log_" + new Date().toISOString().slice(0, 10) + ".txt";
        a.click();
        URL.revokeObjectURL(url);
    }

    // ── Simplified Maintenance Tool Runners ──
    async function runValorantTool()
    {
        const root = options.videosRoot;
        if (!root) { setValorantStatus("Video Root directory is required (set it in left panel under Discovery)."); return; }
        if (!valorantPlayer) { setValorantStatus("Player Name is required."); return; }

        const args = ['--root', root, '--player', valorantPlayer];
        setValorantStatus('running… fetching match records');
        
        if (!window.api || !window.api.runTool) { setValorantStatus('API not available'); return; }
        const r = await window.api.runTool({ toolName: 'tools/valorant-clip-metadata/batch_runner.py', args });
        setValorantStatus(r.success ? 'started (PID ' + r.pid + ')' : r.errorMessage);
    }

    async function runLiveAuditTool()
    {
        const root = options.videosRoot;
        if (!root) { setAuditStatus("Video Root is required (set it in left panel under Discovery)."); return; }

        const args = ['--root', root];
        if (options.metaAccessToken) args.push('--meta-access-token', options.metaAccessToken);
        if (options.igUserId)        args.push('--ig-user-id',        options.igUserId);
        if (options.fbPageId)        args.push('--facebook-page-id',  options.fbPageId);
        if (options.metaGraphVersion) args.push('--graph-version',     options.metaGraphVersion);
        if (options.clientSecretsPath) args.push('--client-secrets',   options.clientSecretsPath);
        if (options.tokenFilePath)    args.push('--token-file',        options.tokenFilePath);

        setAuditStatus('running… querying live inventories');
        
        if (!window.api || !window.api.runTool) { setAuditStatus('API not available'); return; }
        const r = await window.api.runTool({ toolName: 'generateLiveUploadAudit.py', args });
        setAuditStatus(r.success ? 'started (PID ' + r.pid + ')' : r.errorMessage);
    }

    async function runDeleteTool()
    {
        const root = options.videosRoot;
        if (!root) { setDeleteStatus("Video Root is required (set it in left panel under Discovery)."); return; }

        const activePlatforms = [];
        if (platforms.youtube) activePlatforms.push("youtube");
        if (platforms.instagram) activePlatforms.push("instagram");
        if (platforms.facebook) activePlatforms.push("facebook");

        if (!activePlatforms.length) { setDeleteStatus('Enable at least one platform in left settings.'); return; }

        const args = ['--root', root, '--platforms', activePlatforms.join(',')];
        if (deleteDryRun) args.push('--dry-run');

        setDeleteStatus(deleteDryRun ? 'running dry run…' : 'deleting uploaded source files…');
        
        if (!window.api || !window.api.runTool) { setDeleteStatus('API not available'); return; }
        const r = await window.api.runTool({ toolName: 'deleteUploadedVideos.py', args });
        setDeleteStatus(r.success ? 'started (PID ' + r.pid + ')' : r.errorMessage);
    }

    async function handleStopAll()
    {
        if (window.api && window.api.stopTool)
        {
            await window.api.stopTool();
        }
        stopUpload();
        setValorantStatus('stopped');
        setAuditStatus('stopped');
        setDeleteStatus('stopped');
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
                minHeight: 'unset',
                background: 'transparent'
            }}
        >
            {/* ── LEFT COLUMN: Uploader Settings ── */}
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
            }} className="upload-sidebar">
                <h3 style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: 0.8 }}>Uploader Settings</h3>
                
                {/* Platforms */}
                <SidebarSection title="Platforms" defaultOpen={true}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {platformOptions.map(p => (
                            <ToggleSwitch key={p.id} label={p.label} checked={platforms[p.id]}
                                onChange={v => setUploadPlatform(p.id, v)} />
                        ))}
                        <ToggleSwitch
                            label="Full size Video"
                            checked={!!options.fullSizeVideo}
                            onChange={v => setUploadOption('fullSizeVideo', v)}
                        />
                    </div>
                </SidebarSection>

                {/* Core Options */}
                <SidebarSection title="Options" defaultOpen={true}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                        {uploadOptions.map(o => (
                            <ToggleSwitch key={o.id} label={o.label} checked={options[o.id]}
                                onChange={v => setUploadOption(o.id, v)} />
                        ))}
                        <div style={sideRow}>
                            <span style={{ fontSize: 13 }}>Max Videos</span>
                            <ActionInput type="number" min={1} max={500} style={{ ...sideInput, width: 60 }}
                                value={options.maxVideos || 1}
                                onChange={e => setUploadOption('maxVideos', Math.max(1, parseInt(e.target.value, 10) || 1))} />
                        </div>
                        <div style={sideRow}>
                            <span style={{ fontSize: 13 }}>Append Max (sec)</span>
                            <ActionInput type="number" min={11} max={3600} style={{ ...sideInput, width: 80 }}
                                value={options.appendMaxSeconds || 180}
                                onChange={e => setUploadOption('appendMaxSeconds', Math.max(11, parseInt(e.target.value, 10) || 180))} />
                        </div>
                        <div style={sideRow}>
                            <span style={{ fontSize: 13 }}>Privacy</span>
                            <select style={{ ...sideInput, width: 100 }} value={options.privacy || ''}
                                onChange={e => setUploadOption('privacy', e.target.value)}>
                                <option value="">Default</option>
                                <option value="private">Private</option>
                                <option value="unlisted">Unlisted</option>
                                <option value="public">Public</option>
                            </select>
                        </div>
                        <div style={{...sideRow, flexDirection: 'column', alignItems: 'stretch', gap: 6}}>
                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                <span style={{ fontSize: 13 }} title="Your long-lived Meta Master access token">Meta Master Token</span>
                                <button onClick={async () => {
                                    if (!window.api || !window.api.refreshMetaToken) return;
                                    if (!options.metaMasterToken || !options.fbPageId) {
                                        useAppStore.getState().setErrorMessage("Please enter both Meta Master Token and FB Page ID (in Advanced).");
                                        return;
                                    }
                                    const res = await window.api.refreshMetaToken(options.metaMasterToken, options.fbPageId, options.metaGraphVersion || 'v25.0');
                                    if (res && res.success) {
                                        setUploadOption('metaAccessToken', res.pageToken);
                                        if (res.igUserId) setUploadOption('igUserId', res.igUserId);
                                        useAppStore.getState().setErrorMessage("");
                                    } else {
                                        useAppStore.getState().setErrorMessage("Meta master token has expired or is invalid you need to update it. " + (res?.errorMessage || ""));
                                    }
                                }} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: '#4f46e5', border: 'none', color: '#fff', cursor: 'pointer' }}>Get Token</button>
                            </div>
                            <ActionInput type="text" placeholder="EAA..." style={{ ...sideInput, width: '100%' }}
                                value={options.metaMasterToken || ''}
                                onChange={e => setUploadOption('metaMasterToken', e.target.value)} />
                        </div>
                    </div>
                </SidebarSection>

                {/* Queue Filters */}
                <SidebarSection title="Queue Filters" defaultOpen={false}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <ToggleSwitch
                            label="Unique"
                            checked={!!options.uniqueQueueOnly}
                            onChange={v => setUploadOption('uniqueQueueOnly', v)}
                        />
                        <div style={sideRow}>
                            <span style={{ fontSize: 13 }}>Uploaded On</span>
                            <ActionInput type="text" placeholder="youtube" style={sideInput}
                                value={options.requireUploadedOn || ''}
                                onChange={e => setUploadOption('requireUploadedOn', e.target.value)} />
                        </div>
                        <div style={sideRow}>
                            <span style={{ fontSize: 13 }}>Missing On</span>
                            <ActionInput type="text" placeholder="instagram" style={sideInput}
                                value={options.requireMissingOn || ''}
                                onChange={e => setUploadOption('requireMissingOn', e.target.value)} />
                        </div>
                    </div>
                </SidebarSection>

                {/* Discovery Filters */}
                <SidebarSection title="Discovery Filters" defaultOpen={true}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={sideRow}>
                            <span style={{ fontSize: 13 }}>Extensions</span>
                            <ActionInput type="text" placeholder=".mp4,.mov" style={sideInput}
                                value={options.extensions || ''}
                                onChange={e => setUploadOption('extensions', e.target.value)} />
                        </div>
                        <div style={sideRow}>
                            <span style={{ fontSize: 13 }}>Exclude Dirs</span>
                            <ActionInput type="text" placeholder="drafts,archive" style={sideInput}
                                value={options.excludeDirectories || ''}
                                onChange={e => setUploadOption('excludeDirectories', e.target.value)} />
                        </div>
                        <div style={sideRow}>
                            <span style={{ fontSize: 13 }}>Videos Root</span>
                            <ActionInput type="text" placeholder="folder path" style={sideInput}
                                value={options.videosRoot || ''}
                                onChange={e => setUploadOption('videosRoot', e.target.value)} />
                        </div>
                        <div style={sideRow}>
                            <span style={{ fontSize: 13 }}>Playlist</span>
                            <ActionInput type="text" placeholder="Optional" style={sideInput}
                                value={options.playlistName || ''}
                                onChange={e => setUploadOption('playlistName', e.target.value)} />
                        </div>
                    </div>
                </SidebarSection>

                {/* Credentials */}
                <SidebarSection title="Credentials" defaultOpen={false}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div style={sideRow}>
                            <span style={{ fontSize: 13 }}>Secrets JSON</span>
                            <ActionInput type="text" placeholder="client_secret.json" style={{ ...sideInput, width: '100%' }}
                                value={options.clientSecretsPath || ''}
                                onChange={e => setUploadOption('clientSecretsPath', e.target.value)} />
                        </div>
                        <div style={sideRow}>
                            <span style={{ fontSize: 13 }}>Token File</span>
                            <ActionInput type="text" placeholder="token.json" style={{ ...sideInput, width: '100%' }}
                                value={options.tokenFilePath || ''}
                                onChange={e => setUploadOption('tokenFilePath', e.target.value)} />
                        </div>
                    </div>
                </SidebarSection>

                {/* Advanced */}
                <SidebarSection title="Advanced" defaultOpen={false}>
                    <UploadAdvancedOptions options={options} setUploadOption={setUploadOption} />
                </SidebarSection>

                {/* Scheduled Publishing */}
                <SidebarSection title="Scheduled Publishing" defaultOpen={false}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            <ToggleSwitch label="Enable Schedule" checked={effectiveScheduleEnabled} onChange={setScheduleEnabled} disabled={instagramDirectUpload} />
                            {effectiveScheduleEnabled && (
                                <ActionInput type="date" value={scheduleDate}
                                    onChange={e => setScheduleDate(e.target.value)}
                                    style={{ ...sideInput, width: 140 }} />
                            )}
                        </div>
                        {effectiveScheduleEnabled && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {platforms.youtube && (
                                    <div>
                                        <p style={{ fontSize: 11, color: '#818cf8', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 6px' }}>YouTube Slots</p>
                                        {youtubeSlots.map((slot, i) => (
                                            <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 5 }}>
                                                <ActionInput type="time" value={slot.time}
                                                    onChange={e => updateYoutubeSlot(i, 'time', e.target.value)}
                                                    style={{ flex: 1, ...sideInput, width: 'auto' }} />
                                                <ActionInput type="number" min={1} value={slot.count}
                                                    onChange={e => updateYoutubeSlot(i, 'count', parseInt(e.target.value) || 1)}
                                                    style={{ ...sideInput, width: 44 }} />
                                                <button onClick={() => removeYoutubeSlot(i)}
                                                    style={{ padding: '4px 6px', borderRadius: 4, border: 'none', background: '#374151', color: '#fff', cursor: 'pointer', fontSize: 11 }}>✕</button>
                                            </div>
                                        ))}
                                        <button onClick={addYoutubeSlot}
                                            style={{ fontSize: 11, color: '#818cf8', background: 'transparent', border: '1px solid #4f46e5', borderRadius: 4, padding: '3px 8px', cursor: 'pointer' }}>+ Add</button>
                                    </div>
                                )}
                                {platforms.facebook && (
                                    <div>
                                        <p style={{ fontSize: 11, color: '#818cf8', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 6px' }}>Facebook Slots</p>
                                        {facebookSlots.map((slot, i) => (
                                            <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 5 }}>
                                                <ActionInput type="time" value={slot.time}
                                                    onChange={e => updateFacebookSlot(i, 'time', e.target.value)}
                                                    style={{ flex: 1, ...sideInput, width: 'auto' }} />
                                                <ActionInput type="number" min={1} value={slot.count}
                                                    onChange={e => updateFacebookSlot(i, 'count', parseInt(e.target.value) || 1)}
                                                    style={{ ...sideInput, width: 44 }} />
                                                <button onClick={() => removeFacebookSlot(i)}
                                                    style={{ padding: '4px 6px', borderRadius: 4, border: 'none', background: '#374151', color: '#fff', cursor: 'pointer', fontSize: 11 }}>×</button>
                                            </div>
                                        ))}
                                        <button onClick={addFacebookSlot}
                                            style={{ fontSize: 11, color: '#818cf8', background: 'transparent', border: '1px solid #4f46e5', borderRadius: 4, padding: '3px 8px', cursor: 'pointer' }}>+ Add</button>
                                    </div>
                                )}
                                {platforms.instagram && (
                                    <div>
                                        <p style={{ fontSize: 11, color: '#818cf8', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 6px' }}>Instagram Slots</p>
                                        {instagramSlots.map((slot, i) => (
                                            <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 5 }}>
                                                <ActionInput type="time" value={slot.time}
                                                    onChange={e => updateInstagramSlot(i, 'time', e.target.value)}
                                                    style={{ flex: 1, ...sideInput, width: 'auto' }} />
                                                <ActionInput type="number" min={1} value={slot.count}
                                                    onChange={e => updateInstagramSlot(i, 'count', parseInt(e.target.value) || 1)}
                                                    style={{ ...sideInput, width: 44 }} />
                                                <button onClick={() => removeInstagramSlot(i)}
                                                    style={{ padding: '4px 6px', borderRadius: 4, border: 'none', background: '#374151', color: '#fff', cursor: 'pointer', fontSize: 11 }}>×</button>
                                            </div>
                                        ))}
                                        <button onClick={addInstagramSlot}
                                            style={{ fontSize: 11, color: '#818cf8', background: 'transparent', border: '1px solid #4f46e5', borderRadius: 4, padding: '3px 8px', cursor: 'pointer' }}>+ Add</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </SidebarSection>

            </div>

            {/* ── MIDDLE COLUMN: Console Log Viewer ── */}
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
                        {leftOpen ? "◀ Hide Settings" : "⚙️ Uploader Settings"}
                    </button>
                    
                    <div style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: 10, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: 700 }}>Execution Logs</span>
                        <h4 style={{ margin: '2px 0 0', fontSize: 14, color: '#fff', fontWeight: 600 }}>Pipeline Control</h4>
                    </div>

                    <button
                        onClick={() => setRightOpen(o => !o)}
                        style={{
                            fontSize: 12, padding: '5px 10px', borderRadius: 6,
                            background: '#1a1d24', border: '1px solid #334155', color: '#94a3b8',
                            display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer'
                        }}
                    >
                        {rightOpen ? "Hide Tools ▶" : "🛠️ Maintenance Tools"}
                    </button>
                </div>

                {/* Main Console Actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            onClick={runUpload}
                            style={{
                                display: 'inline-flex', alignItems: 'center', padding: '6px 14px', borderRadius: 6,
                                background: 'linear-gradient(135deg, rgba(0, 255, 198, 0.2), rgba(0, 255, 198, 0.08))',
                                border: '1px solid rgba(0, 255, 198, 0.3)', color: '#00ffc6', cursor: 'pointer', fontSize: 12, fontWeight: 600
                            }}
                        >
                            Start Upload Pipeline
                        </button>

                        <button
                            onClick={handleStopAll}
                            disabled={!isRunning}
                            style={{
                                display: 'inline-flex', alignItems: 'center', padding: '6px 14px', borderRadius: 6,
                                background: !isRunning ? '#1f2937' : '#7f1d1d',
                                border: '1px solid #991b1b', color: '#fff', cursor: !isRunning ? 'not-allowed' : 'pointer', fontSize: 12
                            }}
                        >
                            Stop All
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={clearLogs} style={{ padding: '5px 12px', borderRadius: 6, background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', fontSize: 11, cursor: 'pointer' }}>Clear</button>
                        <button onClick={handleExportLogs} style={{ padding: '5px 12px', borderRadius: 6, background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', fontSize: 11, cursor: 'pointer' }}>Export</button>
                    </div>
                </div>

                {/* Session Filter Chips */}
                {allSessions.length > 0 && (
                    <div style={{ padding: "8px 16px", display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.1)' }}>
                        <span
                            onClick={function() { setSelectedSessionId(null); }}
                            style={{
                                display: "inline-flex", alignItems: "center", gap: 6,
                                background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.35)",
                                borderRadius: 20, padding: "2px 10px", fontSize: 11, color: "#a5b4fc",
                                cursor: "pointer", userSelect: "none",
                                outline: !selectedSessionId ? "2px solid #6366f1" : "none", outlineOffset: 1
                            }}
                        >
                            All ({allSessions.length})
                        </span>
                        {allSessions.slice(0, 10).map(function(session) {
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
                                ? "No pipeline logs available. Press 'Start Upload Pipeline' to launch."
                                : "No logs match the current search filter."}
                        </div>
                    )}
                    {visibleLogs.map(function(entry)
                    {
                        const stream = entry.stream || entry.type || "log";
                        const streamColor = stream === 'stderr' ? '#f87171' : stream === 'system' ? '#38bdf8' : '#cbd5e1';
                        
                        let platformOrTool = "";
                        if (entry.sessionId) {
                            const uploadSession = uploadSessions[entry.sessionId];
                            if (uploadSession && uploadSession.platform) {
                                platformOrTool = uploadSession.platform.replace(/\+/g, ' + ');
                            } else {
                                const toolSession = toolSessions[entry.sessionId];
                                if (toolSession && toolSession.toolName) {
                                    platformOrTool = toolSession.toolName.split(/[/\\]/).pop();
                                } else {
                                    const initEntry = logEntries.find(e => e.sessionId === entry.sessionId && e.message && (
                                        e.message.startsWith('[tool] Starting ') ||
                                        e.message.startsWith('Starting process: ')
                                    ));
                                    if (initEntry) {
                                        if (initEntry.message.startsWith('[tool] Starting ')) {
                                            const parts = initEntry.message.split(' ');
                                            if (parts.length > 2) {
                                                platformOrTool = parts[2].split(/[/\\]/).pop();
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        if (!platformOrTool) {
                            platformOrTool = entry.sessionType === 'tool' ? 'tool' : 'upload';
                        }

                        const sessionSuffix = (!selectedSessionId && allSessions.length > 1 && entry.sessionId)
                            ? ("…" + entry.sessionId.slice(-4)) + " › "
                            : "";

                        return (
                            <div key={entry.id} style={{ color: streamColor, marginBottom: 4, whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                                <span style={{ color: 'rgba(255,255,255,0.3)', marginRight: 6 }}>
                                    [{entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : "--:--:--"}] [{platformOrTool}] [{stream}]
                                </span>
                                <span>
                                    {sessionSuffix && (
                                        <span style={{ opacity: 0.45, fontSize: 10, fontStyle: "italic", marginRight: 4 }}>{sessionSuffix}</span>
                                    )}
                                    {entry.message}
                                </span>
                            </div>
                        );
                    })}
                    <div ref={logEndRef} />
                </div>

                {/* Command History Drawer */}
                {commandHistory.length > 0 && (
                    <div style={{ borderTop: "1px solid #1f2937", background: 'rgba(0,0,0,0.2)' }}>
                        <button
                            type="button"
                            onClick={function() { setHistoryOpen(!historyOpen); }}
                            style={{
                                width: '100%', padding: '8px 16px', background: 'transparent', border: 'none',
                                color: '#94a3b8', fontSize: 11, cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between'
                            }}
                        >
                            <span>{historyOpen ? "▼ Hide Command History" : "▲ Show Command History (" + commandHistory.length + ")"}</span>
                        </button>
                        {historyOpen && (
                            <div style={{ padding: '0 16px 12px', maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {commandHistory.slice(-5).reverse().map(function(entry) {
                                    return (
                                        <div key={entry.id} style={{ background: "rgba(255,255,255,0.02)", border: '1px solid var(--border)', borderRadius: 6, padding: "8px", fontSize: 11 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', marginBottom: 2 }}>
                                                <span>{entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : ""}</span>
                                                <span style={{ color: '#818cf8' }}>{(entry.platforms || []).join(", ")}</span>
                                            </div>
                                            <p style={{ color: '#cbd5e1', margin: '2px 0 6px', fontFamily: 'Consolas, monospace', fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.commandPreview}</p>
                                            <button
                                                onClick={runUpload}
                                                style={{ padding: "3px 8px", borderRadius: 4, border: "none", background: "#4f46e5", color: "#fff", cursor: "pointer", fontSize: 10 }}
                                            >
                                                Re-Run
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── RIGHT COLUMN: Simplified Maintenance Tools ── */}
            <div style={{
                width: rightOpen ? 320 : 0,
                opacity: rightOpen ? 1 : 0,
                transition: 'width 0.22s ease-in-out, opacity 0.15s ease-in-out',
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
                overflowY: rightOpen ? 'auto' : 'hidden',
                background: '#111622',
                borderRadius: 16,
                border: rightOpen ? '1px solid var(--border)' : 'none',
                padding: rightOpen ? '16px' : '0px',
                gap: 14
            }} className="upload-sidebar">
                <h3 style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: 0.8 }}>Maintenance Tools</h3>

                {/* Valorant Metadata Generator */}
                <div style={toolCardStyle}>
                    <div>
                        <h4 style={{ margin: 0, fontSize: 13, color: '#fff', fontWeight: 600 }}>Valorant Metadata</h4>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b' }}>Generate match highlights metadata from tracker logs.</p>
                    </div>
                    <div>
                        <label style={labelStyle}>Player Name</label>
                        <ActionInput
                            type="text"
                            placeholder="Ragnar Lothbrok#CR7"
                            value={valorantPlayer}
                            onChange={(e) => setValorantPlayer(e.target.value)}
                            style={{ ...sideInput, width: '100%' }}
                        />
                    </div>
                    <button
                        onClick={runValorantTool}
                        style={{
                            padding: '6px 12px', borderRadius: 6, background: '#4f46e5', color: '#fff',
                            fontWeight: 600, fontSize: 11, cursor: 'pointer', textAlign: 'center'
                        }}
                    >
                        Generate Metadata
                    </button>
                    {valorantStatus && <p style={toolStatusStyle}>{valorantStatus}</p>}
                </div>

                {/* Live Upload Audit */}
                <div style={toolCardStyle}>
                    <div>
                        <h4 style={{ margin: 0, fontSize: 13, color: '#fff', fontWeight: 600 }}>Live Upload Audit</h4>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b' }}>Fetch feed snap from Meta & YouTube to reconcile local files.</p>
                    </div>
                    <button
                        onClick={runLiveAuditTool}
                        style={{
                            padding: '6px 12px', borderRadius: 6, background: '#4f46e5', color: '#fff',
                            fontWeight: 600, fontSize: 11, cursor: 'pointer', textAlign: 'center'
                        }}
                    >
                        Run Live Audit
                    </button>
                    {auditStatus && <p style={toolStatusStyle}>{auditStatus}</p>}
                </div>

                {/* Delete Uploaded Videos */}
                <div style={toolCardStyle}>
                    <div>
                        <h4 style={{ margin: 0, fontSize: 13, color: '#fff', fontWeight: 600 }}>Delete Uploaded</h4>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b' }}>Remove local video files that are fully posted to active platforms.</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                            type="checkbox"
                            id="del-dry-run"
                            checked={deleteDryRun}
                            onChange={(e) => setDeleteDryRun(e.target.checked)}
                            style={{ cursor: 'pointer' }}
                        />
                        <label htmlFor="del-dry-run" style={{ fontSize: 12, color: '#fbbf24', cursor: 'pointer', fontWeight: 500 }}>
                            Dry Run (preview only)
                        </label>
                    </div>
                    <button
                        onClick={runDeleteTool}
                        style={{
                            padding: '6px 12px', borderRadius: 6,
                            background: deleteDryRun ? '#4f46e5' : '#991b1b',
                            color: '#fff', fontWeight: 600, fontSize: 11, cursor: 'pointer', textAlign: 'center'
                        }}
                    >
                        {deleteDryRun ? "Preview Deletions" : "⚠ Delete Files"}
                    </button>
                    {deleteStatus && <p style={toolStatusStyle}>{deleteStatus}</p>}
                </div>

            </div>

        </section>
    );
}

export default Upload;
