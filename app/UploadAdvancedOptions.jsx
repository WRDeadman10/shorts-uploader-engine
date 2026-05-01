import React from 'react';
import ToggleSwitch from './ToggleSwitch.jsx';

const row = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 0',
};

const label = {
    fontSize: 14,
    color: '#cbd5e1',
    flexShrink: 0,
};

const input = {
    padding: '4px 8px',
    borderRadius: 4,
    border: '1px solid #444',
    background: '#1a1a2e',
    color: '#fff',
    fontSize: 13,
    width: 190,
};

const inputNarrow = { ...input, width: 90 };

const section = {
    marginTop: 14,
    borderTop: '1px solid #333',
    paddingTop: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
};

const sectionLabel = {
    fontSize: 12,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
};

const UploadAdvancedOptions = ({ options, setUploadOption }) => {
    return (
        <React.Fragment>

            {/* Binary Paths */}
            <div style={section}>
                <span style={sectionLabel}>Binary Paths</span>
                <div style={row}>
                    <span style={label}>FFmpeg</span>
                    <input style={input} type="text" placeholder="ffmpeg path" value={options.ffmpegBin || ''}
                        onChange={(e) => setUploadOption('ffmpegBin', e.target.value)} />
                </div>
                <div style={row}>
                    <span style={label}>FFprobe</span>
                    <input style={input} type="text" placeholder="ffprobe path" value={options.ffprobeBin || ''}
                        onChange={(e) => setUploadOption('ffprobeBin', e.target.value)} />
                </div>
                <div style={row}>
                    <span style={label}>Exclude Files</span>
                    <input style={input} type="text" placeholder="file1.mp4,file2.mp4" value={options.excludeFiles || ''}
                        onChange={(e) => setUploadOption('excludeFiles', e.target.value)} />
                </div>
            </div>

            {/* Meta Credentials */}
            <div style={section}>
                <span style={sectionLabel}>Meta Credentials</span>
                <div style={row}>
                    <span style={label}>Access Token</span>
                    <input style={input} type="text" placeholder="EAA..." value={options.metaAccessToken || ''}
                        onChange={(e) => setUploadOption('metaAccessToken', e.target.value)} />
                </div>
                <div style={row}>
                    <span style={label}>IG User ID</span>
                    <input style={input} type="text" placeholder="Instagram user ID" value={options.igUserId || ''}
                        onChange={(e) => setUploadOption('igUserId', e.target.value)} />
                </div>
                <div style={row}>
                    <span style={label}>FB Page ID</span>
                    <input style={input} type="text" placeholder="Facebook page ID" value={options.fbPageId || ''}
                        onChange={(e) => setUploadOption('fbPageId', e.target.value)} />
                </div>
            </div>

            {/* AI Metadata */}
            <div style={section}>
                <span style={sectionLabel}>AI Metadata</span>
                <div style={row}>
                    <span style={label}>OpenAI Model</span>
                    <input style={input} type="text" placeholder="gpt-4.1-mini" value={options.openaiModel || ''}
                        onChange={(e) => setUploadOption('openaiModel', e.target.value)} />
                </div>
                <div style={row}>
                    <span style={label}>Channel Name</span>
                    <input style={input} type="text" placeholder="Your channel" value={options.channelName || ''}
                        onChange={(e) => setUploadOption('channelName', e.target.value)} />
                </div>
                <div style={row}>
                    <span style={label}>Extra Keywords</span>
                    <input style={input} type="text" placeholder="valorant,fps" value={options.extraKeywords || ''}
                        onChange={(e) => setUploadOption('extraKeywords', e.target.value)} />
                </div>
                <div style={row}>
                    <span style={label}>Language</span>
                    <input style={inputNarrow} type="text" placeholder="en" value={options.language || ''}
                        onChange={(e) => setUploadOption('language', e.target.value)} />
                </div>
                <div style={row}>
                    <span style={label}>Category ID</span>
                    <input style={inputNarrow} type="text" placeholder="20" value={options.categoryId || ''}
                        onChange={(e) => setUploadOption('categoryId', e.target.value)} />
                </div>
            </div>

            {/* Music */}
            <div style={section}>
                <span style={sectionLabel}>Music</span>
                <div style={row}>
                    <ToggleSwitch
                        label="Use Trending Audio"
                        checked={!!options.useTrendingAudio}
                        onChange={(v) => setUploadOption('useTrendingAudio', v)}
                    />
                </div>
                {options.useTrendingAudio ? (
                    <>
                        <div style={row}>
                            <span style={label}>Report JSON</span>
                            <input style={input} type="text" placeholder="trending_audio_report.json"
                                value={options.trendingAudioReportPath || ''}
                                onChange={(e) => setUploadOption('trendingAudioReportPath', e.target.value)} />
                        </div>
                        <div style={row}>
                            <span style={label}>Cache Dir</span>
                            <input style={input} type="text" placeholder=".trending_music_cache"
                                value={options.trendingAudioCacheDir || ''}
                                onChange={(e) => setUploadOption('trendingAudioCacheDir', e.target.value)} />
                        </div>
                        <div style={row}>
                            <span style={label}>Max Tracks</span>
                            <input style={inputNarrow} type="number" min={1} max={20}
                                value={options.trendingAudioMaxTracks || 5}
                                onChange={(e) => setUploadOption('trendingAudioMaxTracks', parseInt(e.target.value) || 5)} />
                        </div>
                    </>
                ) : (
                    <>
                        <div style={row}>
                            <span style={label}>Music Dir</span>
                            <input style={input} type="text" placeholder="path/to/music" value={options.musicDir || ''}
                                onChange={(e) => setUploadOption('musicDir', e.target.value)} />
                        </div>
                        <div style={row}>
                            <span style={label}>Inventory File</span>
                            <input style={input} type="text" placeholder="music_inventory.json" value={options.musicInventory || ''}
                                onChange={(e) => setUploadOption('musicInventory', e.target.value)} />
                        </div>
                    </>
                )}
                {!options.useTrendingAudio && (
                    <div style={row}>
                        <span style={label}>BG Volume</span>
                        <input style={inputNarrow} type="number" min={0} max={1} step={0.05}
                            value={options.musicVolume !== undefined ? options.musicVolume : 0.3}
                            onChange={(e) => setUploadOption('musicVolume', parseFloat(e.target.value))} />
                    </div>
                )}
            </div>

            {/* Meta Advanced */}
            <div style={section}>
                <span style={sectionLabel}>Meta Advanced</span>
                <div style={row}>
                    <span style={label}>Graph Version</span>
                    <input style={inputNarrow} type="text" placeholder="v19.0" value={options.metaGraphVersion || ''}
                        onChange={(e) => setUploadOption('metaGraphVersion', e.target.value)} />
                </div>
                <div style={row}>
                    <span style={label}>Poll Attempts</span>
                    <input style={inputNarrow} type="number" value={options.metaPollAttempts !== undefined ? options.metaPollAttempts : 5}
                        onChange={(e) => setUploadOption('metaPollAttempts', parseInt(e.target.value))} />
                </div>
                <div style={row}>
                    <span style={label}>Poll Interval (ms)</span>
                    <input style={inputNarrow} type="number" value={options.metaPollInterval !== undefined ? options.metaPollInterval : 1000}
                        onChange={(e) => setUploadOption('metaPollInterval', parseInt(e.target.value))} />
                </div>
                <div style={row}>
                    <span style={label}>Request Timeout (ms)</span>
                    <input style={inputNarrow} type="number" value={options.metaRequestTimeout !== undefined ? options.metaRequestTimeout : 30000}
                        onChange={(e) => setUploadOption('metaRequestTimeout', parseInt(e.target.value))} />
                </div>
                <div style={{ ...row, marginTop: 6 }}>
                    <ToggleSwitch label="Skip Uploaded"
                        checked={options.metaSkipUploaded !== false}
                        onChange={(checked) => setUploadOption('metaSkipUploaded', checked)} />
                </div>
                <div style={row}>
                    <ToggleSwitch label="Delete Converted After Upload"
                        checked={options.metaDeleteConverted !== false}
                        onChange={(checked) => setUploadOption('metaDeleteConverted', checked)} />
                </div>
            </div>

        </React.Fragment>
    );
};

export default UploadAdvancedOptions;
