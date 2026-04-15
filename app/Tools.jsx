import { useState } from 'react';

function Tools() {
    const [metaForm, setMetaForm] = useState({ mode: 'all', maxUpdates: 25, dryRun: false, clientSecrets: '', tokenFile: '' });
    const [metaStatus, setMetaStatus] = useState('');
    const [musicForm, setMusicForm] = useState({ musicDir: '', sampleVideo: '', sampleMusic: '', sampleOutput: '', bgVolume: 0.3, ffmpegBin: '', ffprobeBin: '' });
    const [musicStatus, setMusicStatus] = useState('');

    function setMetaField(key, value) {
        setMetaForm(function prev(p) { return { ...p, [key]: value }; });
    }

    function setMusicField(key, value) {
        setMusicForm(function prev(p) { return { ...p, [key]: value }; });
    }

    async function runMetaFix() {
        if (!window.api || !window.api.runTool) { setMetaStatus('API not available'); return; }
        const args = ['--mode', metaForm.mode, '--max-updates', String(metaForm.maxUpdates)];
        if (metaForm.dryRun) args.push('--dry-run');
        if (metaForm.clientSecrets) args.push('--client-secrets', metaForm.clientSecrets);
        if (metaForm.tokenFile) args.push('--token-file', metaForm.tokenFile);
        setMetaStatus('running...');
        const result = await window.api.runTool({ toolName: 'youtubeFixRepeatedMetadata.py', args });
        setMetaStatus(result.success ? 'started (PID ' + result.pid + ')' : result.errorMessage);
    }

    async function runMusicSample() {
        if (!window.api || !window.api.runTool) { setMusicStatus('API not available'); return; }
        if (!musicForm.musicDir) { setMusicStatus('Music dir is required'); return; }
        const args = ['--music-dir', musicForm.musicDir];
        if (musicForm.sampleVideo) args.push('--sample-video', musicForm.sampleVideo);
        if (musicForm.sampleMusic) args.push('--sample-music', musicForm.sampleMusic);
        if (musicForm.sampleOutput) args.push('--sample-output', musicForm.sampleOutput);
        if (musicForm.bgVolume) args.push('--bg-volume', String(musicForm.bgVolume));
        if (musicForm.ffmpegBin) args.push('--ffmpeg-bin', musicForm.ffmpegBin);
        if (musicForm.ffprobeBin) args.push('--ffprobe-bin', musicForm.ffprobeBin);
        setMusicStatus('running...');
        const result = await window.api.runTool({ toolName: 'musicOverlaySample.py', args });
        setMusicStatus(result.success ? 'started (PID ' + result.pid + ')' : result.errorMessage);
    }

    async function stopActiveTool() {
        if (!window.api || !window.api.stopTool) return;
        await window.api.stopTool();
        setMetaStatus('stopped');
        setMusicStatus('stopped');
    }

    const inputStyle = { width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #333', background: '#1a1a2e', color: '#fff', fontSize: 13, boxSizing: 'border-box' };
    const labelStyle = { display: 'block', fontSize: 12, color: '#aaa', marginBottom: 4 };
    const fieldStyle = { marginBottom: 12 };
    const btnStyle = { padding: '8px 18px', borderRadius: 6, border: 'none', background: '#4f46e5', color: '#fff', cursor: 'pointer', fontSize: 13, marginRight: 8 };
    const stopBtnStyle = { ...btnStyle, background: '#7f1d1d' };
    const panelStyle = { background: '#111827', borderRadius: 10, padding: 20, marginBottom: 24 };
    const statusStyle = { fontSize: 12, color: '#a3e635', marginTop: 8 };

    return (
        <section className="page-panel" style={{ padding: 24 }}>
            <div className="page-heading">
                <span className="page-eyebrow">Maintenance</span>
                <h1 className="page-title">Tools</h1>
                <p className="page-placeholder">Run standalone maintenance and sampling scripts.</p>
            </div>

            <div style={panelStyle}>
                <h2 style={{ fontSize: 16, marginBottom: 16, color: '#e2e8f0' }}>Fix Repeated YouTube Metadata</h2>
                <div style={fieldStyle}>
                    <label style={labelStyle}>Mode</label>
                    <select value={metaForm.mode} onChange={function(e) { setMetaField('mode', e.target.value); }} style={inputStyle}>
                        <option value="all">all</option>
                        <option value="title">title</option>
                        <option value="description">description</option>
                    </select>
                </div>
                <div style={fieldStyle}>
                    <label style={labelStyle}>Max Updates</label>
                    <input type="number" value={metaForm.maxUpdates} onChange={function(e) { setMetaField('maxUpdates', Number(e.target.value)); }} style={inputStyle} />
                </div>
                <div style={{ ...fieldStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" id="metaDryRun" checked={metaForm.dryRun} onChange={function(e) { setMetaField('dryRun', e.target.checked); }} />
                    <label htmlFor="metaDryRun" style={{ fontSize: 13, color: '#ccc' }}>Dry Run</label>
                </div>
                <div style={fieldStyle}>
                    <label style={labelStyle}>Client Secrets Path</label>
                    <input type="text" value={metaForm.clientSecrets} onChange={function(e) { setMetaField('clientSecrets', e.target.value); }} style={inputStyle} placeholder="client_secret.json" />
                </div>
                <div style={fieldStyle}>
                    <label style={labelStyle}>Token File Path</label>
                    <input type="text" value={metaForm.tokenFile} onChange={function(e) { setMetaField('tokenFile', e.target.value); }} style={inputStyle} placeholder="token.json" />
                </div>
                <div>
                    <button onClick={runMetaFix} style={btnStyle}>Run Fix</button>
                    <button onClick={stopActiveTool} style={stopBtnStyle}>Stop</button>
                </div>
                {metaStatus ? <p style={statusStyle}>{metaStatus}</p> : null}
            </div>

            <div style={panelStyle}>
                <h2 style={{ fontSize: 16, marginBottom: 16, color: '#e2e8f0' }}>Music Overlay Sample</h2>
                <div style={fieldStyle}>
                    <label style={labelStyle}>Music Directory (required)</label>
                    <input type="text" value={musicForm.musicDir} onChange={function(e) { setMusicField('musicDir', e.target.value); }} style={inputStyle} placeholder="/path/to/music" />
                </div>
                <div style={fieldStyle}>
                    <label style={labelStyle}>Sample Video Path</label>
                    <input type="text" value={musicForm.sampleVideo} onChange={function(e) { setMusicField('sampleVideo', e.target.value); }} style={inputStyle} />
                </div>
                <div style={fieldStyle}>
                    <label style={labelStyle}>Sample Music Path</label>
                    <input type="text" value={musicForm.sampleMusic} onChange={function(e) { setMusicField('sampleMusic', e.target.value); }} style={inputStyle} />
                </div>
                <div style={fieldStyle}>
                    <label style={labelStyle}>Output Path</label>
                    <input type="text" value={musicForm.sampleOutput} onChange={function(e) { setMusicField('sampleOutput', e.target.value); }} style={inputStyle} />
                </div>
                <div style={fieldStyle}>
                    <label style={labelStyle}>Background Volume (0.0–1.0)</label>
                    <input type="number" step="0.05" min="0" max="1" value={musicForm.bgVolume} onChange={function(e) { setMusicField('bgVolume', parseFloat(e.target.value)); }} style={inputStyle} />
                </div>
                <div style={fieldStyle}>
                    <label style={labelStyle}>ffmpeg Binary</label>
                    <input type="text" value={musicForm.ffmpegBin} onChange={function(e) { setMusicField('ffmpegBin', e.target.value); }} style={inputStyle} placeholder="ffmpeg" />
                </div>
                <div style={fieldStyle}>
                    <label style={labelStyle}>ffprobe Binary</label>
                    <input type="text" value={musicForm.ffprobeBin} onChange={function(e) { setMusicField('ffprobeBin', e.target.value); }} style={inputStyle} placeholder="ffprobe" />
                </div>
                <div>
                    <button onClick={runMusicSample} style={btnStyle}>Run Sample</button>
                    <button onClick={stopActiveTool} style={stopBtnStyle}>Stop</button>
                </div>
                {musicStatus ? <p style={statusStyle}>{musicStatus}</p> : null}
            </div>
        </section>
    );
}

export default Tools;
