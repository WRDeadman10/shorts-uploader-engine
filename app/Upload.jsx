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
    { id: "includeMetadata", label: "Metadata Pack" }
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
        const selectedPlatforms = Object.keys(platforms).filter(function filterPlatform(key)
        {
            return platforms[key];
        });
        const args = [];

        if (selectedPlatforms.length > 0)
        {
            args.push("--platforms=" + selectedPlatforms.join(","));
        }

        if (options.includeShorts)
        {
            args.push("--shorts");
        }

        if (options.includeMusic)
        {
            args.push("--music");
        }

        if (options.includeMetadata)
        {
            args.push("--metadata");
        }

        return "uploader-cli run " + args.join(" ");
    }, [options, platforms]);

    function handlePlatformToggle(platformId, nextValue)
    {
        setUploadPlatform(platformId, nextValue);
    }

    function handleOptionToggle(optionId, nextValue)
    {
        setUploadOption(optionId, nextValue);
    }

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
                    Run Mock Upload
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
                                        handlePlatformToggle(platform.id, nextValue);
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
                                        handleOptionToggle(option.id, nextValue);
                                    }}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="upload-panel">
                <h2 className="upload-panel-title">CLI Preview</h2>
                <pre className="upload-cli-preview">{cliPreview}</pre>
            </div>
        </section>
    );
}

export default Upload;
