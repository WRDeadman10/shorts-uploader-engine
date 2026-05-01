import { useState } from 'react';
import { useAppStore } from './useAppStore.js';

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
    const tf  = useAppStore(function(s) { return s.toolsForm; });
    const set = useAppStore(function(s) { return s.setToolsField; });

    // Transient run-status messages (no need to persist these)
    const [metaStatus,    setMetaStatus]    = useState('');
    const [musicStatus,   setMusicStatus]   = useState('');
    const [auditStatus,   setAuditStatus]   = useState('');
    const [deleteStatus,  setDeleteStatus]  = useState('');
    const [trendingStatus, setTrendingStatus] = useState('');

    // ── Live Upload Audit ────────────────────────────────────────────────────
    async function runLiveAudit()
    {
        if (!tf.auditRoot) { setAuditStatus('Root directory is required'); return; }
        const args = ['--root', tf.auditRoot];
        if (tf.auditMetaAccessToken) args.push('--meta-access-token', tf.auditMetaAccessToken);
        if (tf.auditIgUserId)        args.push('--ig-user-id',        tf.auditIgUserId);
        if (tf.auditFacebookPageId)  args.push('--facebook-page-id',  tf.auditFacebookPageId);
        if (tf.auditGraphVersion)    args.push('--graph-version',      tf.auditGraphVersion);
        if (tf.auditClientSecrets)   args.push('--client-secrets',     tf.auditClientSecrets);
        if (tf.auditTokenFile)       args.push('--token-file',         tf.auditTokenFile);
        if (tf.auditOutputDir)       args.push('--output-dir',         tf.auditOutputDir);
        setAuditStatus('running… (this may take a while while fetching live platform data)');
        const r = await runTool('generateLiveUploadAudit.py', args);
        setAuditStatus(r.success ? 'started (PID ' + r.pid + ')' : r.errorMessage);
    }

    // ── Delete Uploaded Videos ───────────────────────────────────────────────
    async function runDelete()
    {
        if (!tf.deleteRoot) { setDeleteStatus('Root directory is required'); return; }
        const platforms = ['youtube', 'instagram', 'facebook'].filter(function(p) { return tf['delete' + p.charAt(0).toUpperCase() + p.slice(1)]; });
        if (!platforms.length) { setDeleteStatus('Select at least one platform'); return; }
        const args = ['--root', tf.deleteRoot, '--platforms', platforms.join(',')];
        if (tf.deleteDryRun) args.push('--dry-run');
        setDeleteStatus(tf.deleteDryRun ? 'running dry run…' : 'deleting files…');
        const r = await runTool('deleteUploadedVideos.py', args);
        setDeleteStatus(r.success ? 'started (PID ' + r.pid + ')' : r.errorMessage);
    }

    // ── Fix Repeated YT Metadata ─────────────────────────────────────────────
    async function runMetaFix()
    {
        const args = ['--mode', tf.metaMode, '--max-updates', String(tf.metaMaxUpdates)];
        if (tf.metaDryRun)       args.push('--dry-run');
        if (tf.metaClientSecrets) args.push('--client-secrets', tf.metaClientSecrets);
        if (tf.metaTokenFile)     args.push('--token-file',     tf.metaTokenFile);
        setMetaStatus('running…');
        const r = await runTool('youtubeFixRepeatedMetadata.py', args);
        setMetaStatus(r.success ? 'started (PID ' + r.pid + ')' : r.errorMessage);
    }

    // ── Music Overlay Sample ─────────────────────────────────────────────────
    async function runMusicSample()
    {
        if (!tf.musicDir) { setMusicStatus('Music dir is required'); return; }
        const args = ['--music-dir', tf.musicDir];
        if (tf.musicSampleVideo)  args.push('--sample-video',  tf.musicSampleVideo);
        if (tf.musicSampleMusic)  args.push('--sample-music',  tf.musicSampleMusic);
        if (tf.musicSampleOutput) args.push('--sample-output', tf.musicSampleOutput);
        if (tf.musicBgVolume)     args.push('--bg-volume',     String(tf.musicBgVolume));
        if (tf.musicFfmpegBin)    args.push('--ffmpeg-bin',    tf.musicFfmpegBin);
        if (tf.musicFfprobeBin)   args.push('--ffprobe-bin',   tf.musicFfprobeBin);
        setMusicStatus('running…');
        const r = await runTool('musicOverlaySample.py', args);
        setMusicStatus(r.success ? 'started (PID ' + r.pid + ')' : r.errorMessage);
    }

    // ── Trending Audio ───────────────────────────────────────────────────────
    async function runTrendingAudio()
    {
        if (!tf.trendingYoutube && !tf.trendingInstagram) { setTrendingStatus('Select at least one platform'); return; }
        const args = [];
        if (tf.trendingYoutube)   args.push('--youtube');
        if (tf.trendingInstagram) args.push('--instagram');
        if (tf.trendingYoutubeApiKey)  args.push('--youtube-api-key',  tf.trendingYoutubeApiKey);
        if (tf.trendingClientSecrets)  args.push('--client-secrets',   tf.trendingClientSecrets);
        if (tf.trendingTokenFile)      args.push('--token-file',        tf.trendingTokenFile);
        if (tf.trendingIgUsername)     args.push('--ig-username',       tf.trendingIgUsername);
        if (tf.trendingIgPassword)     args.push('--ig-password',       tf.trendingIgPassword);
        if (tf.trendingIgSessionFile)  args.push('--ig-session-file',   tf.trendingIgSessionFile);
        if (tf.trendingRegion)         args.push('--region',            tf.trendingRegion);
        if (tf.trendingMaxResults)     args.push('--max-results',       String(tf.trendingMaxResults));
        if (tf.trendingOutputFile)     args.push('--output-file',       tf.trendingOutputFile);
        setTrendingStatus('running… fetching trending data');
        const r = await runTool('getTrendingAudio.py', args);
        setTrendingStatus(r.success ? 'started (PID ' + r.pid + ') — output → ' + (tf.trendingOutputFile || 'trending_audio_report.json') : r.errorMessage);
    }

    async function stopAll()
    {
        await stopTool();
        setMetaStatus('stopped');
        setMusicStatus('stopped');
        setAuditStatus('stopped');
        setDeleteStatus('stopped');
        setTrendingStatus('stopped');
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
                    <input type="text" value={tf.auditRoot} onChange={function(e) { set('auditRoot', e.target.value); }} style={inputStyle} placeholder='E:\Videos\VALORANT' />
                </div>
                <div style={fieldStyle}>
                    <label style={labelStyle}>Meta Access Token</label>
                    <input type="text" value={tf.auditMetaAccessToken} onChange={function(e) { set('auditMetaAccessToken', e.target.value); }} style={inputStyle} placeholder="EAAo..." />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                        <label style={labelStyle}>Instagram User ID</label>
                        <input type="text" value={tf.auditIgUserId} onChange={function(e) { set('auditIgUserId', e.target.value); }} style={inputStyle} placeholder="17841..." />
                    </div>
                    <div>
                        <label style={labelStyle}>Facebook Page ID</label>
                        <input type="text" value={tf.auditFacebookPageId} onChange={function(e) { set('auditFacebookPageId', e.target.value); }} style={inputStyle} placeholder="10644..." />
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                        <label style={labelStyle}>Graph Version</label>
                        <input type="text" value={tf.auditGraphVersion} onChange={function(e) { set('auditGraphVersion', e.target.value); }} style={inputStyle} placeholder="v25.0" />
                    </div>
                    <div>
                        <label style={labelStyle}>Client Secrets</label>
                        <input type="text" value={tf.auditClientSecrets} onChange={function(e) { set('auditClientSecrets', e.target.value); }} style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>Token File</label>
                        <input type="text" value={tf.auditTokenFile} onChange={function(e) { set('auditTokenFile', e.target.value); }} style={inputStyle} />
                    </div>
                </div>
                <div style={fieldStyle}>
                    <label style={labelStyle}>Output Directory</label>
                    <input type="text" value={tf.auditOutputDir} onChange={function(e) { set('auditOutputDir', e.target.value); }} style={inputStyle} />
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
                    <input type="text" value={tf.deleteRoot} onChange={function(e) { set('deleteRoot', e.target.value); }} style={inputStyle} placeholder='E:\Videos\VALORANT' />
                </div>
                <div style={{ marginBottom: 12 }}>
                    <label style={labelStyle}>Must be uploaded on ALL of:</label>
                    <div style={checkRow}>
                        <input type="checkbox" id="del-yt" checked={tf.deleteYoutube}   onChange={function(e) { set('deleteYoutube',   e.target.checked); }} />
                        <label htmlFor="del-yt"  style={{ fontSize: 13, color: '#ccc' }}>YouTube</label>
                    </div>
                    <div style={checkRow}>
                        <input type="checkbox" id="del-ig" checked={tf.deleteInstagram} onChange={function(e) { set('deleteInstagram', e.target.checked); }} />
                        <label htmlFor="del-ig"  style={{ fontSize: 13, color: '#ccc' }}>Instagram</label>
                    </div>
                    <div style={checkRow}>
                        <input type="checkbox" id="del-fb" checked={tf.deleteFacebook}  onChange={function(e) { set('deleteFacebook',  e.target.checked); }} />
                        <label htmlFor="del-fb"  style={{ fontSize: 13, color: '#ccc' }}>Facebook</label>
                    </div>
                </div>
                <div style={{ ...checkRow, marginBottom: 16 }}>
                    <input type="checkbox" id="del-dry" checked={tf.deleteDryRun} onChange={function(e) { set('deleteDryRun', e.target.checked); }} />
                    <label htmlFor="del-dry" style={{ fontSize: 13, color: '#fbbf24', fontWeight: 600 }}>Dry Run (list only, no deletion)</label>
                </div>
                <div>
                    <button onClick={runDelete} style={tf.deleteDryRun ? btnStyle : dangerBtnStyle}>
                        {tf.deleteDryRun ? 'Preview Deletions' : '⚠ Delete Files'}
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
                    <select value={tf.metaMode} onChange={function(e) { set('metaMode', e.target.value); }} style={inputStyle}>
                        <option value="all">all</option>
                        <option value="title">title</option>
                        <option value="description">description</option>
                    </select>
                </div>
                <div style={fieldStyle}>
                    <label style={labelStyle}>Max Updates</label>
                    <input type="number" value={tf.metaMaxUpdates} onChange={function(e) { set('metaMaxUpdates', Number(e.target.value)); }} style={inputStyle} />
                </div>
                <div style={{ ...fieldStyle, ...checkRow }}>
                    <input type="checkbox" id="metaDryRun" checked={tf.metaDryRun} onChange={function(e) { set('metaDryRun', e.target.checked); }} />
                    <label htmlFor="metaDryRun" style={{ fontSize: 13, color: '#ccc' }}>Dry Run</label>
                </div>
                <div style={fieldStyle}>
                    <label style={labelStyle}>Client Secrets Path</label>
                    <input type="text" value={tf.metaClientSecrets} onChange={function(e) { set('metaClientSecrets', e.target.value); }} style={inputStyle} placeholder="client_secret.json" />
                </div>
                <div style={fieldStyle}>
                    <label style={labelStyle}>Token File Path</label>
                    <input type="text" value={tf.metaTokenFile} onChange={function(e) { set('metaTokenFile', e.target.value); }} style={inputStyle} placeholder="token.json" />
                </div>
                <div>
                    <button onClick={runMetaFix} style={btnStyle}>Run Fix</button>
                    <button onClick={stopAll} style={stopBtnStyle}>Stop</button>
                </div>
                {metaStatus ? <p style={statusStyle}>{metaStatus}</p> : null}
            </div>

            {/* ── Trending Audio ─────────────────────────────────────────────── */}
            <div style={panelStyle}>
                <h2 style={{ fontSize: 16, marginBottom: 4, color: '#e2e8f0' }}>Trending Audio</h2>
                <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>Fetch currently trending audio from YouTube (music category) and Instagram (trending reels). Saves a JSON report you can reference when choosing background tracks.</p>

                {/* Platform selection */}
                <div style={{ display: 'flex', gap: 20, marginBottom: 14 }}>
                    <div style={checkRow}>
                        <input type="checkbox" id="trend-yt" checked={tf.trendingYoutube}   onChange={function(e) { set('trendingYoutube',   e.target.checked); }} />
                        <label htmlFor="trend-yt"  style={{ fontSize: 13, color: '#ccc' }}>YouTube</label>
                    </div>
                    <div style={checkRow}>
                        <input type="checkbox" id="trend-ig" checked={tf.trendingInstagram} onChange={function(e) { set('trendingInstagram', e.target.checked); }} />
                        <label htmlFor="trend-ig"  style={{ fontSize: 13, color: '#ccc' }}>Instagram</label>
                    </div>
                </div>

                {/* YouTube auth */}
                {tf.trendingYoutube && (
                    <div style={{ borderLeft: '2px solid #374151', paddingLeft: 12, marginBottom: 14 }}>
                        <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 8px' }}>YouTube — provide API key (recommended) or OAuth credentials</p>
                        <div style={fieldStyle}>
                            <label style={labelStyle}>YouTube Data API Key</label>
                            <input type="text" value={tf.trendingYoutubeApiKey} onChange={function(e) { set('trendingYoutubeApiKey', e.target.value); }} style={inputStyle} placeholder="AIza..." />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                            <div>
                                <label style={labelStyle}>Client Secrets (OAuth fallback)</label>
                                <input type="text" value={tf.trendingClientSecrets} onChange={function(e) { set('trendingClientSecrets', e.target.value); }} style={inputStyle} placeholder="client_secret.json" />
                            </div>
                            <div>
                                <label style={labelStyle}>Token File (OAuth fallback)</label>
                                <input type="text" value={tf.trendingTokenFile} onChange={function(e) { set('trendingTokenFile', e.target.value); }} style={inputStyle} placeholder="token.json" />
                            </div>
                        </div>
                    </div>
                )}

                {/* Instagram auth */}
                {tf.trendingInstagram && (
                    <div style={{ borderLeft: '2px solid #374151', paddingLeft: 12, marginBottom: 14 }}>
                        <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 8px' }}>Instagram — requires instagrapi (<code style={{ color: '#a3e635' }}>pip install instagrapi</code>)</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                            <div>
                                <label style={labelStyle}>Instagram Username</label>
                                <input type="text" value={tf.trendingIgUsername} onChange={function(e) { set('trendingIgUsername', e.target.value); }} style={inputStyle} placeholder="your_username" />
                            </div>
                            <div>
                                <label style={labelStyle}>Instagram Password</label>
                                <input type="password" value={tf.trendingIgPassword} onChange={function(e) { set('trendingIgPassword', e.target.value); }} style={inputStyle} placeholder="••••••••" />
                            </div>
                        </div>
                        <div style={fieldStyle}>
                            <label style={labelStyle}>Session Cache File</label>
                            <input type="text" value={tf.trendingIgSessionFile} onChange={function(e) { set('trendingIgSessionFile', e.target.value); }} style={inputStyle} placeholder=".ig_session.json" />
                        </div>
                    </div>
                )}

                {/* Shared options */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                    <div>
                        <label style={labelStyle}>Region</label>
                        <input type="text" value={tf.trendingRegion} onChange={function(e) { set('trendingRegion', e.target.value); }} style={inputStyle} placeholder="IN" />
                    </div>
                    <div>
                        <label style={labelStyle}>Max Results</label>
                        <input type="number" min={1} max={50} value={tf.trendingMaxResults} onChange={function(e) { set('trendingMaxResults', parseInt(e.target.value) || 20); }} style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>Output File</label>
                        <input type="text" value={tf.trendingOutputFile} onChange={function(e) { set('trendingOutputFile', e.target.value); }} style={inputStyle} placeholder="trending_audio_report.json" />
                    </div>
                </div>

                <div>
                    <button onClick={runTrendingAudio} style={btnStyle}>Fetch Trending Audio</button>
                    <button onClick={stopAll} style={stopBtnStyle}>Stop</button>
                </div>
                {trendingStatus ? <p style={statusStyle}>{trendingStatus}</p> : null}
            </div>

            {/* ── Music Overlay Sample ───────────────────────────────────────── */}
            <div style={panelStyle}>
                <h2 style={{ fontSize: 16, marginBottom: 16, color: '#e2e8f0' }}>Music Overlay Sample</h2>
                <div style={fieldStyle}>
                    <label style={labelStyle}>Music Directory (required)</label>
                    <input type="text" value={tf.musicDir} onChange={function(e) { set('musicDir', e.target.value); }} style={inputStyle} placeholder="/path/to/music" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                        <label style={labelStyle}>Sample Video</label>
                        <input type="text" value={tf.musicSampleVideo} onChange={function(e) { set('musicSampleVideo', e.target.value); }} style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>Sample Music</label>
                        <input type="text" value={tf.musicSampleMusic} onChange={function(e) { set('musicSampleMusic', e.target.value); }} style={inputStyle} />
                    </div>
                </div>
                <div style={fieldStyle}>
                    <label style={labelStyle}>Output Path</label>
                    <input type="text" value={tf.musicSampleOutput} onChange={function(e) { set('musicSampleOutput', e.target.value); }} style={inputStyle} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                        <label style={labelStyle}>BG Volume (0–1)</label>
                        <input type="number" step="0.05" min="0" max="1" value={tf.musicBgVolume} onChange={function(e) { set('musicBgVolume', parseFloat(e.target.value)); }} style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>ffmpeg Binary</label>
                        <input type="text" value={tf.musicFfmpegBin} onChange={function(e) { set('musicFfmpegBin', e.target.value); }} style={inputStyle} placeholder="ffmpeg" />
                    </div>
                    <div>
                        <label style={labelStyle}>ffprobe Binary</label>
                        <input type="text" value={tf.musicFfprobeBin} onChange={function(e) { set('musicFfprobeBin', e.target.value); }} style={inputStyle} placeholder="ffprobe" />
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
