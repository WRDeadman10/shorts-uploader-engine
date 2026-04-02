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
