import { useState, useMemo, useEffect } from "react";

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

function getRowClassName(status) {
    if (status === "missing") return "audit-row audit-row-missing";
    if (status === "partial") return "audit-row audit-row-partial";
    return "audit-row audit-row-complete";
}

function formatStatus(status) {
    if (status === "missing") return "Missing";
    if (status === "partial") return "Partial";
    return "Complete";
}

function getStatusFromFlags(uploaded) {
    const yt = uploaded.yt;
    const ig = uploaded.ig;
    const fb = uploaded.fb;
    if (yt && ig && fb) return "complete";
    if (!yt && !ig && !fb) return "missing";
    return "partial";
}

function Audit() {
    const [auditRows, setAuditRows] = useState([]);
    const [reportLoading, setReportLoading] = useState(false);

    // Filters
    const [filterStatus, setFilterStatus] = useState("all");
    const [filterPlatform, setFilterPlatform] = useState("all");
    const [filterConverted, setFilterConverted] = useState("all");
    
    // Sort
    const [sortBy, setSortBy] = useState("name_asc");
    
    // Grouping
    const [groupByFolder, setGroupByFolder] = useState(false);

    async function handleLoadReport() {
        setReportLoading(true);
        var r = await window.api.getDetailedAuditReport();
        if (r && r.success) {
            setAuditRows(r.rows || []);
        }
        setReportLoading(false);
    }

    useEffect(() => {
        handleLoadReport();
    }, []);

    const filteredRows = useMemo(() => {
        return auditRows.filter(row => {
            const status = getStatusFromFlags(row.uploaded);
            const { yt, ig, fb } = row.uploaded;
            
            if (filterStatus === "uploaded" && status !== "complete") return false;
            if (filterStatus === "partial" && status !== "partial") return false;
            if (filterStatus === "missing" && status !== "missing") return false;
            if (filterStatus === "not_on_disk" && row.onDisk) return false;

            if (filterPlatform === "yt" && !yt) return false;
            if (filterPlatform === "ig" && !ig) return false;
            if (filterPlatform === "fb" && !fb) return false;

            if (filterConverted === "yes" && !row.hasConvertedShort) return false;
            if (filterConverted === "no" && row.hasConvertedShort) return false;

            return true;
        });
    }, [auditRows, filterStatus, filterPlatform, filterConverted]);

    const sortedRows = useMemo(() => {
        const sorted = [...filteredRows];
        sorted.sort((a, b) => {
            const nameA = a.fileName || "";
            const nameB = b.fileName || "";
            const folderA = a.folderName || "";
            const folderB = b.folderName || "";

            if (sortBy === "name_asc") return nameA.localeCompare(nameB);
            if (sortBy === "name_desc") return nameB.localeCompare(nameA);
            if (sortBy === "folder_asc") {
                const cmp = folderA.localeCompare(folderB);
                return cmp !== 0 ? cmp : nameA.localeCompare(nameB);
            }
            if (sortBy === "folder_desc") {
                const cmp = folderB.localeCompare(folderA);
                return cmp !== 0 ? cmp : nameB.localeCompare(nameA);
            }
            if (sortBy === "platform_count_desc") {
                const countA = (a.uploaded.yt?1:0) + (a.uploaded.ig?1:0) + (a.uploaded.fb?1:0);
                const countB = (b.uploaded.yt?1:0) + (b.uploaded.ig?1:0) + (b.uploaded.fb?1:0);
                if (countA !== countB) return countB - countA;
                return nameA.localeCompare(nameB);
            }
            return 0;
        });
        return sorted;
    }, [filteredRows, sortBy]);

    const groupedRows = useMemo(() => {
        if (!groupByFolder) return null;
        const groups = {};
        for (const row of sortedRows) {
            if (!groups[row.folderName]) groups[row.folderName] = [];
            groups[row.folderName].push(row);
        }
        return groups;
    }, [sortedRows, groupByFolder]);

    const stats = useMemo(() => {
        let onDisk = 0;
        let notOnDisk = 0;
        let complete = 0;
        let yt = 0, ig = 0, fb = 0;
        for (const r of auditRows) {
            if (r.onDisk) onDisk++; else notOnDisk++;
            if (r.uploaded.yt && r.uploaded.ig && r.uploaded.fb) complete++;
            if (r.uploaded.yt) yt++;
            if (r.uploaded.ig) ig++;
            if (r.uploaded.fb) fb++;
        }
        return { total: auditRows.length, onDisk, notOnDisk, complete, yt, ig, fb };
    }, [auditRows]);

    return (
        <section className="audit-page page-panel">
            <div className="page-heading">
                <span className="page-eyebrow">Delivery Audit</span>
                <h1 className="page-title">Detailed Platform Coverage</h1>
                <p className="page-placeholder">Combines Live Audit JSON outputs, local ledgers, and on-disk files.</p>
            </div>
            
            <div style={{ background: "#0f172a", borderRadius: 8, padding: 14, marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#6b7280" }}>Totals:</span>
                <span style={{ fontSize: 12, color: "#e2e8f0" }}>All: {stats.total}</span>
                <span style={{ fontSize: 12, color: "#e2e8f0" }}>On Disk: {stats.onDisk}</span>
                <span style={{ fontSize: 12, color: stats.notOnDisk > 0 ? "#f87171" : "#e2e8f0" }}>Not On Disk: {stats.notOnDisk}</span>
                <span style={{ fontSize: 12, color: "#e2e8f0" }}>Complete: {stats.complete}</span>
                <span style={{ fontSize: 12, color: "#e2e8f0" }}>YT: {stats.yt}</span>
                <span style={{ fontSize: 12, color: "#e2e8f0" }}>IG: {stats.ig}</span>
                <span style={{ fontSize: 12, color: "#e2e8f0" }}>FB: {stats.fb}</span>
            </div>

            <div style={{ marginBottom: 16, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button
                    onClick={handleLoadReport}
                    style={{ padding: "6px 16px", borderRadius: 6, border: "none", background: "#4f46e5", color: "#fff", cursor: "pointer", fontSize: 12 }}
                >
                    {reportLoading ? "Loading..." : "Refresh Detailed Report"}
                </button>
                
                <select style={{ padding: "4px 8px", fontSize: 12, borderRadius: 4, background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", cursor: "pointer" }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                    <option value="all">Status: All</option>
                    <option value="uploaded">Complete (All Platforms)</option>
                    <option value="partial">Partial Uploads</option>
                    <option value="missing">Not Uploaded (Missing)</option>
                    <option value="not_on_disk">Not on Disk</option>
                </select>
                <select style={{ padding: "4px 8px", fontSize: 12, borderRadius: 4, background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", cursor: "pointer" }} value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)}>
                    <option value="all">Platform: All</option>
                    <option value="yt">Uploaded to YouTube</option>
                    <option value="ig">Uploaded to Instagram</option>
                    <option value="fb">Uploaded to Facebook</option>
                </select>
                <select style={{ padding: "4px 8px", fontSize: 12, borderRadius: 4, background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", cursor: "pointer" }} value={filterConverted} onChange={e => setFilterConverted(e.target.value)}>
                    <option value="all">Converted: All</option>
                    <option value="yes">Has Converted Short</option>
                    <option value="no">No Converted Short</option>
                </select>
                
                <select style={{ padding: "4px 8px", fontSize: 12, borderRadius: 4, background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", cursor: "pointer" }} value={sortBy} onChange={e => setSortBy(e.target.value)}>
                    <option value="name_asc">Sort: Name (A-Z)</option>
                    <option value="name_desc">Sort: Name (Z-A)</option>
                    <option value="folder_asc">Sort: Folder (A-Z)</option>
                    <option value="folder_desc">Sort: Folder (Z-A)</option>
                    <option value="platform_count_desc">Sort: Platforms Uploaded</option>
                </select>

                <label style={{ fontSize: 12, color: "#e2e8f0", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                    <input type="checkbox" checked={groupByFolder} onChange={e => setGroupByFolder(e.target.checked)} />
                    Group by Folder
                </label>
            </div>

            <div className="audit-table-shell" style={{ maxHeight: "60vh", overflowY: "auto", border: "1px solid #334155", borderRadius: 8 }}>
                {!groupByFolder && (
                    <table className="audit-table">
                        <thead>
                            <tr>
                                <th>Folder</th>
                                <th>Filename</th>
                                <th>On Disk</th>
                                <th>Converted</th>
                                <th>YT</th>
                                <th>IG</th>
                                <th>FB</th>
                                <th>Status</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedRows.map(row => <AuditTableRow key={row.stateKey} row={row} />)}
                        </tbody>
                    </table>
                )}

                {groupByFolder && groupedRows && Object.keys(groupedRows).sort().map(folder => (
                    <div key={folder}>
                        <h3 style={{ fontSize: 13, color: "#94a3b8", padding: "8px 12px", background: "#0f172a", margin: 0, borderBottom: "1px solid #1e293b", borderTop: "1px solid #1e293b", position: "sticky", top: 0 }}>
                            {folder} ({groupedRows[folder].length} videos)
                        </h3>
                        <table className="audit-table" style={{ marginTop: 0, borderTop: "none", borderBottom: "none" }}>
                            <thead>
                                <tr>
                                    <th>Filename</th>
                                    <th>On Disk</th>
                                    <th>Converted</th>
                                    <th>YT</th>
                                    <th>IG</th>
                                    <th>FB</th>
                                    <th>Status</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {groupedRows[folder].map(row => <AuditTableRow key={row.stateKey} row={row} hideFolder />)}
                            </tbody>
                        </table>
                    </div>
                ))}
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

function AuditTableRow({ row, hideFolder }) {
    const status = getStatusFromFlags(row.uploaded);
    const rowClassName = getRowClassName(status);

    return (
        <tr className={rowClassName}>
            {!hideFolder && <td style={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.folderName}>{row.folderName}</td>}
            <td style={{ maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.fileName}>{row.fileName}</td>
            <td style={{ color: row.onDisk ? "#a3e635" : "#f87171" }}>{row.onDisk ? "Yes" : "No"}</td>
            <td>{row.hasConvertedShort ? "Yes" : "No"}</td>
            <td>{row.uploaded.yt ? "Yes" : "No"}</td>
            <td>{row.uploaded.ig ? "Yes" : "No"}</td>
            <td>{row.uploaded.fb ? "Yes" : "No"}</td>
            <td>{formatStatus(status)}</td>
            <td style={{ whiteSpace: "nowrap" }}>
                {row.absolutePath ? (
                    <button
                        onClick={() => { window.api && window.api.showInFolder && window.api.showInFolder(row.absolutePath); }}
                        style={{ padding: "2px 8px", borderRadius: 4, border: "none", background: "#1e293b", color: "#94a3b8", cursor: "pointer", fontSize: 11 }}
                    >
                        Show
                    </button>
                ) : null}
            </td>
        </tr>
    );
}

export default Audit;
