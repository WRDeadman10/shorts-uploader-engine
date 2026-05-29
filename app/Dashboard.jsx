import { useState, useEffect } from "react";
import Card from "./Card.jsx";
import ProgressBar from "./ProgressBar.jsx";
import { useAppStore } from "./useAppStore.js";

function Dashboard()
{
    const videoList = useAppStore(function selectVideoList(state) { return state.videoList; });
    const uploadStatus = useAppStore(function selectUploadStatus(state) { return state.uploadStatus; });

    const [tokenHealth, setTokenHealth] = useState(null);
    const [diskUsage, setDiskUsage] = useState(null);
    const [actionMsg, setActionMsg] = useState("");

    useEffect(() => {
        async function loadHealth() {
            if (window.api && window.api.getTokenHealth) {
                const th = await window.api.getTokenHealth();
                setTokenHealth(th);
            }
            if (window.api && window.api.getDiskUsage) {
                const du = await window.api.getDiskUsage();
                setDiskUsage(du);
            }
        }
        loadHealth();
    }, []);

    async function handleBackup() {
        if (!window.api || !window.api.backupState) return;
        setActionMsg("Creating backup...");
        const res = await window.api.backupState();
        if (res.success) setActionMsg("Backup saved to: " + res.filePath);
        else setActionMsg(res.errorMessage === "Cancelled" ? "" : "Backup failed: " + res.errorMessage);
    }

    async function handleRestore() {
        if (!window.api || !window.api.restoreState) return;
        setActionMsg("Restoring...");
        const res = await window.api.restoreState();
        if (res.success) setActionMsg("Restored " + res.restoredCount + " files. Please restart the app.");
        else setActionMsg(res.errorMessage === "Cancelled" ? "" : "Restore failed: " + res.errorMessage);
    }

    const totalTracked = videoList.length;
    const youtubeCount = videoList.filter(function(v) { return v.yt; }).length;
    const instagramCount = videoList.filter(function(v) { return v.ig; }).length;
    const facebookCount = videoList.filter(function(v) { return v.fb; }).length;
    const completedCount = videoList.filter(function(v) { return v.status === "complete"; }).length;
    const completionRate = totalTracked > 0 ? Math.round((completedCount / totalTracked) * 100) : 0;
    
    const dashboardStats = [
        { id: "tracked", label: "Tracked Videos", value: String(totalTracked), detail: "Merged from JSON state and ledgers" },
        { id: "youtube", label: "YouTube Uploaded", value: String(youtubeCount), detail: "Detected from YouTube state" },
        { id: "complete", label: "Full Coverage", value: String(completedCount), detail: "Published on all three platforms" },
        { id: "status", label: "Active Upload", value: uploadStatus.status, detail: uploadStatus.commandPreview || "No process running" }
    ];
    
    const uploadPipelines = [
        { id: "youtube", label: "YouTube Coverage", progress: totalTracked > 0 ? Math.round((youtubeCount / totalTracked) * 100) : 0, detail: youtubeCount + " of " + totalTracked + " tracked videos" },
        { id: "instagram", label: "Instagram Coverage", progress: totalTracked > 0 ? Math.round((instagramCount / totalTracked) * 100) : 0, detail: instagramCount + " of " + totalTracked + " tracked videos" },
        { id: "facebook", label: "Facebook / Full Completion", progress: totalTracked > 0 ? Math.max(Math.round((facebookCount / totalTracked) * 100), completionRate) : 0, detail: facebookCount + " Facebook uploads, " + completionRate + "% fully complete" }
    ];

    function getHealthColor(status) {
        if (status === "ok") return "#4ade80";
        if (status === "warning") return "#f59e0b";
        return "#ef4444";
    }

    return (
        <section className="dashboard-page page-panel">
            <div className="page-heading">
                <span className="page-eyebrow">Operations Snapshot</span>
                <h1 className="page-title">Dashboard</h1>
                <p className="page-placeholder">Counts are driven by the current Python JSON state files.</p>
            </div>
            
            <div className="dashboard-grid">
                {dashboardStats.map(stat => <Card key={stat.id} title={stat.label} value={stat.value} subtitle={stat.detail} />)}
            </div>
            
            <div className="dashboard-stack">
                {uploadPipelines.map(pipeline => (
                    <Card key={pipeline.id} title={pipeline.label} subtitle={pipeline.detail}>
                        <ProgressBar value={pipeline.progress} label={pipeline.progress + "%"} />
                    </Card>
                ))}
            </div>

            <div style={{ display: 'flex', gap: 24, marginTop: 24 }}>
                <div style={{ flex: 1, background: '#111827', borderRadius: 10, padding: 20 }}>
                    <h2 style={{ fontSize: 14, color: '#e2e8f0', marginBottom: 16 }}>Credential Health</h2>
                    {tokenHealth ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ width: 10, height: 10, borderRadius: '50%', background: getHealthColor(tokenHealth.youtubeOAuth.status) }}></span>
                                <div>
                                    <p style={{ margin: 0, fontSize: 13, color: '#e2e8f0' }}>YouTube OAuth</p>
                                    <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>{tokenHealth.youtubeOAuth.detail}</p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ width: 10, height: 10, borderRadius: '50%', background: getHealthColor(tokenHealth.youtubeToken.status) }}></span>
                                <div>
                                    <p style={{ margin: 0, fontSize: 13, color: '#e2e8f0' }}>YouTube Access Token</p>
                                    <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>{tokenHealth.youtubeToken.detail}</p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ width: 10, height: 10, borderRadius: '50%', background: getHealthColor(tokenHealth.metaToken.status) }}></span>
                                <div>
                                    <p style={{ margin: 0, fontSize: 13, color: '#e2e8f0' }}>Meta Graph Token</p>
                                    <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>{tokenHealth.metaToken.detail}</p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ width: 10, height: 10, borderRadius: '50%', background: getHealthColor(tokenHealth.openaiKey.status) }}></span>
                                <div>
                                    <p style={{ margin: 0, fontSize: 13, color: '#e2e8f0' }}>OpenAI API Key</p>
                                    <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>{tokenHealth.openaiKey.detail}</p>
                                </div>
                            </div>
                        </div>
                    ) : <p style={{ fontSize: 13, color: '#6b7280' }}>Loading health...</p>}
                </div>

                <div style={{ flex: 1, background: '#111827', borderRadius: 10, padding: 20 }}>
                    <h2 style={{ fontSize: 14, color: '#e2e8f0', marginBottom: 16 }}>Storage & Disk Usage</h2>
                    {diskUsage ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div>
                                <p style={{ margin: 0, fontSize: 13, color: '#e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>converted_shorts</span>
                                    <span>{diskUsage.convertedShorts.formatted} ({diskUsage.convertedShorts.fileCount} files)</span>
                                </p>
                            </div>
                            <div>
                                <p style={{ margin: 0, fontSize: 13, color: '#e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>generated_metadata</span>
                                    <span>{diskUsage.generatedMetadata.formatted}</span>
                                </p>
                            </div>
                            <div>
                                <p style={{ margin: 0, fontSize: 13, color: '#e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>live_upload_audit</span>
                                    <span>{diskUsage.liveAudit.formatted}</span>
                                </p>
                            </div>
                            <div style={{ marginTop: 8 }}>
                                <p style={{ margin: '0 0 6px', fontSize: 12, color: '#9ca3af', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Video Drive Free Space</span>
                                    <span>{diskUsage.disk.freeFormatted} free</span>
                                </p>
                                <ProgressBar value={diskUsage.disk.usedPercent} label={diskUsage.disk.usedPercent + "% used"} />
                            </div>
                        </div>
                    ) : <p style={{ fontSize: 13, color: '#6b7280' }}>Loading storage stats...</p>}
                </div>
            </div>

            <div style={{display:"flex",gap:12,marginTop:24, flexWrap: "wrap"}}>
                <button onClick={() => useAppStore.getState().setActivePage("upload")} style={{padding:"10px 20px",borderRadius:8,border:"1px solid #444",background:"#1a1a2e",color:"#fff",cursor:"pointer",fontSize:13}}>Start Upload</button>
                <button onClick={() => useAppStore.getState().setActivePage("library")} style={{padding:"10px 20px",borderRadius:8,border:"1px solid #444",background:"#1a1a2e",color:"#fff",cursor:"pointer",fontSize:13}}>View Library</button>
                <button onClick={() => useAppStore.getState().setActivePage("console")} style={{padding:"10px 20px",borderRadius:8,border:"1px solid #444",background:"#1a1a2e",color:"#fff",cursor:"pointer",fontSize:13}}>Open Console</button>
                <button onClick={() => useAppStore.getState().setActivePage('audit')} style={{padding:'10px 20px',borderRadius:8,border:'1px solid #444',background:'#1a1a2e',color:'#fff',cursor:'pointer',fontSize:13}}>View Audit</button>
                <button onClick={() => useAppStore.getState().setActivePage('tools')} style={{padding:'10px 20px',borderRadius:8,border:'1px solid #444',background:'#1a1a2e',color:'#fff',cursor:'pointer',fontSize:13}}>Open Tools</button>
                <button onClick={() => useAppStore.getState().setActivePage('setup')} style={{padding:'10px 20px',borderRadius:8,border:'1px solid #444',background:'#1a1a2e',color:'#fff',cursor:'pointer',fontSize:13}}>Run Setup</button>
                <div style={{width: '1px', background: '#333', margin: '0 8px'}}></div>
                <button onClick={handleBackup} style={{padding:'10px 20px',borderRadius:8,border:'1px solid #4f46e5',background:'#312e81',color:'#fff',cursor:'pointer',fontSize:13}}>Backup State</button>
                <button onClick={handleRestore} style={{padding:'10px 20px',borderRadius:8,border:'1px solid #b91c1c',background:'#7f1d1d',color:'#fff',cursor:'pointer',fontSize:13}}>Restore State</button>
            </div>
            {actionMsg && <p style={{ fontSize: 13, color: '#a3e635', marginTop: 12 }}>{actionMsg}</p>}
        </section>
    );
}

export default Dashboard;
