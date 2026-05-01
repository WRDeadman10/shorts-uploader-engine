import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import ToggleSwitch from "./ToggleSwitch.jsx";
import UploadAdvancedOptions from './UploadAdvancedOptions.jsx';
import UploadQueuePreview, { computeUploadQueue } from './UploadQueuePreview.jsx';
import { useAppStore } from "./useAppStore.js";

const platformOptions = [
    { id: "youtube",   label: "YouTube Shorts" },
    { id: "instagram", label: "Instagram Reels" },
    { id: "facebook",  label: "Facebook Reels" }
];

const uploadOptions = [
    { id: "includeShorts",   label: "Shorts Format" },
    { id: "includeMusic",    label: "Music Overlay" },
    { id: "includeMetadata", label: "AI Metadata" }
];

const sideRow = {
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', padding: '5px 0',
};

const sideInput = {
    padding: '4px 8px', borderRadius: 4,
    border: '1px solid #444', background: '#1a1a2e',
    color: '#fff', fontSize: 13, width: 130,
};

function Upload()
{
    const platforms     = useAppStore(s => s.uploadPlatforms);
    const options       = useAppStore(s => s.uploadOptions);
    const uploadStatus  = useAppStore(s => s.uploadStatus);
    const setUploadPlatform = useAppStore(s => s.setUploadPlatform);
    const setUploadOption   = useAppStore(s => s.setUploadOption);
    const runUpload         = useAppStore(s => s.runUpload);
    const stopUpload        = useAppStore(s => s.stopUpload);
    const syncUploadStatus  = useAppStore(s => s.syncUploadStatus);
    const videoList    = useAppStore(s => s.videoList);
    const logEntries   = useAppStore(s => s.logEntries);

    const scheduleEnabled   = useAppStore(s => s.scheduleEnabled);
    const scheduleDate      = useAppStore(s => s.scheduleDate);
    const youtubeSlots      = useAppStore(s => s.youtubeSlots);
    const facebookSlots     = useAppStore(s => s.facebookSlots);
    const instagramSlots    = useAppStore(s => s.instagramSlots);
    const setScheduleEnabled  = useAppStore(s => s.setScheduleEnabled);
    const setScheduleDate     = useAppStore(s => s.setScheduleDate);
    const addYoutubeSlot      = useAppStore(s => s.addYoutubeSlot);
    const removeYoutubeSlot   = useAppStore(s => s.removeYoutubeSlot);
    const updateYoutubeSlot   = useAppStore(s => s.updateYoutubeSlot);
    const addFacebookSlot     = useAppStore(s => s.addFacebookSlot);
    const removeFacebookSlot  = useAppStore(s => s.removeFacebookSlot);
    const updateFacebookSlot  = useAppStore(s => s.updateFacebookSlot);
    const addInstagramSlot    = useAppStore(s => s.addInstagramSlot);
    const removeInstagramSlot = useAppStore(s => s.removeInstagramSlot);
    const updateInstagramSlot = useAppStore(s => s.updateInstagramSlot);

    useEffect(function pollStatus()
    {
        syncUploadStatus();
        const interval = setInterval(syncUploadStatus, 2000);
        return function() { clearInterval(interval); };
    }, [syncUploadStatus]);

    const uploadQueue = useMemo(
        () => computeUploadQueue(videoList, options, platforms),
        [videoList, options.requireUploadedOn, options.requireMissingOn, options.maxVideos, platforms.youtube, platforms.instagram, platforms.facebook]
    );

    const cliPreview = useMemo(function buildCliPreview()
    {
        if (!platforms.youtube && !platforms.instagram && !platforms.facebook)
            return "Select at least one platform to build a runnable command.";

        // ── All platforms → youtubeBatchUpload.py ─────────────────────────────
        const uploadPlatform = platforms.youtube ? "youtube" : platforms.instagram ? "instagram" : "facebook";
        const mp = platforms.instagram && platforms.facebook ? "both" : platforms.instagram ? "instagram" : "facebook";

        const args = [
            "python youtubeBatchUpload.py",
            "--upload-platform " + uploadPlatform,
            "--max-videos " + String(options.maxVideos || 1),
            "--allow-fallback"
        ];
        if (options.videosRoot)    args.push("--root "          + options.videosRoot);
        if (options.privacy)       args.push("--privacy "       + options.privacy);
        if (options.playlistName)  args.push("--playlist-name " + options.playlistName);
        if (options.ffmpegBin)     args.push("--ffmpeg-bin "    + options.ffmpegBin);
        if (options.ffprobeBin)    args.push("--ffprobe-bin "   + options.ffprobeBin);
        if (options.dryRun)        args.push("--dry-run");
        if (options.requireUploadedOn) args.push("--require-uploaded-on " + options.requireUploadedOn);
        if (options.requireMissingOn)  args.push("--require-missing-on "  + options.requireMissingOn);
        if (options.channelName)   args.push("--channel-name "  + options.channelName);
        if (options.useTrendingAudio && options.includeMusic && options.trendingAudioReportPath)
        {
            args.push("--use-trending-audio");
            args.push("--trending-audio-report " + options.trendingAudioReportPath);
            if (options.trendingAudioCacheDir) args.push("--trending-audio-cache-dir " + options.trendingAudioCacheDir);
            if (options.trendingAudioMaxTracks) args.push("--trending-audio-max " + options.trendingAudioMaxTracks);
        }
        else
        {
            if (options.musicDir) args.push("--music-dir " + options.musicDir);
            if (options.musicVolume !== undefined) args.push("--music-bg-volume " + options.musicVolume);
        }

        args.push(options.includeShorts ? "--shorts-policy convert" : "--shorts-policy off");
        if (!options.includeMetadata) args.push("--no-ai");
        if (!options.includeMusic)    args.push("--music-dir=");

        if (platforms.youtube && (platforms.instagram || platforms.facebook))
        {
            // YouTube primary + crosspost
            args.push("--crosspost-meta");
            args.push("--meta-platform " + mp);
            if (options.metaAccessToken)  args.push("--meta-access-token "     + options.metaAccessToken);
            if (options.igUserId)         args.push("--meta-ig-user-id "       + options.igUserId);
            if (options.fbPageId)         args.push("--meta-facebook-page-id " + options.fbPageId);
            if (options.metaGraphVersion) args.push("--meta-graph-version "    + options.metaGraphVersion);
        }
        else if (!platforms.youtube && (platforms.instagram || platforms.facebook))
        {
            // Instagram-only, Facebook-only, or Instagram+Facebook — direct Meta credentials
            if (platforms.instagram && platforms.facebook) args.push("--meta-platform both");
            else if (platforms.instagram)                 args.push("--meta-platform instagram");
            if (options.metaAccessToken)  args.push("--meta-access-token "     + options.metaAccessToken);
            if (options.igUserId)         args.push("--meta-ig-user-id "       + options.igUserId);
            if (options.fbPageId)         args.push("--meta-facebook-page-id " + options.fbPageId);
            if (options.metaGraphVersion) args.push("--meta-graph-version "    + options.metaGraphVersion);
        }

        return args.join(" \\\n  ");
    }, [options, platforms]);

    const uploadSessions = useAppStore(s => s.uploadSessions);
    const runningCount = Object.values(uploadSessions).filter(function(s) { return s.status === 'running'; }).length;
    const isRunning = runningCount > 0 || uploadStatus.status === 'running';

    return (
        <section
            className="page-panel"
            style={{ padding: 0, display: 'flex', flexDirection: 'column', gap: 0, overflow: 'hidden', height: 'calc(100vh - 132px)', minHeight: 'unset' }}
        >
            {/* ── Top strip: title + action button ── */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0,
            }}>
                <div>
                    <span className="page-eyebrow">Upload Control</span>
                    <h1 style={{ margin: '4px 0 0', fontSize: '1.5rem', lineHeight: 1 }}>Pipeline Builder</h1>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                        {uploadQueue.length} video{uploadQueue.length !== 1 ? 's' : ''} queued
                        {runningCount > 0
                            ? <span style={{ color: '#fbbf24', marginLeft: 6 }}>· {runningCount} running</span>
                            : <span> · <strong style={{ color: '#e2e8f0' }}>{uploadStatus.status}</strong></span>
                        }
                    </span>
                    {isRunning && (
                        <motion.button className="upload-action-button" style={{ background: '#7f1d1d' }} onClick={stopUpload} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>Stop All</motion.button>
                    )}
                    <motion.button className="upload-action-button" onClick={runUpload} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>Run Upload</motion.button>
                </div>
            </div>

            {/* ── Body: left sidebar + right queue ── */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

                {/* LEFT SIDEBAR */}
                <div style={{
                    width: 300, flexShrink: 0, overflowY: 'auto',
                    borderRight: '1px solid var(--border)',
                    padding: '20px 16px',
                    display: 'flex', flexDirection: 'column', gap: 18,
                }}>

                    {/* Platforms */}
                    <div className="upload-panel" style={{ gap: 10, padding: 16 }}>
                        <span className="upload-panel-title" style={{ fontWeight: 700 }}>Platforms</span>
                        {platformOptions.map(p => (
                            <ToggleSwitch key={p.id} label={p.label} checked={platforms[p.id]}
                                onChange={v => setUploadPlatform(p.id, v)} />
                        ))}
                    </div>

                    {/* Core Options */}
                    <div className="upload-panel" style={{ gap: 10, padding: 16 }}>
                        <span className="upload-panel-title" style={{ fontWeight: 700 }}>Options</span>

                        {uploadOptions.map(o => (
                            <ToggleSwitch key={o.id} label={o.label} checked={options[o.id]}
                                onChange={v => setUploadOption(o.id, v)} />
                        ))}

                        <ToggleSwitch label="Dry Run" checked={options.dryRun || false}
                            onChange={v => setUploadOption('dryRun', v)} />

                        <div style={sideRow}>
                            <span style={{ fontSize: 14 }}>Max Videos</span>
                            <input type="number" min={1} max={500} style={{ ...sideInput, width: 70 }}
                                value={options.maxVideos || 1}
                                onChange={e => setUploadOption('maxVideos', Math.max(1, parseInt(e.target.value, 10) || 1))} />
                        </div>
                        <div style={sideRow}>
                            <span style={{ fontSize: 14 }}>Videos Root</span>
                            <input type="text" placeholder="folder path" style={sideInput}
                                value={options.videosRoot || ''}
                                onChange={e => setUploadOption('videosRoot', e.target.value)} />
                        </div>
                        <div style={sideRow}>
                            <span style={{ fontSize: 14 }}>Privacy</span>
                            <select style={sideInput} value={options.privacy || ''}
                                onChange={e => setUploadOption('privacy', e.target.value)}>
                                <option value="">Default</option>
                                <option value="private">Private</option>
                                <option value="unlisted">Unlisted</option>
                                <option value="public">Public</option>
                            </select>
                        </div>
                        <div style={sideRow}>
                            <span style={{ fontSize: 14 }}>Playlist</span>
                            <input type="text" placeholder="Optional" style={sideInput}
                                value={options.playlistName || ''}
                                onChange={e => setUploadOption('playlistName', e.target.value)} />
                        </div>

                        {/* Discovery Filters */}
                        <div style={{ marginTop: 8, paddingTop: 10, borderTop: '1px solid #333' }}>
                            <span style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>Discovery Filters</span>
                            <div style={sideRow}>
                                <span style={{ fontSize: 14 }}>Extensions</span>
                                <input type="text" placeholder=".mp4,.mov" style={sideInput}
                                    value={options.extensions || ''}
                                    onChange={e => setUploadOption('extensions', e.target.value)} />
                            </div>
                            <div style={sideRow}>
                                <span style={{ fontSize: 14 }}>Exclude Dirs</span>
                                <input type="text" placeholder="drafts,archive" style={sideInput}
                                    value={options.excludeDirectories || ''}
                                    onChange={e => setUploadOption('excludeDirectories', e.target.value)} />
                            </div>
                        </div>

                        {/* Queue Filters */}
                        <div style={{ marginTop: 8, paddingTop: 10, borderTop: '1px solid #333' }}>
                            <span style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>Queue Filters</span>
                            <div style={sideRow}>
                                <span style={{ fontSize: 14 }}>Uploaded On</span>
                                <input type="text" placeholder="youtube" style={sideInput}
                                    value={options.requireUploadedOn || ''}
                                    onChange={e => setUploadOption('requireUploadedOn', e.target.value)} />
                            </div>
                            <div style={sideRow}>
                                <span style={{ fontSize: 14 }}>Missing On</span>
                                <input type="text" placeholder="instagram" style={sideInput}
                                    value={options.requireMissingOn || ''}
                                    onChange={e => setUploadOption('requireMissingOn', e.target.value)} />
                            </div>
                        </div>

                        {/* Credentials */}
                        <div style={{ marginTop: 8, paddingTop: 10, borderTop: '1px solid #333' }}>
                            <span style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>Credentials</span>
                            <div style={sideRow}>
                                <span style={{ fontSize: 14 }}>Client Secrets</span>
                                <input type="text" placeholder="client_secret.json" style={sideInput}
                                    value={options.clientSecretsPath || ''}
                                    onChange={e => setUploadOption('clientSecretsPath', e.target.value)} />
                            </div>
                            <div style={sideRow}>
                                <span style={{ fontSize: 14 }}>Token File</span>
                                <input type="text" placeholder="token.json" style={sideInput}
                                    value={options.tokenFilePath || ''}
                                    onChange={e => setUploadOption('tokenFilePath', e.target.value)} />
                            </div>
                        </div>

                        {/* Advanced options (binary paths, meta creds, AI, music, etc.) */}
                        <UploadAdvancedOptions options={options} setUploadOption={setUploadOption} />
                    </div>

                    {/* Scheduled Publishing */}
                    <div className="upload-panel" style={{ gap: 10, padding: 16 }}>
                        <span className="upload-panel-title" style={{ fontWeight: 700 }}>Scheduled Publishing</span>
                        <ToggleSwitch label="Enable Schedule" checked={scheduleEnabled} onChange={setScheduleEnabled} />
                        {scheduleEnabled && (
                            <input type="date" value={scheduleDate}
                                onChange={e => setScheduleDate(e.target.value)}
                                style={{ ...sideInput, width: '100%' }} />
                        )}
                        {scheduleEnabled && platforms.youtube && (
                            <div style={{ marginTop: 4 }}>
                                <p style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 6px' }}>YouTube Slots</p>
                                {youtubeSlots.map((slot, i) => (
                                    <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 5 }}>
                                        <input type="time" value={slot.time}
                                            onChange={e => updateYoutubeSlot(i, 'time', e.target.value)}
                                            style={{ flex: 1, ...sideInput, width: 'auto' }} />
                                        <input type="number" min={1} value={slot.count}
                                            onChange={e => updateYoutubeSlot(i, 'count', parseInt(e.target.value) || 1)}
                                            style={{ ...sideInput, width: 50 }} />
                                        <button onClick={() => removeYoutubeSlot(i)}
                                            style={{ padding: '4px 8px', borderRadius: 4, border: 'none', background: '#374151', color: '#fff', cursor: 'pointer', fontSize: 12 }}>✕</button>
                                    </div>
                                ))}
                                <button onClick={addYoutubeSlot}
                                    style={{ fontSize: 12, color: '#818cf8', background: 'transparent', border: '1px solid #4f46e5', borderRadius: 4, padding: '3px 10px', cursor: 'pointer' }}>+ Add</button>
                            </div>
                        )}
                        {scheduleEnabled && platforms.facebook && (
                            <div style={{ marginTop: 8 }}>
                                <p style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 6px' }}>Facebook Slots</p>
                                {facebookSlots.map((slot, i) => (
                                    <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 5 }}>
                                        <input type="time" value={slot.time}
                                            onChange={e => updateFacebookSlot(i, 'time', e.target.value)}
                                            style={{ flex: 1, ...sideInput, width: 'auto' }} />
                                        <input type="number" min={1} value={slot.count}
                                            onChange={e => updateFacebookSlot(i, 'count', parseInt(e.target.value) || 1)}
                                            style={{ ...sideInput, width: 50 }} />
                                        <button onClick={() => removeFacebookSlot(i)}
                                            style={{ padding: '4px 8px', borderRadius: 4, border: 'none', background: '#374151', color: '#fff', cursor: 'pointer', fontSize: 12 }}>×</button>
                                    </div>
                                ))}
                                <button onClick={addFacebookSlot}
                                    style={{ fontSize: 12, color: '#818cf8', background: 'transparent', border: '1px solid #4f46e5', borderRadius: 4, padding: '3px 10px', cursor: 'pointer' }}>+ Add</button>
                            </div>
                        )}
                        {scheduleEnabled && platforms.instagram && (
                            <div style={{ marginTop: 8 }}>
                                <p style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 6px' }}>Instagram Slots</p>
                                {instagramSlots.map((slot, i) => (
                                    <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 5 }}>
                                        <input type="time" value={slot.time}
                                            onChange={e => updateInstagramSlot(i, 'time', e.target.value)}
                                            style={{ flex: 1, ...sideInput, width: 'auto' }} />
                                        <input type="number" min={1} value={slot.count}
                                            onChange={e => updateInstagramSlot(i, 'count', parseInt(e.target.value) || 1)}
                                            style={{ ...sideInput, width: 50 }} />
                                        <button onClick={() => removeInstagramSlot(i)}
                                            style={{ padding: '4px 8px', borderRadius: 4, border: 'none', background: '#374151', color: '#fff', cursor: 'pointer', fontSize: 12 }}>×</button>
                                    </div>
                                ))}
                                <button onClick={addInstagramSlot}
                                    style={{ fontSize: 12, color: '#818cf8', background: 'transparent', border: '1px solid #4f46e5', borderRadius: 4, padding: '3px 10px', cursor: 'pointer' }}>+ Add</button>
                            </div>
                        )}
                    </div>

                </div>

                {/* RIGHT: Upload Queue Grid */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                    <UploadQueuePreview
                        queue={uploadQueue}
                        logEntries={logEntries}
                        uploadStatus={uploadStatus}
                    />
                </div>
            </div>

            {/* BOTTOM: CLI Preview pinned */}
            <div style={{
                borderTop: '1px solid var(--border)', padding: '10px 24px',
                background: 'rgba(0,0,0,0.25)', flexShrink: 0,
            }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>CLI Preview</span>
                <pre style={{
                    margin: '4px 0 0', fontSize: 12, color: '#94a3b8',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                    maxHeight: 80, overflowY: 'auto',
                }}>
                    {uploadStatus.commandPreview || cliPreview}
                </pre>
            </div>

        </section>
    );
}

export default Upload;
