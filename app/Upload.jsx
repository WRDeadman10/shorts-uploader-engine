import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import ToggleSwitch from "./ToggleSwitch.jsx";
import UploadAdvancedOptions from './UploadAdvancedOptions.jsx';
import { useAppStore } from "./useAppStore.js";

const platformOptions = [
    { id: "youtube", label: "YouTube Shorts" },
    { id: "instagram", label: "Instagram Reels" },
    { id: "facebook", label: "Facebook Reels" }
];

const uploadOptions = [
    { id: "includeShorts", label: "Shorts Format" },
    { id: "includeMusic", label: "Music Overlay" },
    { id: "includeMetadata", label: "AI Metadata" }
];

function Upload()
{
    const platforms = useAppStore(function selectPlatforms(state)
    {
        return state.uploadPlatforms;
    });
    const options = useAppStore(function selectOptions(state)
    {
        return state.uploadOptions;
    });
    const uploadStatus = useAppStore(function selectUploadStatus(state)
    {
        return state.uploadStatus;
    });
    const setUploadPlatform = useAppStore(function selectSetUploadPlatform(state)
    {
        return state.setUploadPlatform;
    });
    const setUploadOption = useAppStore(function selectSetUploadOption(state)
    {
        return state.setUploadOption;
    });
    const runUpload = useAppStore(function selectRunUpload(state)
    {
        return state.runUpload;
    });
    const syncUploadStatus = useAppStore(function selectSyncUploadStatus(state)
    {
        return state.syncUploadStatus;
    });

    useEffect(function syncStatus()
    {
        syncUploadStatus();
    }, [syncUploadStatus]);

    const scheduleEnabled = useAppStore(function(s){return s.scheduleEnabled;});
    const scheduleDate = useAppStore(function(s){return s.scheduleDate;});
    const youtubeSlots = useAppStore(function(s){return s.youtubeSlots;});
    const facebookSlots = useAppStore(function(s){return s.facebookSlots;});
    const instagramDraft = useAppStore(function(s){return s.instagramDraft;});
    const setScheduleEnabled = useAppStore(function(s){return s.setScheduleEnabled;});
    const setScheduleDate = useAppStore(function(s){return s.setScheduleDate;});
    const setInstagramDraft = useAppStore(function(s){return s.setInstagramDraft;});
    const addYoutubeSlot = useAppStore(function(s){return s.addYoutubeSlot;});
    const removeYoutubeSlot = useAppStore(function(s){return s.removeYoutubeSlot;});
    const updateYoutubeSlot = useAppStore(function(s){return s.updateYoutubeSlot;});
    const addFacebookSlot = useAppStore(function(s){return s.addFacebookSlot;});
    const removeFacebookSlot = useAppStore(function(s){return s.removeFacebookSlot;});
    const updateFacebookSlot = useAppStore(function(s){return s.updateFacebookSlot;});

    const cliPreview = useMemo(function buildCliPreview()
    {
        if (!platforms.youtube && !platforms.instagram && !platforms.facebook)
        {
            return "Select at least one platform to build a runnable command.";
        }

        if (!platforms.youtube)
        {
            const metaPlatform = platforms.instagram && platforms.facebook ? "both" : platforms.instagram ? "instagram" : "facebook";
            let cmd = 'python metaBatchReelsUpload.py --platform ' + metaPlatform + ' --max-videos ' + String(options.maxVideos || 1);
            if (options.videosRoot) cmd += ' --root ' + options.videosRoot;
            if (options.ffmpegBin) cmd += ' --ffmpeg-bin ' + options.ffmpegBin;
            if (options.ffprobeBin) cmd += ' --ffprobe-bin ' + options.ffprobeBin;
            if (options.dryRun) cmd += ' --dry-run';
            return cmd;
        }

        const args = [
            "python youtubeBatchUpload.py",
            "--upload-platform youtube",
            "--max-videos " + String(options.maxVideos || 1),
            "--allow-fallback"
        ];
        if (options.videosRoot) args.push("--root " + options.videosRoot);
        if (options.privacy) args.push("--privacy " + options.privacy);
        if (options.playlistName) args.push("--playlist-name " + options.playlistName);
        if (options.ffmpegBin) args.push("--ffmpeg-bin " + options.ffmpegBin);
        if (options.ffprobeBin) args.push("--ffprobe-bin " + options.ffprobeBin);
        if (options.dryRun) args.push("--dry-run");

        args.push(options.includeShorts ? "--shorts-policy convert" : "--shorts-policy off");

        if (!options.includeMetadata)
        {
            args.push("--no-ai");
        }

        if (!options.includeMusic)
        {
            args.push("--music-dir=");
        }

        if (platforms.instagram || platforms.facebook)
        {
            const metaPlatform = platforms.instagram && platforms.facebook ? "both" : platforms.instagram ? "instagram" : "facebook";

            args.push("--crosspost-meta");
            args.push("--meta-platform " + metaPlatform);
        }

        return args.join(" ");
    }, [options, platforms]);

    async function handleRunPreview()
    {
        await runUpload();
    }

    return (
        <section className="upload-page page-panel">
            <div className="upload-section">
                <div className="page-heading">
                    <span className="page-eyebrow">Upload Control</span>
                    <h1 className="page-title">Pipeline Builder</h1>
                    <p className="page-placeholder">Current status: {uploadStatus.status}</p>
                </div>
                <motion.button
                    type="button"
                    className="upload-action-button"
                    onClick={handleRunPreview}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.97 }}
                >
                    Run Upload
                </motion.button>
            </div>

            <div className="upload-grid">
                <div className="upload-panel">
                    <h2 className="upload-panel-title">Platforms</h2>
                    <div className="upload-toggle-list">
                        {platformOptions.map(function mapPlatform(platform)
                        {
                            return (
                                <ToggleSwitch
                                    key={platform.id}
                                    label={platform.label}
                                    checked={platforms[platform.id]}
                                    onChange={function handleToggle(nextValue)
                                    {
                                        setUploadPlatform(platform.id, nextValue);
                                    }}
                                />
                            );
                        })}
                    </div>
                </div>

                <div className="upload-panel">
                    <h2 className="upload-panel-title">Options</h2>
                    <div className="upload-toggle-list">
                        {uploadOptions.map(function mapOption(option)
                        {
                            return (
                                <ToggleSwitch
                                    key={option.id}
                                    label={option.label}
                                    checked={options[option.id]}
                                    onChange={function handleToggle(nextValue)
                                    {
                                        setUploadOption(option.id, nextValue);
                                    }}
                                />
                            );
                        })}

                        <div style={{marginTop: 12, display: "flex", flexDirection: "column", gap: 8}}>
                            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0"}}>
                                <span style={{fontSize:14}}>Max Videos</span>
                                <input type="number" min={1} max={50} value={options.maxVideos || 1}
                                    onChange={function handleMaxVid(e) { setUploadOption("maxVideos", Math.max(1, parseInt(e.target.value, 10) || 1)); }}
                                    style={{width:70,padding:"4px 8px",borderRadius:4,border:"1px solid #444",background:"#1a1a2e",color:"#fff",fontSize:14}} />
                            </div>
                            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0"}}>
                                <span style={{fontSize:14}}>Videos Root</span>
                                <input type="text" placeholder="Path to video folder" value={options.videosRoot || ""}
                                    onChange={function handleRoot(e) { setUploadOption("videosRoot", e.target.value); }}
                                    style={{width:180,padding:"4px 8px",borderRadius:4,border:"1px solid #444",background:"#1a1a2e",color:"#fff",fontSize:13}} />
                            </div>
                            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0"}}>
                                <span style={{fontSize:14}}>Privacy</span>
                                <select value={options.privacy || ""}
                                    onChange={function handlePrivacy(e) { setUploadOption("privacy", e.target.value); }}
                                    style={{width:130,padding:"4px 8px",borderRadius:4,border:"1px solid #444",background:"#1a1a2e",color:"#fff",fontSize:13}}>
                                    <option value="">Default</option>
                                    <option value="private">Private</option>
                                    <option value="unlisted">Unlisted</option>
                                    <option value="public">Public</option>
                                </select>
                            </div>
                            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0"}}>
                                <span style={{fontSize:14}}>Playlist Name</span>
                                <input type="text" placeholder="Optional" value={options.playlistName || ""}
                                    onChange={function handlePlaylist(e) { setUploadOption("playlistName", e.target.value); }}
                                    style={{width:160,padding:"4px 8px",borderRadius:4,border:"1px solid #444",background:"#1a1a2e",color:"#fff",fontSize:13}} />
                            </div>
                            <ToggleSwitch label="Dry Run" checked={options.dryRun || false}
                                onChange={function handleDryRun(v) { setUploadOption("dryRun", v); }} />
                            {/* Discovery Filters */}
                            <div style={{marginTop:16,borderTop:"1px solid #333",paddingTop:12}}>
                                <span style={{fontSize:12,color:"#888",textTransform:"uppercase",letterSpacing:1}}>Discovery Filters</span>
                                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0"}}>
                                    <span style={{fontSize:14}}>Extensions</span>
                                    <input type="text" placeholder=".mp4,.mov" value={options.extensions || ""} onChange={function(e){setUploadOption("extensions",e.target.value);}} style={{width:140,padding:"4px 8px",borderRadius:4,border:"1px solid #444",background:"#1a1a2e",color:"#fff",fontSize:13}} />
                                </div>
                                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0"}}>
                                    <span style={{fontSize:14}}>Exclude Dirs</span>
                                    <input type="text" placeholder="drafts,archive" value={options.excludeDirectories || ""} onChange={function(e){setUploadOption("excludeDirectories",e.target.value);}} style={{width:140,padding:"4px 8px",borderRadius:4,border:"1px solid #444",background:"#1a1a2e",color:"#fff",fontSize:13}} />
                                </div>
                            </div>
                            {/* Queue Filters */}
                            <div style={{marginTop:12,borderTop:"1px solid #333",paddingTop:12}}>
                                <span style={{fontSize:12,color:"#888",textTransform:"uppercase",letterSpacing:1}}>Queue Filters</span>
                                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0"}}>
                                    <span style={{fontSize:14}}>Require Uploaded On</span>
                                    <input type="text" placeholder="youtube" value={options.requireUploadedOn || ""} onChange={function(e){setUploadOption("requireUploadedOn",e.target.value);}} style={{width:120,padding:"4px 8px",borderRadius:4,border:"1px solid #444",background:"#1a1a2e",color:"#fff",fontSize:13}} />
                                </div>
                                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0"}}>
                                    <span style={{fontSize:14}}>Require Missing On</span>
                                    <input type="text" placeholder="instagram" value={options.requireMissingOn || ""} onChange={function(e){setUploadOption("requireMissingOn",e.target.value);}} style={{width:120,padding:"4px 8px",borderRadius:4,border:"1px solid #444",background:"#1a1a2e",color:"#fff",fontSize:13}} />
                                </div>
                            </div>
                            {/* Credentials */}
                            <div style={{marginTop:12,borderTop:"1px solid #333",paddingTop:12}}>
                                <span style={{fontSize:12,color:"#888",textTransform:"uppercase",letterSpacing:1}}>Credentials</span>
                                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0"}}>
                                    <span style={{fontSize:14}}>Client Secrets</span>
                                    <input type="text" placeholder="path/to/client_secret.json" value={options.clientSecretsPath || ""} onChange={function(e){setUploadOption("clientSecretsPath",e.target.value);}} style={{width:180,padding:"4px 8px",borderRadius:4,border:"1px solid #444",background:"#1a1a2e",color:"#fff",fontSize:13}} />
                                </div>
                                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0"}}>
                                    <span style={{fontSize:14}}>Token File</span>
                                    <input type="text" placeholder="path/to/token.json" value={options.tokenFilePath || ""} onChange={function(e){setUploadOption("tokenFilePath",e.target.value);}} style={{width:180,padding:"4px 8px",borderRadius:4,border:"1px solid #444",background:"#1a1a2e",color:"#fff",fontSize:13}} />
                                </div>
                            <UploadAdvancedOptions options={options} setUploadOption={setUploadOption} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="upload-panel">
                <h2 className="upload-panel-title">CLI Preview</h2>
                <pre className="upload-cli-preview">{uploadStatus.commandPreview || cliPreview}</pre>
            </div>

            <div className="upload-panel">
                <h2 className="upload-panel-title">Scheduled Publishing</h2>
                <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:12}}>
                    <ToggleSwitch label="Enable Schedule" checked={scheduleEnabled} onChange={setScheduleEnabled} />
                    {scheduleEnabled && (
                        <input type="date" value={scheduleDate} onChange={function(e){setScheduleDate(e.target.value);}}
                            style={{padding:'4px 8px',borderRadius:4,border:'1px solid #444',background:'#1a1a2e',color:'#fff',fontSize:13}} />
                    )}
                </div>
                {scheduleEnabled && (
                    <div style={{display:'flex',gap:24,flexWrap:'wrap'}}>
                        <div style={{flex:1,minWidth:180}}>
                            <p style={{fontSize:12,color:'#888',textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>YouTube Slots</p>
                            {youtubeSlots.map(function(slot,i){return (
                                <div key={i} style={{display:'flex',gap:8,alignItems:'center',marginBottom:6}}>
                                    <input type="time" value={slot.time} onChange={function(e){updateYoutubeSlot(i,'time',e.target.value);}}
                                        style={{padding:'4px 6px',borderRadius:4,border:'1px solid #444',background:'#1a1a2e',color:'#fff',fontSize:13}} />
                                    <input type="number" min={1} value={slot.count} onChange={function(e){updateYoutubeSlot(i,'count',parseInt(e.target.value)||1);}}
                                        style={{width:56,padding:'4px 6px',borderRadius:4,border:'1px solid #444',background:'#1a1a2e',color:'#fff',fontSize:13}} />
                                    <span style={{fontSize:12,color:'#6b7280'}}>videos</span>
                                    <button type="button" onClick={function(){removeYoutubeSlot(i);}}
                                        style={{padding:'2px 8px',borderRadius:4,border:'none',background:'#374151',color:'#fff',cursor:'pointer',fontSize:12}}>X</button>
                                </div>
                            );})}
                            <button type="button" onClick={addYoutubeSlot}
                                style={{padding:'4px 12px',borderRadius:4,border:'1px solid #4f46e5',background:'transparent',color:'#818cf8',cursor:'pointer',fontSize:12,marginTop:4}}>+ Add Slot</button>
                        </div>
                        <div style={{flex:1,minWidth:180}}>
                            <p style={{fontSize:12,color:'#888',textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>Facebook Slots</p>
                            {facebookSlots.map(function(slot,i){return (
                                <div key={i} style={{display:'flex',gap:8,alignItems:'center',marginBottom:6}}>
                                    <input type="time" value={slot.time} onChange={function(e){updateFacebookSlot(i,'time',e.target.value);}}
                                        style={{padding:'4px 6px',borderRadius:4,border:'1px solid #444',background:'#1a1a2e',color:'#fff',fontSize:13}} />
                                    <input type="number" min={1} value={slot.count} onChange={function(e){updateFacebookSlot(i,'count',parseInt(e.target.value)||1);}}
                                        style={{width:56,padding:'4px 6px',borderRadius:4,border:'1px solid #444',background:'#1a1a2e',color:'#fff',fontSize:13}} />
                                    <span style={{fontSize:12,color:'#6b7280'}}>videos</span>
                                    <button type="button" onClick={function(){removeFacebookSlot(i);}}
                                        style={{padding:'2px 8px',borderRadius:4,border:'none',background:'#374151',color:'#fff',cursor:'pointer',fontSize:12}}>X</button>
                                </div>
                            );})}
                            <button type="button" onClick={addFacebookSlot}
                                style={{padding:'4px 12px',borderRadius:4,border:'1px solid #4f46e5',background:'transparent',color:'#818cf8',cursor:'pointer',fontSize:12,marginTop:4}}>+ Add Slot</button>
                        </div>
                    </div>
                )}
                {!scheduleEnabled && (
                    <div style={{display:'flex',alignItems:'center',gap:12,marginTop:4}}>
                        <ToggleSwitch label="Instagram: Upload as Draft" checked={instagramDraft} onChange={setInstagramDraft} />
                    </div>
                )}
            </div>
        </section>
    );
}

export default Upload;
