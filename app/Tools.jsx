import { useState } from 'react';

const inputStyle = { width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #333', background: '#1a1a2e', color: '#fff', fontSize: 13, boxSizing: 'border-box' };
const labelStyle = { display: 'block', fontSize: 12, color: '#aaa', marginBottom: 4 };
const fieldStyle = { marginBottom: 12 };
const btnStyle   = { padding: '8px 18px', borderRadius: 6, border: 'none', background: '#4f46e5', color: '#fff', cursor: 'pointer', fontSize: 13, marginRight: 8 };
const stopBtnStyle = { ...btnStyle, background: '#7f1d1d' };
const dangerBtnStyle = { ...btnStyle, background: '#991b1b' };
const panelStyle = { background: '#111827', borderRadius: 10, padding: 20, marginBottom: 24 };
const statusStyle = { fontSize: 12, color: '#a3e635', marginTop: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-all' };
const checkRow = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 };

async function runTool(toolName, args)
{
    if (!window.api || !window.api.runTool) return { success: false, errorMessage: 'API not available' };
    return window.api.runTool({ toolName, args });
}

async function stopTool()
{
    if (!window.api || !window.api.stopTool) return;
    return window.api.stopTool();
}

function Tools()
{
    // ── Fix Repeated YT Metadata ─────────────────────────────────────────────
    const [metaForm, setMetaForm] = useState({ mode: 'all', maxUpdates: 25, dryRun: false, clientSecrets: '', tokenFile: '' });
    const [metaStatus, setMetaStatus] = useState('');

    async function runMetaFix()
    {
        const args = ['--mode', metaForm.mode, '--max-updates', String(metaForm.maxUpdates)];
        if (metaForm.dryRun) args.push('--dry-run');
        if (metaForm.clientSecrets) args.push('--client-secrets', metaForm.clientSecrets);
        if (metaForm.tokenFile) args.push('--token-file', metaForm.tokenFile);
        setMetaStatus('running…');
        const r = await runTool('youtubeFixRepeatedMetadata.py', args);
        setMetaStatus(r.success ? 'started (PID ' + r.pid + ')' : r.errorMessage);
    }

    // ── Music Overlay Sample ─────────────────────────────────────────────────
    const [musicForm, setMusicForm] = useState({ musicDir: '', sampleVideo: '', sampleMusic: '', sampleOutput: '', bgVolume: 0.3, ffmpegBin: '', ffprobeBin: '' });
    const [musicStatus, setMusicStatus] = useState('');

    async function runMusicSample()
    {
        if (!musicForm.musicDir) { setMusicStatus('Music dir is required'); return; }
        const args = ['--music-dir', musicForm.musicDir];
        if (musicForm.sampleVideo) args.push('--sample-video', musicForm.sampleVideo);
        if (musicForm.sampleMusic) args.push('--sample-music', musicForm.sampleMusic);
        if (musicForm.sampleOutput) args.push('--sample-output', musicForm.sampleOutput);
        if (musicForm.bgVolume)    args.push('--bg-volume', String(musicForm.bgVolume));
        if (musicForm.ffmpegBin)   args.push('--ffmpeg-bin', musicForm.ffmpegBin);
        if (musicForm.ffprobeBin)  args.push('--ffprobe-bin', musicForm.ffprobeBin);
        setMusicStatus('running…');
        const r = await runTool('musicOverlaySample.py', args);
        setMusicStatus(r.success ? 'started (PID ' + r.pid + ')' : r.errorMessage);
    }

    // ── Live Upload Audit ────────────────────────────────────────────────────
    const [auditForm, setAuditForm] = useState({
        root: '',
        metaAccessToken: '',
        igUserId: '',
        facebookPageId: '',
        graphVersion: 'v25.0',
        clientSecrets: 'client_secret.json',
        tokenFile: 'token.json',
        outputDir: 'live_upload_audit',
    });
    const [auditStatus, setAuditStatus] = useState('');

    function setAuditField(k, v) { setAuditForm(function(p) { return { ...p, [k]: v }; }); }

    async function runLiveAudit()
    {
        if (!auditForm.root) { setAuditStatus('Root directory is required'); return; }
        const args = ['--root', auditForm.root];
        if (auditForm.metaAccessToken) args.push('--meta-access-token', auditForm.metaAccessToken);
        if (auditForm.igUserId)        args.push('--ig-user-id',        auditForm.igUserId);
        if (auditForm.facebookPageId)  args.push('--facebook-page-id',  auditForm.facebookPageId);
        if (auditForm.graphVersion)    args.push('--graph-version',      auditForm.graphVersion);
        if (auditForm.clientSecrets)   args.push('--client-secrets',     auditForm.clientSecrets);
        if (auditForm.tokenFile)       args.push('--token-file',         auditForm.tokenFile);
        if (auditForm.outputDir)       args.push('--output-dir',         auditForm.outputDir);
        setAuditStatus('running… (this may take a while while fetching live platform data)');
        const r = await runTool('generateLiveUploadAudit.py', args);
        setAuditStatus(r.success ? 'started (PID ' + r.pid + ')' : r.errorMessage);
    }

    // ── Delete Uploaded Videos ───────────────────────────────────────────────
    const [deleteForm, setDeleteForm] = useState({
        root: '',
        youtube: true,
        instagram: true,
        facebook: true,
        dryRun: true,
    });
    const [deleteStatus, setDeleteStatus] = useState('');

    function setDeleteField(k, v) { setDeleteForm(function(p) { return { ...p, [k]: v }; }); }

    async function runDelete()
    {
        if (!deleteForm.root) { setDeleteStatus('Root directory is required'); return; }
        const platforms = ['youtube', 'instagram', 'facebook'].filter(function(p) { return deleteForm[p]; });
        if (!platforms.length) { setDeleteStatus('Select at least one platform'); return; }
        const args = ['--root', deleteForm.root, '--platforms', platforms.join(',')];
        if (deleteForm.dryRun) args.push('--dry-run');
        setDeleteStatus(deleteForm.dryRun ? 'running dry run…' : 'deleting files…');
        const r = await runTool('deleteUploadedVideos.py', args);
        setDeleteStatus(r.success ? 'started (PID ' + r.pid + ')' : r.errorMessage);
    }

    async function stopAll()
    {
        await stopTool();
        setMetaStatus('stopped');
        setMusicStatus('stopped');
        setAuditStatus('stopped');
        setDeleteStatus('stopped');
    }

    return (
        <section className="page-panel" style={{ padding: 24 }}>
            <div className="page-heading" style={{ marginBottom: 24 }}>
                <span className="page-eyebrow">Maintenance</span>
                <h1 className="page-title">Tools</h1>
                <p className="page-placeholder">Run standalone maintenance and diagnostic scripts.</p>
            </div>

            {/* ── Live Upload Audit ──────────────────────────────────────────── */}
            <div style={panelStyle}>
                <h2 style={{ fontSize: 16, marginBottom: 4, color: '#e2e8f0' }}>Live Upload Audit</h2>
                <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>Fetch live inventories from YouTube, Instagram, and Facebook then rebuild the comparison report.</p>
                <div style={fieldStyle}>
                    <label style={labelStyle}>Video Root (required)</label>
                    <input type="text" value={auditForm.root} onChange={function(e) { setAuditField('root', e.target.value); }} style={inputStyle} placeholder='E:\Videos\VALORANT' />
                </div>
                <div style={fieldStyle}>
                    <label style={labelStyle}>Meta Access Token</label>
                    <input type="text" value={auditForm.metaAccessToken} onChange={function(e) { setAuditField('metaAccessToken', e.target.value); }} style={inputStyle} placeholder="EAAo..." />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                        <label style={labelStyle}>Instagram User ID</label>
                        <input type="text" value={auditForm.igUserId} onChange={function(e) { setAuditField('igUserId', e.target.value); }} style={inputStyle} placeholder="17841..." />
                    </div>
                    <div>
                        <label style={labelStyle}>Facebook Page ID</label>
                        <input type="text" value={auditForm.facebookPageId} onChange={function(e) { setAuditField('facebookPageId', e.target.value); }} style={inputStyle} placeholder="10644..." />
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                        <label style={labelStyle}>Graph Version</label>
                        <input type="text" value={auditForm.graphVersion} onChange={function(e) { setAuditField('graphVersion', e.target.value); }} style={inputStyle} placeholder="v25.0" />
                    </div>
                    <div>
                        <label style={labelStyle}>Client Secrets</label>
                        <input type="text" value={auditForm.clientSecrets} onChange={function(e) { setAuditField('clientSecrets', e.target.value); }} style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>Token File</label>
                        <input type="text" value={auditForm.tokenFile} onChange={function(e) { setAuditField('tokenFile', e.target.value); }} style={inputStyle} />
                    </div>
                </div>
                <div style={fieldStyle}>
                    <label style={labelStyle}>Output Directory</label>
                    <input type="text" value={auditForm.outputDir} onChange={function(e) { setAuditField('outputDir', e.target.value); }} style={inputStyle} />
                </div>
                <div>
                    <button onClick={runLiveAudit} style={btnStyle}>Run Live Audit</button>
                    <button onClick={stopAll} style={stopBtnStyle}>Stop</button>
                </div>
                {auditStatus ? <p style={statusStyle}>{auditStatus}</p> : null}
            </div>

            {/* ── Delete Uploaded Videos ─────────────────────────────────────── */}
            <div style={panelStyle}>
                <h2 style={{ fontSize: 16, marginBottom: 4, color: '#e2e8f0' }}>Delete Uploaded Videos</h2>
                <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>Delete source video files that have already been uploaded to ALL selected platforms. Always run with Dry Run first.</p>
                <div style={fieldStyle}>
                    <label style={labelStyle}>Video Root (required)</label>
                    <input type="text" value={deleteForm.root} onChange={function(e) { setDeleteField('root', e.target.value); }} style={inputStyle} placeholder='E:\Videos\VALORANT' />
                </div>
                <div style={{ marginBottom: 12 }}>
                    <label style={labelStyle}>Must be uploaded on ALL of:</label>
                    <div style={checkRow}>
                        <input type="checkbox" id="del-yt" checked={deleteForm.youtube}   onChange={function(e) { setDeleteField('youtube',   e.target.checked); }} />
                        <label htmlFor="del-yt"  style={{ fontSize: 13, color: '#ccc' }}>YouTube</label>
                    </div>
                    <div style={checkRow}>
                        <input type="checkbox" id="del-ig" checked={deleteForm.instagram} onChange={function(e) { setDeleteField('instagram', e.target.checked); }} />
                        <label htmlFor="del-ig"  style={{ fontSize: 13, color: '#ccc' }}>Instagram</label>
                    </div>
                    <div style={checkRow}>
                        <input type="checkbox" id="del-fb" checked={deleteForm.facebook}  onChange={function(e) { setDeleteField('facebook',  e.target.checked); }} />
                        <label htmlFor="del-fb"  style={{ fontSize: 13, color: '#ccc' }}>Facebook</label>
                    </div>
                </div>
                <div style={{ ...checkRow, marginBottom: 16 }}>
                    <input type="checkbox" id="del-dry" checked={deleteForm.dryRun} onChange={function(e) { setDeleteField('dryRun', e.target.checked); }} />
                    <label htmlFor="del-dry" style={{ fontSize: 13, color: '#fbbf24', fontWeight: 600 }}>Dry Run (list only, no deletion)</label>
                </div>
                <div>
                    <button onClick={runDelete} style={deleteForm.dryRun ? btnStyle : dangerBtnStyle}>
                        {deleteForm.dryRun ? 'Preview Deletions' : '⚠ Delete Files'}
                    </button>
                    <button onClick={stopAll} style={stopBtnStyle}>Stop</button>
                </div>
                {deleteStatus ? <p style={statusStyle}>{deleteStatus}</p> : null}
            </div>

            {/* ── Fix Repeated YT Metadata ───────────────────────────────────── */}
            <div style={panelStyle}>
                <h2 style={{ fontSize: 16, marginBottom: 16, color: '#e2e8f0' }}>Fix Repeated YouTube Metadata</h2>
                <div style={fieldStyle}>
                    <label style={labelStyle}>Mode</label>
                    <select value={metaForm.mode} onChange={function(e) { setMetaForm(function(p) { return { ...p, mode: e.target.value }; }); }} style={inputStyle}>
                        <option value="all">all</option>
                        <option value="title">title</option>
                        <option value="description">description</option>
                    </select>
                </div>
                <div style={fieldStyle}>
                    <label style={labelStyle}>Max Updates</label>
                    <input type="number" value={metaForm.maxUpdates} onChange={function(e) { setMetaForm(function(p) { return { ...p, maxUpdates: Number(e.target.value) }; }); }} style={inputStyle} />
                </div>
                <div style={{ ...fieldStyle, ...checkRow }}>
                    <input type="checkbox" id="metaDryRun" checked={metaForm.dryRun} onChange={function(e) { setMetaForm(function(p) { return { ...p, dryRun: e.target.checked }; }); }} />
                    <label htmlFor="metaDryRun" style={{ fontSize: 13, color: '#ccc' }}>Dry Run</label>
                </div>
                <div style={fieldStyle}>
                    <label style={labelStyle}>Client Secrets Path</label>
                    <input type="text" value={metaForm.clientSecrets} onChange={function(e) { setMetaForm(function(p) { return { ...p, clientSecrets: e.target.value }; }); }} style={inputStyle} placeholder="client_secret.json" />
                </div>
                <div style={fieldStyle}>
                    <label style={labelStyle}>Token File Path</label>
                    <input type="text" value={metaForm.tokenFile} onChange={function(e) { setMetaForm(function(p) { return { ...p, tokenFile: e.target.value }; }); }} style={inputStyle} placeholder="token.json" />
                </div>
                <div>
                    <button onClick={runMetaFix} style={btnStyle}>Run Fix</button>
                    <button onClick={stopAll} style={stopBtnStyle}>Stop</button>
                </div>
                {metaStatus ? <p style={statusStyle}>{metaStatus}</p> : null}
            </div>

            {/* ── Music Overlay Sample ───────────────────────────────────────── */}
            <div style={panelStyle}>
                <h2 style={{ fontSize: 16, marginBottom: 16, color: '#e2e8f0' }}>Music Overlay Sample</h2>
                <div style={fieldStyle}>
                    <label style={labelStyle}>Music Directory (required)</label>
                    <input type="text" value={musicForm.musicDir} onChange={function(e) { setMusicForm(function(p) { return { ...p, musicDir: e.target.value }; }); }} style={inputStyle} placeholder="/path/to/music" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                        <label style={labelStyle}>Sample Video</label>
                        <input type="text" value={musicForm.sampleVideo} onChange={function(e) { setMusicForm(function(p) { return { ...p, sampleVideo: e.target.value }; }); }} style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>Sample Music</label>
                        <input type="text" value={musicForm.sampleMusic} onChange={function(e) { setMusicForm(function(p) { return { ...p, sampleMusic: e.target.value }; }); }} style={inputStyle} />
                    </div>
                </div>
                <div style={fieldStyle}>
                    <label style={labelStyle}>Output Path</label>
                    <input type="text" value={musicForm.sampleOutput} onChange={function(e) { setMusicForm(function(p) { return { ...p, sampleOutput: e.target.value }; }); }} style={inputStyle} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                        <label style={labelStyle}>BG Volume (0–1)</label>
                        <input type="number" step="0.05" min="0" max="1" value={musicForm.bgVolume} onChange={function(e) { setMusicForm(function(p) { return { ...p, bgVolume: parseFloat(e.target.value) }; }); }} style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>ffmpeg Binary</label>
                        <input type="text" value={musicForm.ffmpegBin} onChange={function(e) { setMusicForm(function(p) { return { ...p, ffmpegBin: e.target.value }; }); }} style={inputStyle} placeholder="ffmpeg" />
                    </div>
                    <div>
                        <label style={labelStyle}>ffprobe Binary</label>
                        <input type="text" value={musicForm.ffprobeBin} onChange={function(e) { setMusicForm(function(p) { return { ...p, ffprobeBin: e.target.value }; }); }} style={inputStyle} placeholder="ffprobe" />
                    </div>
                </div>
                <div>
                    <button onClick={runMusicSample} style={btnStyle}>Run Sample</button>
                    <button onClick={stopAll} style={stopBtnStyle}>Stop</button>
                </div>
                {musicStatus ? <p style={statusStyle}>{musicStatus}</p> : null}
            </div>

        </section>
    );
}

export default Tools;
