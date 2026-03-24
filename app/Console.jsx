import { useEffect } from "react";
import { motion } from "framer-motion";
import { useAppStore } from "./useAppStore.js";

function Console()
{
    const logs = useAppStore(function selectLogs(state)
    {
        return state.logLines;
    });
    const isRunning = useAppStore(function selectIsRunning(state)
    {
        return state.isConsoleRunning;
    });
    const appendLog = useAppStore(function selectAppendLog(state)
    {
        return state.appendLog;
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

    useEffect(function subscribeToLogs()
    {
        if (window.api && window.api.onLog)
        {
            const unsubscribe = window.api.onLog(function handleIncomingLog(payload)
            {
                appendLog(formatLogLine(payload));
            });

            return unsubscribe;
        }

        return undefined;
    }, [appendLog]);

    return (
        <section className="console-page page-panel">
            <div className="console-toolbar">
                <div className="page-heading">
                    <span className="page-eyebrow">Live Console</span>
                    <h1 className="page-title">Execution Logs</h1>
                    <p className="page-placeholder">{isRunning ? "Log stream is active." : "Log stream is idle."}</p>
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
                {logs.map(function mapLog(line, index)
                {
                    return (
                        <div key={String(index) + "-" + line} className="console-line">
                            {line}
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

function formatLogLine(payload)
{
    if (!payload)
    {
        return "[event] empty log payload";
    }

    if (typeof payload === "string")
    {
        return payload;
    }

    if (payload.level && payload.message)
    {
        return "[" + payload.level + "] " + payload.message;
    }

    return "[event] log received";
}

export default Console;
