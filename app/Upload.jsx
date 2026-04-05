import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import ToggleSwitch from "./ToggleSwitch.jsx";
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

    const cliPreview = useMemo(function buildCliPreview()
    {
        if (!platforms.youtube && !platforms.instagram && !platforms.facebook)
        {
            return "Select at least one platform to build a runnable command.";
        }

        if (!platforms.youtube)
        {
            const metaPlatform = platforms.instagram && platforms.facebook ? "both" : platforms.instagram ? "instagram" : "facebook";

            return "python metaBatchReelsUpload.py --platform " + metaPlatform + " --max-videos 1";
        }

        const args = [
            "python youtubeBatchUpload.py",
            "--upload-platform youtube",
            "--max-videos 1",
            "--allow-fallback"
        ];

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
                        </div>
                    </div>
                </div>
            </div>

            <div className="upload-panel">
                <h2 className="upload-panel-title">CLI Preview</h2>
                <pre className="upload-cli-preview">{uploadStatus.commandPreview || cliPreview}</pre>
            </div>
        </section>
    );
}

export default Upload;
