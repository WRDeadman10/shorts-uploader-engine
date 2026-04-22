import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useAppStore } from "./useAppStore.js";

// ── Status colours ─────────────────────────────────────────────────────────
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
                padding: "4px 12px", fontSize: 12, color: c.color,
                cursor: "pointer", userSelect: "none",
                outline: selected ? "2px solid " + c.color : "none", outlineOffset: 2,
                transition: "opacity 0.15s"
            }}
        >
            <span style={{
                width: 7, height: 7, borderRadius: "50%", background: c.color, flexShrink: 0,
                boxShadow: isRunning ? "0 0 6px " + c.color : "none"
            }} />
            <span>{label}</span>
            {time && <span style={{ opacity: 0.55, fontSize: 10 }}>{time}</span>}
            {isRunning && onStop && (
                <span
                    onClick={function(e) { e.stopPropagation(); onStop(session.sessionId); }}
                    title="Stop this process"
                    style={{
                        marginLeft: 2, padding: "1px 5px", borderRadius: 4,
                        background: "rgba(239,68,68,0.3)", color: "#fca5a5",
                        fontSize: 10, cursor: "pointer", fontWeight: 700
                    }}
                >
                    ✕
                </span>
            )}
        </span>
    );
}

function Console()
{
    const [searchFilter, setSearchFilter] = useState("");
    const [selectedSessionId, setSelectedSessionId] = useState(null); // null = all
    const [historyOpen, setHistoryOpen] = useState(false);

    const logEntries     = useAppStore(function(s) { return s.logEntries; });
    const uploadSessions = useAppStore(function(s) { return s.uploadSessions; });
    const toolSessions   = useAppStore(function(s) { return s.toolSessions; });
    const uploadStatus   = useAppStore(function(s) { return s.uploadStatus; });
    const clearLogs      = useAppStore(function(s) { return s.clearLogs; });
    const startConsole   = useAppStore(function(s) { return s.startConsole; });
    const stopConsole    = useAppStore(function(s) { return s.stopConsole; });
    const stopSession    = useAppStore(function(s) { return s.stopSession; });
    const commandHistory = useAppStore(function(s) { return s.commandHistory; });
    const runUpload      = useAppStore(function(s) { return s.runUpload; });

    // All sessions sorted newest-first
    const allSessions = useMemo(function()
    {
        const list = Object.values(uploadSessions).concat(Object.values(toolSessions));
        list.sort(function(a, b) { return (b.startedAt || "") < (a.startedAt || "") ? -1 : 1; });
        return list;
    }, [uploadSessions, toolSessions]);

    const runningCount = allSessions.filter(function(s) { return s.status === "running"; }).length;
    const legacyRunning = uploadStatus.status === "running";
    const anyRunning = runningCount > 0 || legacyRunning;

    // Filter logs by selected session + search
    const visibleLogs = useMemo(function()
    {
        let logs = logEntries;
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
    }, [logEntries, selectedSessionId, searchFilter]);

    function handleExport()
    {
        var text = visibleLogs.map(function(e)
        {
            return "[" + formatTime(e.timestamp || e.ts) + "] [" + (e.stream || e.type || "log") + "] " + (e.message || "");
        }).join("\n");
        var blob = new Blob([text], { type: "text/plain" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "console_log_" + new Date().toISOString().slice(0, 10) + ".txt";
        a.click();
        URL.revokeObjectURL(url);
    }

    return (
        <section className="console-page page-panel">

            {/* ── Toolbar ── */}
            <div className="console-toolbar">
                <div className="page-heading">
                    <span className="page-eyebrow">Live Console</span>
                    <h1 className="page-title">Execution Logs</h1>
                    <p className="page-placeholder">
                        {runningCount > 0
                            ? runningCount + " process" + (runningCount > 1 ? "es" : "") + " running in parallel"
                            : anyRunning ? "Process running." : "No active processes."}
                    </p>
                </div>
                <div className="console-actions">
                    <motion.button
                        type="button" className="console-button console-button-primary"
                        onClick={startConsole} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
                        title="Start a new independent upload process"
                    >
                        Start New
                    </motion.button>
                    <motion.button
                        type="button" className="console-button"
                        onClick={stopConsole} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
                        title="Stop all running processes"
                    >
                        Stop All
                    </motion.button>
                    <motion.button
                        type="button" className="console-button"
                        onClick={clearLogs} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
                    >
                        Clear
                    </motion.button>
                    <motion.button
                        type="button" className="console-button"
                        onClick={handleExport} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
                    >
                        Export
                    </motion.button>
                </div>
            </div>

            {/* ── Session filter chips ── */}
            {allSessions.length > 0 && (
                <div style={{ padding: "0 16px 10px", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                    {/* "All" chip */}
                    <span
                        onClick={function() { setSelectedSessionId(null); }}
                        style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.35)",
                            borderRadius: 20, padding: "4px 12px", fontSize: 12, color: "#a5b4fc",
                            cursor: "pointer", userSelect: "none",
                            outline: !selectedSessionId ? "2px solid #6366f1" : "none", outlineOffset: 2
                        }}
                    >
                        All ({allSessions.length})
                    </span>

                    {allSessions.map(function(session)
                    {
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

            {/* ── Search ── */}
            <div style={{ padding: "0 16px 8px" }}>
                <input
                    type="text"
                    placeholder={selectedSessionId ? "Search selected session…" : "Search all logs…"}
                    value={searchFilter}
                    onChange={function(e) { setSearchFilter(e.target.value); }}
                    style={{
                        width: "100%", padding: "6px 10px", borderRadius: 6,
                        border: "1px solid #333", background: "#0d0d1a", color: "#ccc", fontSize: 13
                    }}
                />
            </div>

            {/* ── Log viewer ── */}
            <div className="console-viewer" role="log" aria-live="polite">
                {visibleLogs.length === 0 && (
                    <div style={{ padding: "32px 16px", textAlign: "center", color: "#4b5563", fontSize: 13 }}>
                        {logEntries.length === 0
                            ? "No logs yet — start an upload or run a tool."
                            : "No logs match the current filter."}
                    </div>
                )}
                {visibleLogs.map(function(entry)
                {
                    const stream = entry.stream || entry.type || "log";
                    const lineClass = "console-line console-line-" + stream;
                    // When showing all sessions and there are multiple, prefix with session label
                    const sessionPrefix = (!selectedSessionId && allSessions.length > 1 && entry.sessionId)
                        ? (entry.platform || ("…" + entry.sessionId.slice(-4))) + " › "
                        : "";

                    return (
                        <div key={entry.id} className={lineClass}>
                            <span className="console-line-meta">
                                [{formatTime(entry.timestamp || entry.ts)}] [{stream}]
                            </span>{" "}
                            <span>
                                {sessionPrefix && (
                                    <span style={{ opacity: 0.45, fontSize: 10, fontStyle: "italic" }}>{sessionPrefix}</span>
                                )}
                                {entry.message}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* ── Command history ── */}
            <div style={{ borderTop: "1px solid #1f2937", marginTop: 12, padding: "12px 16px" }}>
                <button
                    type="button" className="console-button"
                    onClick={function() { setHistoryOpen(!historyOpen); }}
                >
                    {historyOpen ? "Hide Command History" : ("Show Command History (" + commandHistory.length + ")")}
                </button>
                {historyOpen && (
                    <div style={{ marginTop: 8 }}>
                        {commandHistory.slice(-10).reverse().map(function(entry)
                        {
                            return (
                                <div key={entry.id} style={{ background: "#111827", borderRadius: 6, padding: "8px 12px", marginTop: 8, fontSize: 12 }}>
                                    <span style={{ color: "#6b7280" }}>{formatTime(entry.timestamp)}</span>
                                    {" "}
                                    <span style={{ color: "#e2e8f0" }}>{(entry.platforms || []).join(", ")}</span>
                                    <p style={{ color: "#9ca3af", margin: "4px 0" }}>{(entry.commandPreview || "").slice(0, 100)}</p>
                                    <button
                                        onClick={runUpload}
                                        style={{ padding: "3px 10px", borderRadius: 4, border: "none", background: "#4f46e5", color: "#fff", cursor: "pointer" }}
                                    >
                                        Run Again
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );
}

function formatTime(timestamp)
{
    if (!timestamp) return "--:--:--";
    return new Date(timestamp).toLocaleTimeString();
}

export default Console;
