import { motion } from "framer-motion";
import { useAppStore } from "./useAppStore.js";

function Console()
{
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
                </div>
            </div>
            <div className="console-viewer" role="log" aria-live="polite">
                {logEntries.map(function mapLog(entry)
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
