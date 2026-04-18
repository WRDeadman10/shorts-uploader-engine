import { useState } from "react";
import { motion } from "framer-motion";
import { useAppStore } from "./useAppStore.js";

function Console()
{
    const [searchFilter, setSearchFilter] = useState("");
    const logEntries = useAppStore(function selectLogs(state)
    {
        return state.logEntries;
    });
    const uploadStatus = useAppStore(function selectUploadStatus(state)
    {
        return state.uploadStatus;
    });
    const clearLogs = useAppStore(function selectClearLogs(state)
    {
        return state.clearLogs;
    });
    const startConsole = useAppStore(function selectStartConsole(state)
    {
        return state.startConsole;
    });
    const stopConsole = useAppStore(function selectStopConsole(state)
    {
        return state.stopConsole;
    });
    const isRunning = uploadStatus.status === "running";
    const commandHistory = useAppStore(function selectCommandHistory(state) { return state.commandHistory; });
    const runUpload = useAppStore(function selectRunUpload(state) { return state.runUpload; });
    const [historyOpen, setHistoryOpen] = useState(false);

    return (
        <section className="console-page page-panel">
            <div className="console-toolbar">
                <div className="page-heading">
                    <span className="page-eyebrow">Live Console</span>
                    <h1 className="page-title">Execution Logs</h1>
                    <p className="page-placeholder">{isRunning ? "Python process is running." : "No active Python process."}</p>
                </div>
                <div className="console-actions">
                    <motion.button
                        type="button"
                        className="console-button console-button-primary"
                        onClick={startConsole}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.97 }}
                    >
                        Start
                    </motion.button>
                    <motion.button
                        type="button"
                        className="console-button"
                        onClick={stopConsole}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.97 }}
                    >
                        Stop
                    </motion.button>
                    <motion.button
                        type="button"
                        className="console-button"
                        onClick={clearLogs}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.97 }}
                    >
                        Clear
                    </motion.button>
                    <motion.button
                        type="button"
                        className="console-button"
                        onClick={function exportLogs() {
                            var text = logEntries.map(function(e) { return "[" + formatTime(e.timestamp) + "] [" + e.stream + "] " + e.message; }).join("\n");
                            var blob = new Blob([text], { type: "text/plain" });
                            var url = URL.createObjectURL(blob);
                            var a = document.createElement("a");
                            a.href = url;
                            a.download = "console_log_" + new Date().toISOString().slice(0,10) + ".txt";
                            a.click();
                            URL.revokeObjectURL(url);
                        }}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.97 }}
                    >
                        Export
                    </motion.button>
                </div>
            </div>
            <div style={{padding: "0 16px 8px"}}>
                <input
                    type="text"
                    placeholder="Search logs..."
                    value={searchFilter}
                    onChange={function handleSearch(e) { setSearchFilter(e.target.value); }}
                    style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #333",background:"#0d0d1a",color:"#ccc",fontSize:13}}
                />
            </div>
            <div className="console-viewer" role="log" aria-live="polite">
                {logEntries.filter(function filterLog(entry) {
                    return !searchFilter || entry.message.toLowerCase().includes(searchFilter.toLowerCase());
                }).map(function mapLog(entry)
                {
                    const lineClassName = "console-line console-line-" + entry.stream;

                    return (
                        <div key={entry.id} className={lineClassName}>
                            <span className="console-line-meta">[{formatTime(entry.timestamp)}] [{entry.stream}]</span>{" "}
                            <span>{entry.message}</span>
                        </div>
                    );
                })}
            </div>
            <div style={{ borderTop: '1px solid #1f2937', marginTop: 12, padding: '12px 16px' }}><button type="button" className="console-button" onClick={function() { setHistoryOpen(!historyOpen); }}>{historyOpen ? 'Hide Command History' : ('Show Command History (' + commandHistory.length + ')')}</button>{historyOpen && <div style={{ marginTop: 8 }}>{commandHistory.slice(-10).reverse().map(function(entry) { return (<div key={entry.id} style={{ background: '#111827', borderRadius: 6, padding: '8px 12px', marginTop: 8, fontSize: 12 }}><span style={{ color: '#6b7280' }}>{formatTime(entry.timestamp)}</span>{' '}<span style={{ color: '#e2e8f0' }}>{(entry.platforms || []).join(', ')}</span><p style={{ color: '#9ca3af', margin: '4px 0' }}>{(entry.commandPreview || '').slice(0, 100)}</p><button onClick={runUpload} style={{ padding: '3px 10px', borderRadius: 4, border: 'none', background: '#4f46e5', color: '#fff', cursor: 'pointer' }}>Run Again</button></div>); })}</div>}</div>
        </section>
    );
}

function formatTime(timestamp)
{
    if (!timestamp)
    {
        return "--:--:--";
    }

    return new Date(timestamp).toLocaleTimeString();
}

export default Console;
