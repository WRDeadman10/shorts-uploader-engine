const dataService = require("../services/dataService");
const uploadService = require("../services/uploadService");
const { spawnSync } = require("child_process");
const pythonService = require("../services/pythonService");
const pathService = require("../services/pathService");
const { shell, dialog } = require("electron");
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const unzipper = require('unzipper');

// ── Helper: recursively calculate directory size in bytes ───────────────────
function dirSizeBytes(dirPath)
{
    let total = 0;
    try
    {
        if (!fs.existsSync(dirPath)) return 0;
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries)
        {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory())
            {
                total += dirSizeBytes(fullPath);
            }
            else
            {
                try { total += fs.statSync(fullPath).size; } catch (_) {}
            }
        }
    }
    catch (_) {}
    return total;
}

function formatBytes(bytes)
{
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + " " + units[i];
}

function registerSystemHandlers(ipcMain)
{
    ipcMain.handle("get-video-list", async function handleGetVideoList()
    {
        return dataService.getVideoList();
    });

    ipcMain.handle("stream-log", async function handleStreamLog()
    {
        return uploadService.streamLog();
    });

    ipcMain.handle("load-workflow-settings", async function handleLoadWorkflowSettings()
    {
        return dataService.loadWorkflowSettings();
    });

    ipcMain.handle("save-workflow-settings", async function handleSaveWorkflowSettings(_event, settings)
    {
        return dataService.saveWorkflowSettings(settings);
    });

    ipcMain.handle("get-audit-report", async function handleGetAuditReport()
    {
        return pathService.readAuditReport();
    });

    ipcMain.handle("show-in-folder", async function handleShowInFolder(_event, filePath)
    {
        if (!filePath) return;
        shell.showItemInFolder(filePath);
    });

    ipcMain.handle("run-env-check", async function handleRunEnvCheck(_event)
    {
        const pythonResult = await pythonService.resolvePythonCommand();
        const ffmpegResult = spawnSync('ffmpeg', ['-version'], { windowsHide: true });
        const ffprobeResult = spawnSync('ffprobe', ['-version'], { windowsHide: true });

        const repoRoot = pathService.getRepoRoot();
        const clientSecretFound = fs.existsSync(path.join(repoRoot, 'client_secret.json'));
        const tokenFound = fs.existsSync(path.join(repoRoot, 'token.json'));
        const settingsFound = fs.existsSync(path.join(repoRoot, 'settings.json'));
        const videoRoot = pathService.resolveVideoRoot();
        const videoRootFound = fs.existsSync(videoRoot);

        return {
            python: {
                found: pythonResult.found,
                version: pythonResult.version
            },
            ffmpeg: {
                found: !ffmpegResult.error,
                version: ffmpegResult.stdout.toString().split('\n')[0].trim()
            },
            ffprobe: {
                found: !ffprobeResult.error,
                version: ffprobeResult.stdout.toString().split('\n')[0].trim()
            },
            credentials: { clientSecret: clientSecretFound, token: tokenFound },
            settings: { found: settingsFound },
            videoRoot: { path: videoRoot, found: videoRootFound }
        };
    });

    ipcMain.handle("get-thumbnail", async function handleGetThumbnail(_event, thumbPath)
    {
        if (!thumbPath || !fs.existsSync(thumbPath)) return null;

        try
        {
            const data = fs.readFileSync(thumbPath);
            const ext = path.extname(thumbPath).slice(1).toLowerCase().replace("jpg", "jpeg");
            return "data:image/" + ext + ";base64," + data.toString("base64");
        }
        catch (_err)
        {
            return null;
        }
    });

    // ── Token Health ───────────────────────────────────────────────────────────
    ipcMain.handle("get-token-health", async function handleGetTokenHealth()
    {
        const repoRoot = pathService.getRepoRoot();
        const result = {
            youtubeOAuth: { status: "missing", detail: "client_secret.json not found" },
            youtubeToken: { status: "missing", detail: "token.json not found" },
            metaToken: { status: "missing", detail: "No Meta token configured" },
            openaiKey: { status: "missing", detail: "OPENAI_API_KEY not set" }
        };

        // YouTube OAuth client secret
        const clientSecretPath = path.join(repoRoot, "client_secret.json");
        if (fs.existsSync(clientSecretPath))
        {
            result.youtubeOAuth = { status: "ok", detail: "client_secret.json found" };
        }

        // YouTube token + expiry check
        const tokenPath = path.join(repoRoot, "token.json");
        if (fs.existsSync(tokenPath))
        {
            try
            {
                const tokenData = JSON.parse(fs.readFileSync(tokenPath, "utf8"));
                const expiry = tokenData.expiry || tokenData.token_expiry || "";
                if (expiry)
                {
                    const expiryDate = new Date(expiry);
                    const now = new Date();
                    const hoursLeft = (expiryDate - now) / (1000 * 60 * 60);
                    if (hoursLeft <= 0)
                    {
                        result.youtubeToken = { status: "expired", detail: "Token expired at " + expiryDate.toLocaleString() };
                    }
                    else if (hoursLeft <= 1)
                    {
                        result.youtubeToken = { status: "warning", detail: "Token expires in " + Math.round(hoursLeft * 60) + " min" };
                    }
                    else
                    {
                        result.youtubeToken = { status: "ok", detail: "Token valid (refreshable)" };
                    }
                }
                else
                {
                    result.youtubeToken = { status: "ok", detail: "token.json found (no expiry field)" };
                }
            }
            catch (_)
            {
                result.youtubeToken = { status: "warning", detail: "token.json exists but could not be parsed" };
            }
        }

        // Meta token — check settings.json for a stored token
        try
        {
            const settings = pathService.readSettings();
            const uploadOpts = (settings && settings.uploadOptions) || {};
            const hasMaster = Boolean(uploadOpts.metaMasterToken);
            const hasAccess = Boolean(uploadOpts.metaAccessToken);
            if (hasMaster)
            {
                result.metaToken = { status: "ok", detail: "Master token configured" };
            }
            else if (hasAccess)
            {
                result.metaToken = { status: "warning", detail: "Page token present but no master token" };
            }
        }
        catch (_) {}

        // OpenAI API Key
        const openaiKey = process.env.OPENAI_API_KEY || "";
        if (openaiKey.trim())
        {
            result.openaiKey = { status: "ok", detail: "API key is set (" + openaiKey.slice(0, 7) + "...)" };
        }

        return result;
    });

    // ── Disk Usage ─────────────────────────────────────────────────────────────
    ipcMain.handle("get-disk-usage", async function handleGetDiskUsage()
    {
        const repoRoot = pathService.getRepoRoot();
        const videoRoot = pathService.resolveVideoRoot();

        const convertedDir = path.join(repoRoot, "converted_shorts");
        const metadataDir = path.join(repoRoot, "generated_metadata");
        const auditDir = path.join(repoRoot, "live_upload_audit");

        const convertedBytes = dirSizeBytes(convertedDir);
        const metadataBytes = dirSizeBytes(metadataDir);
        const auditBytes = dirSizeBytes(auditDir);

        // Count files in converted_shorts
        let convertedCount = 0;
        try { convertedCount = fs.existsSync(convertedDir) ? fs.readdirSync(convertedDir).length : 0; } catch (_) {}

        // Free disk space — use the video root drive
        let freeBytes = 0;
        let totalDiskBytes = 0;
        try
        {
            // Node 18.15+ has fs.statfsSync
            if (fs.statfsSync)
            {
                const stats = fs.statfsSync(videoRoot);
                freeBytes = stats.bavail * stats.bsize;
                totalDiskBytes = stats.blocks * stats.bsize;
            }
        }
        catch (_) {}

        return {
            convertedShorts: { bytes: convertedBytes, formatted: formatBytes(convertedBytes), fileCount: convertedCount },
            generatedMetadata: { bytes: metadataBytes, formatted: formatBytes(metadataBytes) },
            liveAudit: { bytes: auditBytes, formatted: formatBytes(auditBytes) },
            disk: {
                freeBytes: freeBytes,
                freeFormatted: formatBytes(freeBytes),
                totalBytes: totalDiskBytes,
                totalFormatted: formatBytes(totalDiskBytes),
                usedPercent: totalDiskBytes > 0 ? Math.round(((totalDiskBytes - freeBytes) / totalDiskBytes) * 100) : 0
            },
            videoRoot: videoRoot
        };
    });

    // ── Backup State ───────────────────────────────────────────────────────────
    ipcMain.handle("backup-state", async function handleBackupState(_event)
    {
        const repoRoot = pathService.getRepoRoot();
        const stateFiles = [
            ".youtube_upload_state.json",
            ".meta_reels_upload_state.json",
            ".youtube_uploaded_videos.json",
            ".instagram_uploaded_videos.json",
            ".facebook_uploaded_videos.json",
            "settings.json"
        ];

        // Show save dialog
        const win = require("electron").BrowserWindow.getFocusedWindow();
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const result = await dialog.showSaveDialog(win, {
            title: "Save State Backup",
            defaultPath: path.join(repoRoot, "state-backup-" + timestamp + ".zip"),
            filters: [{ name: "ZIP Archive", extensions: ["zip"] }]
        });

        if (result.canceled || !result.filePath)
        {
            return { success: false, errorMessage: "Cancelled" };
        }

        return new Promise(function(resolve)
        {
            const output = fs.createWriteStream(result.filePath);
            const archive = archiver("zip", { zlib: { level: 9 } });

            output.on("close", function()
            {
                resolve({ success: true, filePath: result.filePath, bytes: archive.pointer() });
            });

            archive.on("error", function(err)
            {
                resolve({ success: false, errorMessage: err.message });
            });

            archive.pipe(output);

            for (const fileName of stateFiles)
            {
                const filePath = path.join(repoRoot, fileName);
                if (fs.existsSync(filePath))
                {
                    archive.file(filePath, { name: fileName });
                }
            }

            archive.finalize();
        });
    });

    // ── Restore State ──────────────────────────────────────────────────────────
    ipcMain.handle("restore-state", async function handleRestoreState(_event)
    {
        const repoRoot = pathService.getRepoRoot();
        const win = require("electron").BrowserWindow.getFocusedWindow();

        const result = await dialog.showOpenDialog(win, {
            title: "Select State Backup",
            filters: [{ name: "ZIP Archive", extensions: ["zip"] }],
            properties: ["openFile"]
        });

        if (result.canceled || !result.filePaths || result.filePaths.length === 0)
        {
            return { success: false, errorMessage: "Cancelled" };
        }

        const zipPath = result.filePaths[0];

        try
        {
            const directory = await unzipper.Open.file(zipPath);
            let restoredCount = 0;

            for (const file of directory.files)
            {
                // Only restore known state files
                const baseName = path.basename(file.path);
                if (baseName.endsWith(".json"))
                {
                    const destPath = path.join(repoRoot, baseName);
                    const content = await file.buffer();
                    fs.writeFileSync(destPath, content);
                    restoredCount++;
                }
            }

            return { success: true, restoredCount: restoredCount, zipPath: zipPath };
        }
        catch (err)
        {
            return { success: false, errorMessage: err.message };
        }
    });
}

module.exports = {
    registerSystemHandlers: registerSystemHandlers
};
