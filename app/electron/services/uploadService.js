const path = require("path");
const { spawn } = require("child_process");
const { getRepoRoot } = require("./pathService");
const { resolvePythonCommand } = require("./pythonService");

let getMainWindow = null;
let activeProcess = null;
let activeCommand = "";
let logBuffer = [];
let status = createInitialStatus();
let stopRequested = false;

function createInitialStatus()
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

function attachWindowGetter(windowGetter)
{
    getMainWindow = windowGetter;
}

function getUploadStatus()
{
    return {
        ...status,
        hasActiveProcess: Boolean(activeProcess)
    };
}

function streamLog()
{
    for (const entry of logBuffer)
    {
        sendLog(entry);
    }

    return {
        success: true,
        streaming: true
    };
}

async function runUpload(payload)
{
    if (activeProcess)
    {
        return {
            ...getUploadStatus(),
            success: false,
            errorMessage: "An upload process is already running."
        };
    }

    const pythonCommand = resolvePythonCommand();

    if (!pythonCommand.found)
    {
        const errorMessage = "Python was not found. Install Python or create a local venv before running uploads.";

        updateStatus({
            success: false,
            status: "error",
            errorMessage: errorMessage,
            progress: 0
        });
        pushLog("system", errorMessage);

        return getUploadStatus();
    }

    let commandSpec = null;

    try
    {
        commandSpec = buildUploadCommand(payload || {});
    }
    catch (error)
    {
        updateStatus({
            success: false,
            status: "error",
            errorMessage: error.message,
            progress: 0
        });
        pushLog("system", error.message);

        return getUploadStatus();
    }

    const scriptPath = path.join(getRepoRoot(), commandSpec.scriptName);
    const args = pythonCommand.prefixArgs.concat([scriptPath]).concat(commandSpec.scriptArgs);

    stopRequested = false;
    activeCommand = [pythonCommand.command].concat(args).join(" ");
    logBuffer = [];

    activeProcess = spawn(
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

    updateStatus({
        success: true,
        uploadId: String(Date.now()),
        status: "running",
        platform: commandSpec.platformLabel,
        progress: 15,
        pid: activeProcess.pid || 0,
        errorMessage: "",
        commandPreview: activeCommand,
        startedAt: new Date().toISOString(),
        completedAt: ""
    });

    pushLog("system", "Starting process: " + activeCommand);

    activeProcess.stdout.on("data", function handleStdout(chunk)
    {
        emitChunk("stdout", chunk);
    });

    activeProcess.stderr.on("data", function handleStderr(chunk)
    {
        emitChunk("stderr", chunk);
    });

    activeProcess.on("error", function handleError(error)
    {
        updateStatus({
            success: false,
            status: "error",
            errorMessage: error.message,
            progress: 0,
            completedAt: new Date().toISOString()
        });
        pushLog("stderr", error.message);
        activeProcess = null;
    });

    activeProcess.on("exit", function handleExit(exitCode, signal)
    {
        const wasStopped = stopRequested;
        const nextStatus = wasStopped ? "stopped" : exitCode === 0 ? "completed" : "error";
        const nextProgress = nextStatus === "completed" ? 100 : 0;
        const errorMessage = nextStatus === "error" ? "Upload process exited with code " + String(exitCode) : "";

        updateStatus({
            success: nextStatus !== "error",
            status: nextStatus,
            progress: nextProgress,
            pid: 0,
            errorMessage: errorMessage,
            completedAt: new Date().toISOString()
        });

        if (signal)
        {
            pushLog("system", "Process exited with signal " + signal);
        }
        else
        {
            pushLog("system", "Process exited with code " + String(exitCode));
        }

        activeProcess = null;
        stopRequested = false;
    });

    return getUploadStatus();
}

async function stopUpload()
{
    if (!activeProcess)
    {
        return getUploadStatus();
    }

    stopRequested = true;
    pushLog("system", "Stopping active process.");

    if (process.platform === "win32")
    {
        const killer = spawn(
            "taskkill",
            ["/pid", String(activeProcess.pid), "/t", "/f"],
            {
                windowsHide: true
            }
        );

        await new Promise(function waitForKill(resolve)
        {
            killer.on("exit", function handleKillExit()
            {
                resolve();
            });
        });
    }
    else
    {
        activeProcess.kill("SIGTERM");
    }

    return getUploadStatus();
}

function emitChunk(streamName, chunk)
{
    const lines = String(chunk).split(/\r?\n/);

    for (const line of lines)
    {
        const trimmedLine = line.trimEnd();

        if (!trimmedLine)
        {
            continue;
        }

        pushLog(streamName, trimmedLine);
    }
}

function pushLog(streamName, message)
{
    const entry = {
        id: String(Date.now()) + "-" + String(logBuffer.length + 1),
        timestamp: new Date().toISOString(),
        stream: streamName,
        message: message
    };

    logBuffer.push(entry);

    if (logBuffer.length > 500)
    {
        logBuffer = logBuffer.slice(logBuffer.length - 500);
    }

    sendLog(entry);
}

function sendLog(entry)
{
    if (!getMainWindow)
    {
        return;
    }

    const mainWindow = getMainWindow();

    if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents)
    {
        return;
    }

    mainWindow.webContents.send("app:log", entry);
}

function updateStatus(partialStatus)
{
    status = {
        ...status,
        ...partialStatus
    };
}

function buildSchedulePlan(slots, date) {
    return JSON.stringify(slots.map(function(slot) {
        var utc = new Date(date + 'T' + slot.time + ':00').toISOString();
        return { count: Number(slot.count), publish_at: utc };
    }));
}

function buildUploadCommand(payload)
{
    const platforms = payload.platforms || {};
    const options = payload.options || {};
    const youtubeEnabled = Boolean(platforms.youtube);
    const instagramEnabled = Boolean(platforms.instagram);
    const facebookEnabled = Boolean(platforms.facebook);
    const selectedMetaPlatform = instagramEnabled && facebookEnabled ? "both" : instagramEnabled ? "instagram" : "facebook";

    if (!youtubeEnabled && !instagramEnabled && !facebookEnabled)
    {
        throw new Error("Select at least one platform before starting an upload.");
    }

    const maxVid = String((options.maxVideos && Number(options.maxVideos) >= 1) ? Math.round(Number(options.maxVideos)) : 1);

    // ── All platforms route through youtubeBatchUpload.py ─────────────────────
    const uploadPlatform = youtubeEnabled ? "youtube" : instagramEnabled ? "instagram" : "facebook";

    const args = [
        "--upload-platform",
        uploadPlatform,
        "--max-videos",
        maxVid,
        "--allow-fallback"
    ];

    if (options.includeShorts)
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
    if (options.privacy) { args.push("--privacy", options.privacy); }
    if (options.playlistName) { args.push("--playlist-name", options.playlistName); }
    if (options.dryRun) { args.push("--dry-run"); }
    if (options.ffmpegBin) { args.push("--ffmpeg-bin", options.ffmpegBin); }
    if (options.ffprobeBin) { args.push("--ffprobe-bin", options.ffprobeBin); }
    if (options.extensions) { args.push("--extensions", options.extensions); }
    if (options.excludeDirectories) { args.push("--exclude-dirs", options.excludeDirectories); }
    if (options.excludeFiles) { args.push("--exclude-files", options.excludeFiles); }
    if (options.requireUploadedOn) { args.push("--require-uploaded-on", options.requireUploadedOn); }
    if (options.requireMissingOn) { args.push("--require-missing-on", options.requireMissingOn); }
    if (options.clientSecretsPath) { args.push("--client-secrets", options.clientSecretsPath); }
    if (options.tokenFilePath) { args.push("--token-file", options.tokenFilePath); }
    if (options.openaiModel) args.push("--openai-model", options.openaiModel);
    if (options.channelName) args.push("--channel-name", options.channelName);
    if (options.extraKeywords) args.push("--extra-keywords", options.extraKeywords);
    if (options.language) args.push("--language", options.language);
    if (options.categoryId) args.push("--category-id", String(options.categoryId));
    if (options.musicDir) args.push("--music-dir", options.musicDir);
    if (options.musicVolume) args.push("--music-bg-volume", String(options.musicVolume));
    if (options.musicInventory) args.push("--music-inventory-file", options.musicInventory);
    var sch2 = payload.schedule || {};
    if (sch2.enabled && sch2.date) {
        if (youtubeEnabled && sch2.youtubeSlots && sch2.youtubeSlots.length) {
            args.push('--schedule-plan', buildSchedulePlan(sch2.youtubeSlots, sch2.date));
        } else if (!youtubeEnabled && sch2.facebookSlots && sch2.facebookSlots.length) {
            args.push('--schedule-plan', buildSchedulePlan(sch2.facebookSlots, sch2.date));
        }
    }
    if (!sch2.enabled && sch2.instagramDraft && instagramEnabled && !facebookEnabled) {
        args.push('--instagram-draft');
    }

    const platformLabel = youtubeEnabled
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
    runUpload: runUpload,
    stopUpload: stopUpload,
    streamLog: streamLog
};
