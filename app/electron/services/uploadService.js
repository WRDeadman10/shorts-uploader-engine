const path = require("path");
const { spawn } = require("child_process");
const { Notification } = require("electron");
const { getRepoRoot } = require("./pathService");
const { resolvePythonCommand } = require("./pythonService");

let getMainWindow = null;

const ANSI_ESCAPE_RE = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

// sessionId → { process, logBuffer, status, stopRequested }
const sessions = new Map();

function createIdleStatus()
{
    return {
        success: true,
        sessionId: "",
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

function attachWindowGetter(windowGetter)
{
    getMainWindow = windowGetter;
}

function getAllStatuses()
{
    return Array.from(sessions.values()).map(function(s) { return s.status; });
}

function getUploadStatus()
{
    // Backward compat: return the most recent running session, or the last session, or idle
    const all = getAllStatuses();
    if (all.length === 0) return createIdleStatus();
    const running = all.filter(function(s) { return s.status === "running"; });
    if (running.length > 0) return running[running.length - 1];
    return all[all.length - 1];
}

function streamLog()
{
    // Replay all session logs sorted by timestamp
    const allEntries = [];
    sessions.forEach(function(session)
    {
        session.logBuffer.forEach(function(entry) { allEntries.push(entry); });
    });
    allEntries.sort(function(a, b) { return a.timestamp < b.timestamp ? -1 : 1; });
    allEntries.forEach(function(entry) { sendLog(entry); });
    broadcastStatuses();
    return { success: true, streaming: true };
}

async function runUpload(payload)
{
    // No "already running" guard — allow multiple concurrent upload sessions

    const pythonCommand = resolvePythonCommand();

    if (!pythonCommand.found)
    {
        const sessionId = String(Date.now());
        const errStatus = Object.assign(createIdleStatus(), {
            sessionId: sessionId,
            uploadId: sessionId,
            success: false,
            status: "error",
            errorMessage: "Python was not found. Install Python or create a local venv before running uploads.",
            startedAt: new Date().toISOString()
        });
        sessions.set(sessionId, { process: null, logBuffer: [], stopRequested: false, status: errStatus });
        pushLog(sessionId, "system", errStatus.errorMessage);
        broadcastStatuses();
        return errStatus;
    }

    const basePayload = payload || {};
    const uniqueQueueOnly = Boolean(basePayload.options && basePayload.options.uniqueQueueOnly);
    const normalizedPayload = uniqueQueueOnly
        ? Object.assign({}, basePayload, {
            platforms: { youtube: true, instagram: true, facebook: true }
        })
        : basePayload;
    const platforms = normalizedPayload.platforms || {};
    const selectedPlatforms = ["youtube", "instagram", "facebook"].filter(function(name) { return Boolean(platforms[name]); });

    const launchPayloads = uniqueQueueOnly
        ? [normalizedPayload]
        : selectedPlatforms.length <= 1
        ? [normalizedPayload]
        : selectedPlatforms.map(function(name, index)
        {
            // Instagram uploads should never receive scheduled publishing.
            const nextPayload = buildSinglePlatformPayload(normalizedPayload, name, name === "instagram");
            if (!uniqueQueueOnly) return nextPayload;

            const nextOptions = Object.assign({}, nextPayload.options || {});
            if (index === 0)
            {
                nextOptions.requireUploadedOn = "";
                nextOptions.requireMissingOn = selectedPlatforms.join(",");
            }
            else
            {
                const previous = selectedPlatforms[index - 1] || "";
                nextOptions.requireUploadedOn = previous;
                nextOptions.requireMissingOn = name;
            }
            nextPayload.options = nextOptions;
            return nextPayload;
        });

    const launched = [];
    const runSequentially = uniqueQueueOnly && selectedPlatforms.length > 1;
    for (const launchPayload of launchPayloads)
    {
        try
        {
            const started = startUploadSession(pythonCommand, launchPayload);
            launched.push(started);
            if (runSequentially)
            {
                await waitForSessionExit(started.sessionId);
            }
        }
        catch (error)
        {
            const sessionId = String(Date.now()) + "-" + String(Math.floor(Math.random() * 1000));
            const errStatus = Object.assign(createIdleStatus(), {
                sessionId: sessionId,
                uploadId: sessionId,
                success: false,
                status: "error",
                errorMessage: error.message,
                startedAt: new Date().toISOString()
            });
            sessions.set(sessionId, { process: null, logBuffer: [], stopRequested: false, status: errStatus });
            pushLog(sessionId, "system", error.message);
            broadcastStatuses();
            return errStatus;
        }
    }

    if (launched.length === 1) return launched[0];
    return Object.assign({}, launched[0], {
        startedSessions: launched.map(function(s) { return s.sessionId; }),
        platform: selectedPlatforms.join("+")
    });
}

function waitForSessionExit(sessionId)
{
    return new Promise(function(resolve)
    {
        const check = function()
        {
            const session = sessions.get(sessionId);
            if (!session || !session.process) return resolve();
            setTimeout(check, 500);
        };
        check();
    });
}

function buildSinglePlatformPayload(payload, platformName, disableSchedule)
{
    const nextPlatforms = { youtube: false, instagram: false, facebook: false };
    nextPlatforms[platformName] = true;
    const nextSchedule = Object.assign({}, payload.schedule || {});
    if (disableSchedule) nextSchedule.enabled = false;
    return Object.assign({}, payload, {
        platforms: nextPlatforms,
        schedule: nextSchedule
    });
}

function startUploadSession(pythonCommand, payload)
{
    const commandSpec = buildUploadCommand(payload || {});
    const sessionId = String(Date.now()) + "-" + String(Math.floor(Math.random() * 100000));
    const scriptPath = path.join(getRepoRoot(), commandSpec.scriptName);
    const args = pythonCommand.prefixArgs.concat([scriptPath]).concat(commandSpec.scriptArgs);
    const commandStr = [pythonCommand.command].concat(args).join(" ");

    const sessionStatus = {
        success: true,
        sessionId: sessionId,
        uploadId: sessionId,
        status: "running",
        platform: commandSpec.platformLabel,
        progress: 15,
        pid: 0,
        errorMessage: "",
        commandPreview: commandStr,
        startedAt: new Date().toISOString(),
        completedAt: ""
    };

    const session = { process: null, logBuffer: [], stopRequested: false, status: sessionStatus };
    sessions.set(sessionId, session);

    const proc = spawn(
        pythonCommand.command,
        args,
        {
            cwd: getRepoRoot(),
            windowsHide: true,
            env: Object.assign({}, process.env, {
                PYTHONIOENCODING: "utf-8",
                PYTHONUTF8: "1",
                PYTHONUNBUFFERED: "1"
            })
        }
    );

    session.process = proc;
    session.status.pid = proc.pid || 0;
    pushLog(sessionId, "system", "Starting process: " + commandStr);
    broadcastStatuses();

    proc.stdout.on("data", function handleStdout(chunk)
    {
        emitChunk(sessionId, "stdout", chunk);
    });

    proc.stderr.on("data", function handleStderr(chunk)
    {
        emitChunk(sessionId, "stderr", chunk);
    });

    proc.on("error", function handleError(error)
    {
        session.status = Object.assign({}, session.status, {
            success: false,
            status: "error",
            errorMessage: error.message,
            progress: 0,
            pid: 0,
            completedAt: new Date().toISOString()
        });
        session.process = null;
        pushLog(sessionId, "stderr", error.message);
        broadcastStatuses();
    });

    proc.on("exit", function handleExit(exitCode, signal)
    {
        const wasStopped = session.stopRequested;
        const nextStatus = wasStopped ? "stopped" : exitCode === 0 ? "completed" : "error";
        const nextProgress = nextStatus === "completed" ? 100 : 0;
        const errorMessage = nextStatus === "error" ? "Upload process exited with code " + String(exitCode) : "";

        session.status = Object.assign({}, session.status, {
            success: nextStatus !== "error",
            status: nextStatus,
            progress: nextProgress,
            pid: 0,
            errorMessage: errorMessage,
            completedAt: new Date().toISOString()
        });
        session.process = null;
        session.stopRequested = false;

        pushLog(sessionId, "system", signal
            ? "Process exited with signal " + signal
            : "Process exited with code " + String(exitCode));
        broadcastStatuses();
        
        if (Notification.isSupported()) {
            new Notification({
                title: "Upload " + (nextStatus === "completed" ? "Completed" : "Failed"),
                body: "Platform: " + session.status.platform + "\nStatus: " + nextStatus
            }).show();
        }
    });

    return session.status;
}

async function stopUpload(sessionId)
{
    if (sessionId)
    {
        const session = sessions.get(sessionId);
        if (session && session.process) await killSession(session);
    }
    else
    {
        // No sessionId → stop all running sessions
        const killPromises = [];
        sessions.forEach(function(session)
        {
            if (session.process) killPromises.push(killSession(session));
        });
        await Promise.all(killPromises);
    }

    broadcastStatuses();
    return getAllStatuses();
}

async function killSession(session)
{
    if (!session.process) return;
    session.stopRequested = true;
    pushLog(session.status.sessionId, "system", "Stopping process...");

    if (process.platform === "win32")
    {
        const killer = spawn("taskkill", ["/pid", String(session.process.pid), "/t", "/f"], { windowsHide: true });
        await new Promise(function waitForKill(resolve) { killer.on("exit", resolve); });
    }
    else
    {
        session.process.kill("SIGTERM");
    }
}

function emitChunk(sessionId, streamName, chunk)
{
    const lines = String(chunk).split(/\r?\n/);
    for (const line of lines)
    {
        const trimmedLine = line.replace(ANSI_ESCAPE_RE, "").trimEnd();
        if (!trimmedLine) continue;
        pushLog(sessionId, streamName, trimmedLine);
    }
}

function pushLog(sessionId, streamName, message)
{
    const session = sessions.get(sessionId);
    const bufLen = session ? session.logBuffer.length : 0;
    const progressMatch = String(message || "").match(/^\[progress\]\[([^\]]+)\]/);
    const progressStep = progressMatch ? progressMatch[1] : "";
    const isProgressUpdate = Boolean(progressStep);
    const entryId = isProgressUpdate
        ? "progress-" + sessionId + "-" + streamName + "-" + progressStep
        : String(Date.now()) + "-" + String(bufLen + 1);
    const entry = {
        id: entryId,
        sessionId: sessionId,
        sessionType: "upload",
        timestamp: new Date().toISOString(),
        stream: streamName,
        message: message,
        replaceIfExists: isProgressUpdate
    };

    if (session)
    {
        if (isProgressUpdate)
        {
            const existingIndex = session.logBuffer.findIndex(function(item) { return item.id === entry.id; });
            if (existingIndex >= 0) session.logBuffer[existingIndex] = entry;
            else session.logBuffer.push(entry);
        }
        else
        {
            session.logBuffer.push(entry);
            if (session.logBuffer.length > 500)
            {
                session.logBuffer = session.logBuffer.slice(session.logBuffer.length - 500);
            }
        }
    }

    sendLog(entry);
}

function sendLog(entry)
{
    if (!getMainWindow) return;
    const mainWindow = getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) return;
    mainWindow.webContents.send("app:log", entry);
}

function broadcastStatuses()
{
    if (!getMainWindow) return;
    const mainWindow = getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) return;
    mainWindow.webContents.send("app:sessions", { upload: getAllStatuses() });
}

function buildSchedulePlan(slots, date) {
    return JSON.stringify(slots.map(function(slot) {
        var utc = new Date(date + 'T' + slot.time + ':00').toISOString();
        return { count: Number(slot.count), publish_at: utc };
    }));
}

function pickScheduleSlots(schedule, platforms)
{
    if (!schedule) return null;
    if (platforms.youtube && schedule.youtubeSlots && schedule.youtubeSlots.length) return schedule.youtubeSlots;
    if (platforms.instagram && !platforms.facebook && schedule.instagramSlots && schedule.instagramSlots.length) return schedule.instagramSlots;
    if (platforms.facebook && !platforms.instagram && schedule.facebookSlots && schedule.facebookSlots.length) return schedule.facebookSlots;
    if (platforms.instagram && platforms.facebook)
    {
        if (schedule.instagramSlots && schedule.instagramSlots.length) return schedule.instagramSlots;
        if (schedule.facebookSlots && schedule.facebookSlots.length) return schedule.facebookSlots;
    }
    return schedule.youtubeSlots && schedule.youtubeSlots.length ? schedule.youtubeSlots : null;
}

function buildUploadCommand(payload)
{
    const platforms = payload.platforms || {};
    const options = payload.options || {};
    const youtubeEnabled = Boolean(platforms.youtube);
    const instagramEnabled = Boolean(platforms.instagram);
    const facebookEnabled = Boolean(platforms.facebook);
    const selectedMetaPlatform = instagramEnabled && facebookEnabled ? "both" : instagramEnabled ? "instagram" : "facebook";

    if (!youtubeEnabled && !instagramEnabled && !facebookEnabled && !options.editOnly)
    {
        throw new Error("Select at least one platform before starting an upload.");
    }

    const maxVid = String((options.maxVideos && Number(options.maxVideos) >= 1) ? Math.round(Number(options.maxVideos)) : 1);

    // ── All platforms route through youtubeBatchUpload.py ─────────────────────
    const uploadPlatform = youtubeEnabled ? "youtube" : instagramEnabled ? "instagram" : facebookEnabled ? "facebook" : "youtube";

    const args = [
        "--upload-platform",
        uploadPlatform,
        "--max-videos",
        maxVid,
        "--allow-fallback"
    ];

    if (options.includeShorts || instagramEnabled)
    {
        args.push("--shorts-policy", "convert");
    }
    else
    {
        args.push("--shorts-policy", "off");
    }

    if (!options.includeMetadata)
    {
        args.push("--no-ai");
    }

    if (!options.includeMusic)
    {
        args.push("--music-dir=");
    }
    if (options.fullSizeVideo)
    {
        args.push("--full-size-video");
    }
    if (options.uniqueQueueOnly)
    {
        args.push("--continue-on-platform-error");
    }

    if (youtubeEnabled && (instagramEnabled || facebookEnabled))
    {
        // YouTube primary + crosspost to Meta
        args.push("--crosspost-meta");
        args.push("--meta-platform", selectedMetaPlatform);
        if (options.metaAccessToken) args.push("--meta-access-token", options.metaAccessToken);
        if (options.igUserId) args.push("--meta-ig-user-id", options.igUserId);
        if (options.fbPageId) args.push("--meta-facebook-page-id", options.fbPageId);
        if (options.metaGraphVersion) args.push("--meta-graph-version", options.metaGraphVersion);
        if (options.metaPollAttempts) args.push("--meta-poll-attempts", String(options.metaPollAttempts));
        if (options.metaPollInterval) args.push("--meta-poll-interval-seconds", String(options.metaPollInterval));
        if (options.metaRequestTimeout) args.push("--meta-request-timeout-seconds", String(options.metaRequestTimeout));
    }
    else if (!youtubeEnabled && (instagramEnabled || facebookEnabled))
    {
        // Instagram-only, Facebook-only, or Instagram+Facebook — direct Meta credentials
        if (instagramEnabled && facebookEnabled) args.push("--meta-platform", "both");
        else if (instagramEnabled) args.push("--meta-platform", "instagram");
        // facebook-only: no --meta-platform needed (default behaviour)
        if (options.metaAccessToken) args.push("--meta-access-token", options.metaAccessToken);
        if (options.igUserId) args.push("--meta-ig-user-id", options.igUserId);
        if (options.fbPageId) args.push("--meta-facebook-page-id", options.fbPageId);
        if (options.metaGraphVersion) args.push("--meta-graph-version", options.metaGraphVersion);
        if (options.metaPollAttempts) args.push("--meta-poll-attempts", String(options.metaPollAttempts));
        if (options.metaPollInterval) args.push("--meta-poll-interval-seconds", String(options.metaPollInterval));
        if (options.metaRequestTimeout) args.push("--meta-request-timeout-seconds", String(options.metaRequestTimeout));
    }

    if (options.videosRoot) { args.push("--root", options.videosRoot); }
    if (options.appendMaxSeconds) {
        let maxSecs = Number(options.appendMaxSeconds);
        // Meta Graph API (Instagram/Facebook Reels) strictly enforces a 60-second duration limit.
        if (instagramEnabled || facebookEnabled) {
            maxSecs = Math.min(maxSecs, 60);
        }
        args.push("--shorts-max-seconds", String(maxSecs));
    }
    if (options.privacy) { args.push("--privacy", options.privacy); }
    if (options.playlistName) { args.push("--playlist-name", options.playlistName); }
    if (options.dryRun) { args.push("--dry-run"); }
    if (options.editOnly) { args.push("--edit-only"); }
    if (options.metaDeleteConverted === false) { args.push("--keep-converted-after-upload"); }
    if (options.ffmpegBin) { args.push("--ffmpeg-bin", options.ffmpegBin); }
    if (options.ffprobeBin) { args.push("--ffprobe-bin", options.ffprobeBin); }
    if (options.extensions) { args.push("--extensions", options.extensions); }
    if (options.excludeDirectories) { args.push("--exclude-dirs", options.excludeDirectories); }
    if (options.excludeFiles) { args.push("--exclude-files", options.excludeFiles); }
    if (options.requireUploadedOn) { args.push("--require-uploaded-on", options.requireUploadedOn); }
    if (options.requireMissingOn)
    {
        args.push("--require-missing-on", options.requireMissingOn);
    }
    else
    {
        const autoPlatforms = ["youtube", "instagram", "facebook"].filter(function(p) { return Boolean(platforms[p]); });
        if (autoPlatforms.length > 0) { args.push("--require-missing-on", autoPlatforms.join(",")); }
    }
    if (options.clientSecretsPath) { args.push("--client-secrets", options.clientSecretsPath); }
    if (options.tokenFilePath) { args.push("--token-file", options.tokenFilePath); }
    if (options.openaiModel) args.push("--openai-model", options.openaiModel);
    if (options.channelName) args.push("--channel-name", options.channelName);
    if (options.extraKeywords) args.push("--extra-keywords", options.extraKeywords);
    if (options.language) args.push("--language", options.language);
    if (options.categoryId) args.push("--category-id", String(options.categoryId));
    const trendingAudioEnabled = Boolean(options.includeMusic && options.useTrendingAudio);
    if (trendingAudioEnabled && options.trendingAudioReportPath)
    {
        args.push("--use-trending-audio");
        args.push("--trending-audio-report", options.trendingAudioReportPath);
        if (options.trendingAudioCacheDir) args.push("--trending-audio-cache-dir", options.trendingAudioCacheDir);
        if (options.trendingAudioMaxTracks) args.push("--trending-audio-max", String(options.trendingAudioMaxTracks));
    }
    else if (options.includeMusic !== false && options.musicDir)
    {
        args.push("--music-dir", options.musicDir);
    }
    if (!trendingAudioEnabled && options.musicVolume) args.push("--music-bg-volume", String(options.musicVolume));
    if (options.musicInventory && !trendingAudioEnabled) args.push("--music-inventory-file", options.musicInventory);
    var sch2 = payload.schedule || {};
    const instagramDirectUpload = instagramEnabled && !youtubeEnabled;
    if (!instagramDirectUpload && sch2.enabled && sch2.date) {
        var slots = pickScheduleSlots(sch2, platforms);
        if (slots) {
            args.push('--schedule-plan', buildSchedulePlan(slots, sch2.date));
        }
    }
    args.push("--continue-on-platform-error");
    const platformLabel = options.editOnly
        ? "editor"
        : youtubeEnabled
            ? (instagramEnabled || facebookEnabled ? "youtube+" + selectedMetaPlatform : "youtube")
            : selectedMetaPlatform;

    return {
        scriptName: "youtubeBatchUpload.py",
        platformLabel: platformLabel,
        scriptArgs: args
    };
}

module.exports = {
    attachWindowGetter: attachWindowGetter,
    getUploadStatus: getUploadStatus,
    getAllStatuses: getAllStatuses,
    runUpload: runUpload,
    stopUpload: stopUpload,
    streamLog: streamLog
};
