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
            windowsHide: true
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

    if (!youtubeEnabled && (instagramEnabled || facebookEnabled))
    {
        return {
            scriptName: "metaBatchReelsUpload.py",
            platformLabel: selectedMetaPlatform,
            scriptArgs: [
                "--platform",
                selectedMetaPlatform,
                "--max-videos",
                "1"
            ]
        };
    }

    const args = [
        "--upload-platform",
        "youtube",
        "--max-videos",
        "1",
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

    if (instagramEnabled || facebookEnabled)
    {
        args.push("--crosspost-meta");
        args.push("--meta-platform", selectedMetaPlatform);
    }

    return {
        scriptName: "youtubeBatchUpload.py",
        platformLabel: instagramEnabled || facebookEnabled ? "youtube+" + selectedMetaPlatform : "youtube",
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
