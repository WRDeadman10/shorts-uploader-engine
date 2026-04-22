import { useAppStore } from "./useAppStore.js";

function Topbar(props)
{
    const { title } = props;

    const uploadSessions = useAppStore(function(s) { return s.uploadSessions; });
    const toolSessions   = useAppStore(function(s) { return s.toolSessions; });
    const uploadStatus   = useAppStore(function(s) { return s.uploadStatus; });

    const runningUploads = Object.values(uploadSessions).filter(function(s) { return s.status === "running"; }).length;
    const runningTools   = Object.values(toolSessions).filter(function(s) { return s.status === "running"; }).length;
    const totalRunning   = runningUploads + runningTools;

    // Fallback label for backward compat when there are no sessions yet
    const statusLabel = uploadStatus.platform
        ? uploadStatus.status + " - " + uploadStatus.platform
        : uploadStatus.status;

    return (
        <header className="topbar">
            <div>
                <p className="topbar-kicker">Workspace</p>
                <h2 className="topbar-title">{title}</h2>
            </div>
            <div className="topbar-status" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {totalRunning > 0 ? (
                    <span style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.4)",
                        borderRadius: 20, padding: "3px 10px", fontSize: 12, color: "#fbbf24"
                    }}>
                        <span style={{
                            width: 7, height: 7, borderRadius: "50%", background: "#fbbf24",
                            boxShadow: "0 0 6px #fbbf24",
                            animation: "pulse 1.4s ease-in-out infinite"
                        }} />
                        {totalRunning} running
                        {runningUploads > 0 && runningTools > 0 && (
                            <span style={{ color: "#d97706", fontSize: 11 }}>
                                ({runningUploads}u {runningTools}t)
                            </span>
                        )}
                    </span>
                ) : (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span className="status-dot" />
                        <span style={{ fontSize: 13, color: "var(--muted)" }}>{statusLabel}</span>
                    </span>
                )}
            </div>
        </header>
    );
}

export default Topbar;
