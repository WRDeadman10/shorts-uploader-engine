import { pageOrder, useAppStore } from "./useAppStore.js";

function Topbar()
{
    const activePage = useAppStore(function(s) { return s.activePage; });
    const setActivePage = useAppStore(function(s) { return s.setActivePage; });

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
        <header className="topbar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 28px" }}>
            {/* Brand Logo & Name */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="sidebar-brand-mark" style={{ 
                    width: 34, 
                    height: 34, 
                    borderRadius: 10, 
                    fontSize: 12, 
                    display: "inline-flex", 
                    alignItems: "center", 
                    justifyContent: "center",
                    fontWeight: 700
                }}>CCC</span>
                <div style={{ display: "flex", flexDirection: "column" }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#fff", lineHeight: 1.1 }}>Command</p>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#fff", lineHeight: 1.1 }}>Center</p>
                </div>
            </div>

            {/* Navigation Tabs */}
            <nav style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {pageOrder.map(function(item) {
                    const isActive = item.id === activePage;
                    return (
                        <button
                            key={item.id}
                            type="button"
                            onClick={function() { setActivePage(item.id); }}
                            className={isActive ? "topbar-link topbar-link-active" : "topbar-link"}
                        >
                            {item.label}
                        </button>
                    );
                })}
            </nav>

            {/* Running Process Indicator */}
            <div className="topbar-status" style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 12px", border: "1px solid var(--border)", borderRadius: 99 }}>
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
                        <span className="status-dot" style={{ width: 8, height: 8 }} />
                        <span style={{ fontSize: 12, color: "var(--muted)" }}>{statusLabel}</span>
                    </span>
                )}
            </div>
        </header>
    );
}

export default Topbar;
