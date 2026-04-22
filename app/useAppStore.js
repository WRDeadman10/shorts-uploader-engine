import { create } from "zustand";

export const pageOrder = [
    { id: "dashboard", label: "Dashboard" },
    { id: "library", label: "Library" },
    { id: "upload", label: "Upload" },
    { id: "console", label: "Console" },
    { id: "audit", label: "Audit" },
    { id: "metadata", label: "Metadata" },
    { id: "setup", label: "Setup" },
    { id: "tools", label: "Tools" }
];

function createInitialUploadStatus()
{
    return {
        success: true,
        uploadId: "",
        sessionId: "",
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
        return { title: "", description: "", musicTrack: "No Track" };
    }
    return {
        title: video.title || "",
        description: video.description || "",
        musicTrack: video.musicTrack || "No Track"
    };
}

// Build a sessionId-keyed map from an array of status objects
function buildSessionsMap(statusArray)
{
    const map = {};
    if (!Array.isArray(statusArray)) return map;
    statusArray.forEach(function(s) { if (s && s.sessionId) map[s.sessionId] = s; });
    return map;
}

// Derive the "primary" upload status from the sessions map (for backward compat)
function derivePrimary(sessionsMap)
{
    const all = Object.values(sessionsMap);
    if (all.length === 0) return createInitialUploadStatus();
    const running = all.filter(function(s) { return s.status === "running"; });
    if (running.length > 0) return running[running.length - 1];
    return all[all.length - 1];
}

export const useAppStore = create(function createAppStore(set, get)
{
    return {
        activePage: "dashboard",
        videoFilter: "ALL",
        selectedVideoId: "",
        videoList: [],
        loadingVideos: false,

        // Single-session backward-compat shortcut (always = latest running or last session)
        uploadStatus: createInitialUploadStatus(),

        // Multi-session maps: sessionId → status object
        uploadSessions: {},
        toolSessions: {},

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
        featureStatus: "",
        envCheckResult: null,
        scheduleEnabled: false,
        scheduleDate: new Date().toISOString().slice(0, 10),
        youtubeSlots: [{ time: '10:00', count: 10 }],
        facebookSlots: [{ time: '10:00', count: 10 }],
        instagramDraft: false,

        // Called when the backend broadcasts an app:sessions event
        applySessionsUpdate: function applySessionsUpdate(data)
        {
            const updates = {};
            if (data && Array.isArray(data.upload))
            {
                const map = buildSessionsMap(data.upload);
                updates.uploadSessions = map;
                updates.uploadStatus = derivePrimary(map);
            }
            if (data && Array.isArray(data.tool))
            {
                updates.toolSessions = buildSessionsMap(data.tool);
            }
            if (Object.keys(updates).length > 0) set(updates);
        },

        loadAdvancedUploadSettings: function loadAdvancedUploadSettings(settings)
        {
            var updates = { advancedUploadSettings: settings };
            if (settings && settings.uploadOptions)
            {
                updates.uploadOptions = Object.assign({}, get().uploadOptions, settings.uploadOptions);
            }
            if (settings && settings.uploadPlatforms) { updates.uploadPlatforms = Object.assign({}, get().uploadPlatforms, settings.uploadPlatforms); }
            if (settings && settings.toolsForm) { updates.toolsForm = Object.assign({}, get().toolsForm, settings.toolsForm); }
            if (settings && settings.schedule)
            {
                var sch = settings.schedule;
                if (sch.enabled !== undefined) updates.scheduleEnabled = sch.enabled;
                if (sch.date) updates.scheduleDate = sch.date;
                if (Array.isArray(sch.youtubeSlots) && sch.youtubeSlots.length) updates.youtubeSlots = sch.youtubeSlots;
                if (Array.isArray(sch.facebookSlots) && sch.facebookSlots.length) updates.facebookSlots = sch.facebookSlots;
                if (sch.instagramDraft !== undefined) updates.instagramDraft = sch.instagramDraft;
            }
            set(updates);
        },
        saveAdvancedUploadSettings: async function saveAdvancedUploadSettings()
        {
            if (!window.api || !window.api.saveWorkflowSettings) return;
            var payload = Object.assign({}, get().advancedUploadSettings, {
                uploadOptions: get().uploadOptions,
                uploadPlatforms: get().uploadPlatforms,
                toolsForm: get().toolsForm,
                schedule: {
                    enabled: get().scheduleEnabled,
                    date: get().scheduleDate,
                    youtubeSlots: get().youtubeSlots,
                    facebookSlots: get().facebookSlots,
                    instagramDraft: get().instagramDraft
                }
            });
            const response = await window.api.saveWorkflowSettings(payload);
            if (response) set({ errorMessage: response.errorMessage || "" });
        },
        setActivePage: function setActivePage(pageId) { set({ activePage: pageId }); },
        setVideoFilter: function setVideoFilter(filter) { set({ videoFilter: filter }); },
        setErrorMessage: function setErrorMessage(message) { set({ errorMessage: message || "" }); },
        getFilteredVideos: function getFilteredVideos()
        {
            const state = get();
            if (state.videoFilter === "ALL") return state.videoList;
            return state.videoList.filter(function filterVideo(video)
            {
                if (state.videoFilter === "YT") return video.yt;
                if (state.videoFilter === "IG") return video.ig;
                if (state.videoFilter === "FB") return video.fb;
                return true;
            });
        },
        getAuditRows: function getAuditRows()
        {
            return get().videoList.map(function mapAuditRow(video)
            {
                return { id: video.id, video: video.title, yt: video.yt, ig: video.ig, fb: video.fb, status: video.status };
            });
        },
        selectVideo: function selectVideo(videoId)
        {
            const targetVideo = get().videoList.find(function findVideo(video) { return video.id === videoId; });
            set({ selectedVideoId: videoId, metadata: buildMetadataFromVideo(targetVideo), metadataDirty: false });
        },
        setMetadataField: function setMetadataField(field, value)
        {
            set(function updateMetadataField(state)
            {
                return { metadata: { ...state.metadata, [field]: value }, metadataDirty: true };
            });
        },
        appendLogEntry: function appendLogEntry(entry)
        {
            if (!entry || typeof entry !== "object") return;
            set(function appendLogLine(state)
            {
                const entryId = entry && entry.id ? entry.id : "";
                if (entryId && state.logEntries.some(function hasEntry(logEntry) { return logEntry.id === entryId; }))
                {
                    return {};
                }
                return { logEntries: state.logEntries.concat(entry) };
            });
        },
        clearLogs: function clearLogs() { set({ logEntries: [] }); },
        addCommandToHistory: function addCommandToHistory(entry)
        {
            set(function updateHistory(state) { return { commandHistory: state.commandHistory.concat(entry).slice(-20) }; });
        },
        syncUploadStatus: async function syncUploadStatus()
        {
            if (!window.api) return;
            // Use getAllUploadStatuses if available, fall back to getUploadStatus
            if (window.api.getAllUploadStatuses)
            {
                const statuses = await window.api.getAllUploadStatuses();
                if (Array.isArray(statuses))
                {
                    const map = buildSessionsMap(statuses);
                    set({ uploadSessions: map, uploadStatus: derivePrimary(map) });
                }
            }
            else if (window.api.getUploadStatus)
            {
                const response = await window.api.getUploadStatus();
                if (response) set({ uploadStatus: response, errorMessage: response.errorMessage || "" });
            }
        },
        fetchVideoList: async function fetchVideoList()
        {
            if (!window.api || !window.api.getVideoList) return;
            set({ loadingVideos: true });
            const response = await window.api.getVideoList();
            const videos = Array.isArray(response) ? response : [];
            const currentSelectedVideoId = get().selectedVideoId;
            const matchingVideo = videos.find(function findSelectedVideo(video) { return video.id === currentSelectedVideoId; });
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
            if (!window.api || !window.api.streamLog) return null;
            return window.api.streamLog();
        },
        initializeApp: async function initializeApp()
        {
            await Promise.all([
                get().syncUploadStatus(),
                get().fetchVideoList(),
                get().streamLogs()
            ]);

            if (window.api && window.api.loadWorkflowSettings)
            {
                const saved = await window.api.loadWorkflowSettings();
                if (saved) get().loadAdvancedUploadSettings(saved);
            }

            // Subscribe to real-time session updates from the backend
            if (window.api && window.api.onSessions)
            {
                window.api.onSessions(function(data) { get().applySessionsUpdate(data); });
            }
        },
        uploadPlatforms: {
            youtube: true,
            instagram: false,
            facebook: false
        },
        toolsForm: {
            // Live Upload Audit
            auditRoot: '',
            auditMetaAccessToken: '',
            auditIgUserId: '',
            auditFacebookPageId: '',
            auditGraphVersion: 'v25.0',
            auditClientSecrets: 'client_secret.json',
            auditTokenFile: 'token.json',
            auditOutputDir: 'live_upload_audit',
            // Delete Uploaded Videos
            deleteRoot: '',
            deleteYoutube: true,
            deleteInstagram: true,
            deleteFacebook: true,
            deleteDryRun: true,
            // Fix Repeated YT Metadata
            metaMode: 'all',
            metaMaxUpdates: 25,
            metaDryRun: false,
            metaClientSecrets: '',
            metaTokenFile: '',
            // Music Overlay Sample
            musicDir: '',
            musicSampleVideo: '',
            musicSampleMusic: '',
            musicSampleOutput: '',
            musicBgVolume: 0.3,
            musicFfmpegBin: '',
            musicFfprobeBin: '',
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
                return { uploadPlatforms: { ...state.uploadPlatforms, [platformId]: value } };
            });
        },
        setUploadOption: function setUploadOption(optionId, value)
        {
            set(function updateUploadOption(state)
            {
                return { uploadOptions: { ...state.uploadOptions, [optionId]: value } };
            });
            get().saveAdvancedUploadSettings();
        },
        setToolsField: function setToolsField(field, value)
        {
            set(function(s) { return { toolsForm: Object.assign({}, s.toolsForm, { [field]: value }) }; });
            get().saveAdvancedUploadSettings();
        },
        setScheduleEnabled: function setScheduleEnabled(v) { set({ scheduleEnabled: v }); get().saveAdvancedUploadSettings(); },
        setScheduleDate: function setScheduleDate(v) { set({ scheduleDate: v }); get().saveAdvancedUploadSettings(); },
        setInstagramDraft: function setInstagramDraft(v) { set({ instagramDraft: v }); get().saveAdvancedUploadSettings(); },
        addYoutubeSlot: function addYoutubeSlot() { set(function(s) { return { youtubeSlots: s.youtubeSlots.concat({ time: '10:00', count: 10 }) }; }); get().saveAdvancedUploadSettings(); },
        removeYoutubeSlot: function removeYoutubeSlot(i) { set(function(s) { return { youtubeSlots: s.youtubeSlots.filter(function(_, j) { return j !== i; }) }; }); get().saveAdvancedUploadSettings(); },
        updateYoutubeSlot: function updateYoutubeSlot(i, field, val) { set(function(s) { var sl = s.youtubeSlots.slice(); sl[i] = Object.assign({}, sl[i], { [field]: val }); return { youtubeSlots: sl }; }); get().saveAdvancedUploadSettings(); },
        addFacebookSlot: function addFacebookSlot() { set(function(s) { return { facebookSlots: s.facebookSlots.concat({ time: '10:00', count: 10 }) }; }); get().saveAdvancedUploadSettings(); },
        removeFacebookSlot: function removeFacebookSlot(i) { set(function(s) { return { facebookSlots: s.facebookSlots.filter(function(_, j) { return j !== i; }) }; }); get().saveAdvancedUploadSettings(); },
        updateFacebookSlot: function updateFacebookSlot(i, field, val) { set(function(s) { var sl = s.facebookSlots.slice(); sl[i] = Object.assign({}, sl[i], { [field]: val }); return { facebookSlots: sl }; }); get().saveAdvancedUploadSettings(); },

        startConsole: async function startConsole()
        {
            const state = get();
            if (!window.api || !window.api.runUpload) return null;

            const response = await window.api.runUpload({
                platforms: state.uploadPlatforms,
                options: state.uploadOptions,
                metadata: state.metadata,
                schedule: {
                    enabled: state.scheduleEnabled,
                    date: state.scheduleDate,
                    youtubeSlots: state.youtubeSlots,
                    facebookSlots: state.facebookSlots,
                    instagramDraft: state.instagramDraft
                }
            });

            if (response && response.sessionId)
            {
                set(function(s)
                {
                    const map = Object.assign({}, s.uploadSessions, { [response.sessionId]: response });
                    return { uploadSessions: map, uploadStatus: derivePrimary(map), errorMessage: response.errorMessage || "" };
                });
                get().addCommandToHistory({
                    id: Date.now(),
                    timestamp: new Date().toISOString(),
                    platforms: Object.keys(get().uploadPlatforms).filter(function(p) { return get().uploadPlatforms[p]; }),
                    commandPreview: response.commandPreview || ""
                });
            }

            return response;
        },
        runUpload: async function runUpload() { return get().startConsole(); },

        // Stop a specific session by sessionId, or all if no sessionId given
        stopUpload: async function stopUpload(sessionId)
        {
            if (!window.api || !window.api.stopUpload) return null;
            const statuses = await window.api.stopUpload(sessionId);
            if (Array.isArray(statuses))
            {
                const map = buildSessionsMap(statuses);
                set({ uploadSessions: map, uploadStatus: derivePrimary(map) });
            }
            return statuses;
        },
        stopConsole: async function stopConsole() { return get().stopUpload(); },

        // Alias for per-session stop from Console UI
        stopSession: async function stopSession(sessionId) { return get().stopUpload(sessionId); },

        runEnvCheck: async function runEnvCheck()
        {
            if (!window.api || !window.api.runEnvCheck) return null;
            const result = await window.api.runEnvCheck();
            set({ envCheckResult: result });
            return result;
        }
    };
});
