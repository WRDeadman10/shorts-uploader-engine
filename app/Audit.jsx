import { useState } from "react";
import { useAppStore } from "./useAppStore.js";

function AuditAction({ label, description, toolName, args })
{
    const [statusMsg, setStatusMsg] = useState("");

    async function handleRun()
    {
        if (!window.api || !window.api.runTool) { setStatusMsg("API not available"); return; }
        setStatusMsg("running...");
        const result = await window.api.runTool({ toolName, args });
        setStatusMsg(result.success ? "started (PID " + result.pid + ")" : result.errorMessage);
    }

    return (
        <div style={{ background: "#111827", borderRadius: 8, padding: 14, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                    <p style={{ fontSize: 14, color: "#e2e8f0", margin: 0 }}>{label}</p>
                    <p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 0" }}>{description}</p>
                </div>
                <button onClick={handleRun} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#4f46e5", color: "#fff", cursor: "pointer", fontSize: 12 }}>Run</button>
            </div>
            {statusMsg ? <p style={{ fontSize: 11, color: "#a3e635", margin: "8px 0 0" }}>{statusMsg}</p> : null}
        </div>
    );
}

function Audit()
{
    const [auditReport, setAuditReport] = useState(null);
    const [reportLoading, setReportLoading] = useState(false);
    const auditRows = useAppStore(function selectAuditRows(state)
    {
        return state.getAuditRows();
    });

    async function handleLoadReport()
    {
        setReportLoading(true);
        var r = await window.api.getAuditReport();
        if (r.success) { setAuditReport(r); }
        setReportLoading(false);
    }

    return (
        <section className="audit-page page-panel">
            <div className="page-heading">
                <span className="page-eyebrow">Delivery Audit</span>
                <h1 className="page-title">Platform Coverage</h1>
                <p className="page-placeholder">Rows are derived from the current JSON state and upload ledgers.</p>
            </div>
            <div style={{ marginBottom: 24 }}>
                <button
                    onClick={handleLoadReport}
                    style={{ padding: "6px 16px", borderRadius: 6, border: "none", background: "#4f46e5", color: "#fff", cursor: "pointer", fontSize: 12 }}
                >
                    {reportLoading ? "Loading..." : "Load Audit Report from Disk"}
                </button>
                {auditReport !== null && (
                    <div style={{ background: "#111827", borderRadius: 8, padding: 14, marginTop: 12 }}>
                        <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 4px" }}>{"Generated: " + auditReport.generatedAt}</p>
                        <p style={{ fontSize: 12, color: "#e2e8f0", margin: "0 0 8px" }}>{"Offline: " + auditReport.offlineCount + " videos"}</p>
                        <div style={{ display: "flex", gap: 16 }}>
                            <span style={{ fontSize: 12, color: "#e2e8f0" }}>{"YT: " + auditReport.platforms.youtube.uploaded + " uploaded"}</span>
                            <span style={{ fontSize: 12, color: "#e2e8f0" }}>{"IG: " + auditReport.platforms.instagram.uploaded + " uploaded"}</span>
                            <span style={{ fontSize: 12, color: "#e2e8f0" }}>{"FB: " + auditReport.platforms.facebook.uploaded + " uploaded"}</span>
                        </div>
                    </div>
                )}
            </div>
            <div className="audit-table-shell">
                <table className="audit-table">
                    <thead>
                        <tr>
                            <th>Video</th>
                            <th>YT</th>
                            <th>IG</th>
                            <th>FB</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {auditRows.map(function mapRow(row)
                        {
                            const rowClassName = getRowClassName(row.status);

                            return (
                                <tr key={row.id} className={rowClassName}>
                                    <td>{row.video}</td>
                                    <td>{row.yt ? "Yes" : "No"}</td>
                                    <td>{row.ig ? "Yes" : "No"}</td>
                                    <td>{row.fb ? "Yes" : "No"}</td>
                                    <td>{formatStatus(row.status)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div style={{ marginTop: 32 }}>
                <h2 style={{ fontSize: 15, color: "#e2e8f0", marginBottom: 16 }}>Audit Actions</h2>
                <AuditAction
                    label="Generate Upload Status Report"
                    description="Run generateUploadStatusReport.py to produce a local totals summary."
                    toolName="generateUploadStatusReport.py"
                    args={[]}
                />
                <AuditAction
                    label="Rebuild Upload Comparison"
                    description="Run rebuildUploadComparison.py using local platform snapshots (no API calls)."
                    toolName="rebuildUploadComparison.py"
                    args={[]}
                />
                <AuditAction
                    label="Run Live Upload Audit"
                    description="Fetch live platform inventories and rebuild comparison. Requires credentials."
                    toolName="generateLiveUploadAudit.py"
                    args={[]}
                />
            </div>
        </section>
    );
}

function getRowClassName(status)
{
    if (status === "missing")
    {
        return "audit-row audit-row-missing";
    }

    if (status === "partial")
    {
        return "audit-row audit-row-partial";
    }

    return "audit-row audit-row-complete";
}

function formatStatus(status)
{
    if (status === "missing")
    {
        return "Missing";
    }

    if (status === "partial")
    {
        return "Partial";
    }

    return "Complete";
}

export default Audit;
