import { create } from "zustand";

export const pageOrder = [
    { id: "dashboard", label: "Dashboard" },
    { id: "library", label: "Library" },
    { id: "upload", label: "Upload" },
    { id: "console", label: "Console" },
    { id: "audit", label: "Audit" },
    { id: "metadata", label: "Metadata" }
];

function createInitialUploadStatus()
{
    return {
        success: true,
        uploadId: "",
        status: "idle",
        platform: "",
        progress: 0,
        pid: 0,
        errorMessage: "",
        commandPreview: "",
        startedAt: "",
        completedAt: ""
    };
}

function buildMetadataFromVideo(video)
{
    if (!video)
    {
        return {
            title: "",
            description: "",
            musicTrack: "No Track"
        };
    }

    return {
        title: video.title || "",
        description: video.description || "",
        musicTrack: video.musicTrack || "No Track"
    };
}

export const useAppStore = create(function createAppStore(set, get)
{
    return {
        activePage: "dashboard",
        videoFilter: "ALL",
        selectedVideoId: "",
        videoList: [],
        loadingVideos: false,
        uploadStatus: createInitialUploadStatus(),
        logEntries: [],
        errorMessage: "",
        metadataDirty: false,
        metadata: {
            title: "",
            description: "",
            musicTrack: "No Track"
        },
        musicOptions: [
            "No Track",
            "Cinematic Pulse",
            "Night Run",
            "Arcade Surge",
            "Victory Loop"
        ],
        advancedUploadSettings: {},
        featureStatus: "", // Added feature status field
        loadAdvancedUploadSettings: function loadAdvancedUploadSettings(settings)
        {
            set({
                advancedUploadSettings: settings
            });
        },
        saveAdvancedUploadSettings: async function saveAdvancedUploadSettings()
        {
            if (!window.api || !window.api.saveWorkflowSettings)
            {
                return;
            }

            const response = await window.api.saveWorkflowSettings(get().advancedUploadSettings);

            if (response)
            {
                set({
                    errorMessage: response.errorMessage || ""
                });
            }
        },
        setActivePage: function setActivePage(pageId)
        {
            set({
                activePage: pageId
            });
        },
        setVideoFilter: function setVideoFilter(filter)
        {
            set({
                videoFilter: filter
            });
        },
        setErrorMessage: function setErrorMessage(message)
        {
            set({
                errorMessage: message || ""
            });
        },
        getFilteredVideos: function getFilteredVideos()
        {
            const state = get();

            if (state.videoFilter === "ALL")
            {
                return state.videoList;
            }

            return state.videoList.filter(function filterVideo(video)
            {
                if (state.videoFilter === "YT")
                {
                    return video.yt;
                }

                if (state.videoFilter === "IG")
                {
                    return video.ig;
                }

                if (state.videoFilter === "FB")
                {
                    return video.fb;
                }

                return true;
            });
        },
        getAuditRows: function getAuditRows()
        {
            return get().videoList.map(function mapAuditRow(video)
            {
                return {
                    id: video.id,
                    video: video.title,
                    yt: video.yt,
                    ig: video.ig,
                    fb: video.fb,
                    status: video.status
                };
            });
        },
        selectVideo: function selectVideo(videoId)
        {
            const targetVideo = get().videoList.find(function findVideo(video)
            {
                return video.id === videoId;
            });

            set({
                selectedVideoId: videoId,
                metadata: buildMetadataFromVideo(targetVideo),
                metadataDirty: false
            });
        },
        setMetadataField: function setMetadataField(field, value)
        {
            set(function updateMetadataField(state)
            {
                return {
                    metadata: {
                        ...state.metadata,
                        [field]: value
                    },
                    metadataDirty: true
                };
            });
        },
        appendLogEntry: function appendLogEntry(entry)
        {
            if (!entry || typeof entry !== "object")
            {
                return;
            }

            set(function appendLogLine(state)
            {
                const entryId = entry && entry.id ? entry.id : "";

                if (entryId && state.logEntries.some(function hasEntry(logEntry)
                {
                    return logEntry.id === entryId;
                }))
                {
                    return {};
                }

                return {
                    logEntries: state.logEntries.concat(entry)
                };
            });
        },
        clearLogs: function clearLogs()
        {
            set({
                logEntries: []
            });
        },
        syncUploadStatus: async function syncUploadStatus()
        {
            if (!window.api || !window.api.getUploadStatus)
            {
                return;
            }

            const response = await window.api.getUploadStatus();

            if (response)
            {
                set({
                    uploadStatus: response,
                    errorMessage: response.errorMessage || ""
                });
            }
        },
        fetchVideoList: async function fetchVideoList()
        {
            if (!window.api || !window.api.getVideoList)
            {
                return;
            }

            set({
                loadingVideos: true
            });

            const response = await window.api.getVideoList();
            const videos = Array.isArray(response) ? response : [];
            const currentSelectedVideoId = get().selectedVideoId;
            const matchingVideo = videos.find(function findSelectedVideo(video)
            {
                return video.id === currentSelectedVideoId;
            });
            const nextSelectedVideo = matchingVideo || videos[0] || null;

            set(function updateVideoList(state)
            {
                return {
                    videoList: videos,
                    selectedVideoId: nextSelectedVideo ? nextSelectedVideo.id : "",
                    metadata: state.metadataDirty ? state.metadata : buildMetadataFromVideo(nextSelectedVideo),
                    loadingVideos: false
                };
            });
        },
        streamLogs: async function streamLogs()
        {
            if (!window.api || !window.api.streamLog)
            {
                return null;
            }

            return window.api.streamLog();
        },
        initializeApp: async function initializeApp()
        {
            await Promise.all([
                get().syncUploadStatus(),
                get().fetchVideoList(),
                get().streamLogs()
            ]);
        },
        uploadPlatforms: {
            youtube: true,
            instagram: false,
            facebook: false
        },
        uploadOptions: {
            includeShorts: true,
            includeMusic: true,
            includeMetadata: true
        },
        setUploadPlatform: function setUploadPlatform(platformId, value)
        {
            set(function updateUploadPlatform(state)
            {
                return {
                    uploadPlatforms: {
                        ...state.uploadPlatforms,
                        [platformId]: value
                    }
                };
            });
        },
        setUploadOption: function setUploadOption(optionId, value)
        {
            set(function updateUploadOption(state)
            {
                return {
                    uploadOptions: {
                        ...state.uploadOptions,
                        [optionId]: value
                    }
                };
            });
        },
        startConsole: async function startConsole()
        {
            const state = get();

            if (!window.api || !window.api.runUpload)
            {
                return null;
            }

            const response = await window.api.runUpload({
                platforms: state.uploadPlatforms,
                options: state.uploadOptions,
                metadata: state.metadata
            });

            if (response)
            {
                set({
                    uploadStatus: response,
                    errorMessage: response.errorMessage || ""
                });
            }

            return response;
        },
        runUpload: async function runUpload()
        {
            return get().startConsole();
        },
        stopUpload: async function stopUpload()
        {
            if (!window.api || !window.api.stopUpload)
            {
                return null;
            }

            const response = await window.api.stopUpload();

            if (response)
            {
                set({
                    uploadStatus: response,
                    errorMessage: response.errorMessage || ""
                });
            }

            return response;
        },
        stopConsole: async function stopConsole()
        {
            return get().stopUpload();
        }
    };
});
