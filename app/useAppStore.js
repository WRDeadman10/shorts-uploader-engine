import { create } from "zustand";

export const pageOrder = [
    { id: "dashboard", label: "Dashboard" },
    { id: "library", label: "Library" },
    { id: "upload", label: "Upload" },
    { id: "console", label: "Console" },
    { id: "audit", label: "Audit" },
    { id: "metadata", label: "Metadata" }
];

const defaultVideoList = [
    {
        id: "video-001",
        title: "Jett Entry Sequence",
        duration: "00:27",
        thumbnail: "Gradient Preview",
        statusText: "Ready for scheduling",
        statuses: ["YT", "IG"]
    },
    {
        id: "video-002",
        title: "Clutch Defuse Breakdown",
        duration: "00:31",
        thumbnail: "Velocity Frame",
        statusText: "Awaiting Instagram export",
        statuses: ["YT", "FB"]
    },
    {
        id: "video-003",
        title: "Operator Flick Showcase",
        duration: "00:24",
        thumbnail: "Arena Snapshot",
        statusText: "Distribution pack prepared",
        statuses: ["IG", "FB"]
    },
    {
        id: "video-004",
        title: "Team Ace Highlights",
        duration: "00:38",
        thumbnail: "Studio Render",
        statusText: "Publishing across all channels",
        statuses: ["YT", "IG", "FB"]
    }
];

const defaultAuditRows = [
    {
        id: "row-001",
        video: "Jett Entry Sequence",
        yt: true,
        ig: true,
        fb: false,
        status: "partial"
    },
    {
        id: "row-002",
        video: "Clutch Defuse Breakdown",
        yt: true,
        ig: false,
        fb: false,
        status: "missing"
    },
    {
        id: "row-003",
        video: "Operator Flick Showcase",
        yt: true,
        ig: true,
        fb: true,
        status: "complete"
    },
    {
        id: "row-004",
        video: "Team Ace Highlights",
        yt: false,
        ig: true,
        fb: true,
        status: "partial"
    }
];

const defaultLogLines = [
    "[system] renderer console attached",
    "[upload] waiting for command",
    "[audit] no blocking issues detected"
];

export const useAppStore = create(function createAppStore(set, get)
{
    return {
        activePage: "dashboard",
        videoFilter: "ALL",
        uploadStatus: {
            uploadId: "mock-upload-001",
            status: "idle",
            progress: 0,
            platform: "youtube"
        },
        logLines: defaultLogLines,
        isConsoleRunning: false,
        consoleTimerId: null,
        dashboardStats: [
            { id: "queued", label: "Queued Uploads", value: "18", detail: "+4 since this morning" },
            { id: "processed", label: "Processed Today", value: "42", detail: "6 platforms synced" },
            { id: "success-rate", label: "Success Rate", value: "97.8%", detail: "Last 7 days" },
            { id: "avg-time", label: "Avg. Publish Time", value: "12m", detail: "Across all channels" }
        ],
        uploadPipelines: [
            { id: "youtube", label: "YouTube Shorts Pipeline", progress: 78, detail: "14 of 18 scheduled uploads prepared" },
            { id: "instagram", label: "Instagram Reels Pipeline", progress: 61, detail: "11 of 18 assets validated" },
            { id: "facebook", label: "Facebook Reels Pipeline", progress: 89, detail: "16 of 18 publish packages finalized" }
        ],
        videoList: defaultVideoList,
        auditRows: defaultAuditRows,
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
        metadata: {
            title: "Jett Entry Sequence",
            description: "Fast-paced Valorant short with aggressive site entry highlights.",
            musicTrack: "Cinematic Pulse"
        },
        musicOptions: [
            "No Track",
            "Cinematic Pulse",
            "Night Run",
            "Arcade Surge",
            "Victory Loop"
        ],
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
        getFilteredVideos: function getFilteredVideos()
        {
            const state = get();

            if (state.videoFilter === "ALL")
            {
                return state.videoList;
            }

            return state.videoList.filter(function filterVideo(video)
            {
                return video.statuses.includes(state.videoFilter);
            });
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
        setMetadataField: function setMetadataField(field, value)
        {
            set(function updateMetadataField(state)
            {
                return {
                    metadata: {
                        ...state.metadata,
                        [field]: value
                    }
                };
            });
        },
        appendLog: function appendLog(line)
        {
            set(function appendLogLine(state)
            {
                return {
                    logLines: state.logLines.concat(line)
                };
            });
        },
        clearLogs: function clearLogs()
        {
            set({
                logLines: []
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
                    uploadStatus: response
                });
            }
        },
        fetchVideoList: async function fetchVideoList()
        {
            if (!window.api || !window.api.getVideoList)
            {
                return;
            }

            const response = await window.api.getVideoList();

            if (Array.isArray(response) && response.length > 0)
            {
                set({
                    videoList: response.map(function mapVideo(video, index)
                    {
                        const fallbackStatuses = [
                            ["YT", "IG"],
                            ["YT", "FB"],
                            ["IG", "FB"],
                            ["YT", "IG", "FB"]
                        ];

                        return {
                            id: video.id,
                            title: video.title,
                            duration: video.duration,
                            thumbnail: video.thumbnail || "Preview Frame",
                            statusText: video.status || "ready",
                            statuses: video.statuses || fallbackStatuses[index % fallbackStatuses.length]
                        };
                    })
                });
            }
        },
        runUpload: async function runUpload()
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
                    uploadStatus: {
                        ...state.uploadStatus,
                        ...response
                    }
                });
            }

            return response;
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
                set(function updateStoppedStatus(state)
                {
                    return {
                        uploadStatus: {
                            ...state.uploadStatus,
                            ...response
                        }
                    };
                });
            }

            return response;
        },
        streamLogs: async function streamLogs()
        {
            if (!window.api || !window.api.streamLog)
            {
                return null;
            }

            return window.api.streamLog();
        },
        startConsole: async function startConsole()
        {
            const state = get();

            if (state.consoleTimerId)
            {
                clearInterval(state.consoleTimerId);
            }

            await state.runUpload();
            await state.streamLogs();

            const timerId = window.setInterval(function emitMockLog()
            {
                get().appendLog("[mock] processing batch item " + String(get().logLines.length + 1));
            }, 1200);

            set({
                isConsoleRunning: true,
                consoleTimerId: timerId
            });
        },
        stopConsole: async function stopConsole()
        {
            const state = get();

            if (state.consoleTimerId)
            {
                clearInterval(state.consoleTimerId);
            }

            await state.stopUpload();

            set({
                isConsoleRunning: false,
                consoleTimerId: null
            });
        }
    };
});
