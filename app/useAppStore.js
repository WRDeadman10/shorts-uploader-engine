import { create } from "zustand";

export const pageOrder = [
    { id: "dashboard", label: "Dashboard" },
    { id: "library", label: "Library" },
    { id: "upload", label: "Upload" },
    { id: "console", label: "Console" },
    { id: "audit", label: "Audit" },
    { id: "metadata", label: "Metadata" },
    { id: "setup", label: "Setup" }, // Added setup page
    { id: "tools", label: "Tools" }
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
        commandHistory: [],
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
        envCheckResult: null, // Added environment check result
        scheduleEnabled: false,
        scheduleDate: new Date().toISOString().slice(0, 10),
        youtubeSlots: [{ time: '10:00', count: 10 }],
        facebookSlots: [{ time: '10:00', count: 10 }],
        instagramDraft: false,
        loadAdvancedUploadSettings: function loadAdvancedUploadSettings(settings)
        {
            var updates = { advancedUploadSettings: settings };
            // Restore persisted uploadOptions if present
            if (settings && settings.uploadOptions)
            {
                updates.uploadOptions = Object.assign({}, get().uploadOptions, settings.uploadOptions);
            }
            if (settings && settings.uploadPlatforms) { updates.uploadPlatforms = Object.assign({}, get().uploadPlatforms, settings.uploadPlatforms); }
            set(updates);
        },
        saveAdvancedUploadSettings: async function saveAdvancedUploadSettings()
        {
            if (!window.api || !window.api.saveWorkflowSettings)
            {
                return;
            }

            // Persist both advancedUploadSettings and uploadOptions
            var payload = Object.assign({}, get().advancedUploadSettings, {
                uploadOptions: get().uploadOptions,
                uploadPlatforms: get().uploadPlatforms,
                schedule: {
                    enabled: get().scheduleEnabled,
                    date: get().scheduleDate,
                    youtubeSlots: get().youtubeSlots,
                    facebookSlots: get().facebookSlots,
                    instagramDraft: get().instagramDraft
                }
            });
            const response = await window.api.saveWorkflowSettings(payload);

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
        addCommandToHistory: function addCommandToHistory(entry) { set(function updateHistory(state) { return { commandHistory: state.commandHistory.concat(entry).slice(-20) }; }); },
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

            if (window.api && window.api.loadWorkflowSettings) { // Added environment check
                const saved = await window.api.loadWorkflowSettings();
                if (saved) get().loadAdvancedUploadSettings(saved);
            }
        },
        uploadPlatforms: {
            youtube: true,
            instagram: false,
            facebook: false
        },
        uploadOptions: {
            includeShorts: true,
            includeMusic: true,
            includeMetadata: true,
            maxVideos: 1,
            videosRoot: "",
            privacy: "",
            playlistName: "",
            dryRun: false,
            ffmpegBin: "",
            ffprobeBin: "",
            extensions: "",
            excludeDirectories: "",
            excludeFiles: "",
            requireUploadedOn: "",
            requireMissingOn: "",
            clientSecretsPath: "",
            tokenFilePath: ""
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
            // Auto-persist options to disk
            get().saveAdvancedUploadSettings();
        },
        setScheduleEnabled: function setScheduleEnabled(v) { set({ scheduleEnabled: v }); },
        setScheduleDate: function setScheduleDate(v) { set({ scheduleDate: v }); },
        setInstagramDraft: function setInstagramDraft(v) { set({ instagramDraft: v }); },
        addYoutubeSlot: function addYoutubeSlot() { set(function(s) { return { youtubeSlots: s.youtubeSlots.concat({ time: '10:00', count: 10 }) }; }); },
        removeYoutubeSlot: function removeYoutubeSlot(i) { set(function(s) { return { youtubeSlots: s.youtubeSlots.filter(function(_, j) { return j !== i; }) }; }); },
        updateYoutubeSlot: function updateYoutubeSlot(i, field, val) { set(function(s) { var sl = s.youtubeSlots.slice(); sl[i] = Object.assign({}, sl[i], { [field]: val }); return { youtubeSlots: sl }; }); },
        addFacebookSlot: function addFacebookSlot() { set(function(s) { return { facebookSlots: s.facebookSlots.concat({ time: '10:00', count: 10 }) }; }); },
        removeFacebookSlot: function removeFacebookSlot(i) { set(function(s) { return { facebookSlots: s.facebookSlots.filter(function(_, j) { return j !== i; }) }; }); },
        updateFacebookSlot: function updateFacebookSlot(i, field, val) { set(function(s) { var sl = s.facebookSlots.slice(); sl[i] = Object.assign({}, sl[i], { [field]: val }); return { facebookSlots: sl }; }); },
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
                metadata: state.metadata,
                schedule: { enabled: state.scheduleEnabled, date: state.scheduleDate, youtubeSlots: state.youtubeSlots, facebookSlots: state.facebookSlots, instagramDraft: state.instagramDraft }
            });

            if (response)
            {
                set({
                    uploadStatus: response,
                    errorMessage: response.errorMessage || ""
                });
                get().addCommandToHistory({ id: Date.now(), timestamp: new Date().toISOString(), platforms: Object.keys(get().uploadPlatforms).filter(function(p) { return get().uploadPlatforms[p]; }), commandPreview: response.commandPreview || '' });
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
        },
        runEnvCheck: async function runEnvCheck() { // Added environment check
            if (!window.api || !window.api.runEnvCheck) return null;
            const result = await window.api.runEnvCheck();
            set({ envCheckResult: result });
            return result;
        }
    };
});
