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
const https = require('https');

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

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed);
                } catch (err) {
                    resolve({ error: { message: `HTTP status ${res.statusCode}: failed to parse JSON` } });
                }
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

function postUrl(url) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'POST'
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed);
                } catch (err) {
                    resolve({ error: { message: `HTTP status ${res.statusCode}: failed to parse JSON` } });
                }
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        req.end();
    });
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

    ipcMain.handle("get-detailed-audit-report", async function handleGetDetailedAuditReport()
    {
        return pathService.getDetailedAuditReport();
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

    ipcMain.handle("get-ig-comments", async function handleGetIgComments(_event, options = {})
    {
        const forceRefresh = options && options.forceRefresh;
        try
        {
            const settings = pathService.readSettings();
            const uploadOpts = (settings && settings.uploadOptions) || {};
            const accessToken = uploadOpts.metaAccessToken;
            const igUserId = uploadOpts.igUserId;
            const graphVersion = uploadOpts.metaGraphVersion || "v25.0";

            if (!accessToken || !igUserId)
            {
                return { success: false, error: "Instagram Access Token or User ID is missing in settings." };
            }

            const repoRoot = pathService.getRepoRoot();
            const cachePath = path.join(repoRoot, ".ig_comments_cache.json");

            // Read cache
            let cachedData = { posts: [], lastSyncTime: null };
            if (fs.existsSync(cachePath)) {
                try {
                    cachedData = JSON.parse(fs.readFileSync(cachePath, "utf8")) || { posts: [] };
                } catch (_) {}
            }
            const cachedPosts = cachedData.posts || [];
            
            let allPosts = [];
            let syncTime = new Date().toISOString();

            if (forceRefresh || cachedPosts.length === 0)
            {
                // Force sync: Fetch all pages (up to 20 pages / 2000 posts)
                let currentUrl = `https://graph.facebook.com/${graphVersion}/${igUserId}/media?fields=id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,comments.limit(100){id,text,username,timestamp,like_count,replies.limit(50){id,text,username,timestamp,like_count}}&limit=100&access_token=${accessToken}`;
                let pageCount = 0;
                const maxPages = 20;

                while (currentUrl && pageCount < maxPages)
                {
                    const response = await fetchUrl(currentUrl);
                    if (response.error)
                    {
                        if (allPosts.length > 0) break;
                        return { success: false, error: response.error.message || "Failed to fetch comments from Meta API." };
                    }
                    
                    if (response.data && response.data.length > 0)
                    {
                        allPosts = allPosts.concat(response.data);
                    }
                    
                    currentUrl = response.paging?.next || null;
                    pageCount++;
                }
            }
            else
            {
                // Incremental sync: Only fetch the first page of 50 posts
                const url = `https://graph.facebook.com/${graphVersion}/${igUserId}/media?fields=id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,comments.limit(100){id,text,username,timestamp,like_count,replies.limit(50){id,text,username,timestamp,like_count}}&limit=50&access_token=${accessToken}`;
                const response = await fetchUrl(url);
                if (response.error)
                {
                    // Fall back to showing cached posts if network fails
                    return { success: true, data: cachedPosts, lastSyncTime: cachedData.lastSyncTime || null, isCached: true };
                }
                
                const freshPosts = response.data || [];
                
                // Merge fresh posts and cached posts by ID
                const postMap = new Map();
                cachedPosts.forEach(post => postMap.set(post.id, post));
                freshPosts.forEach(post => postMap.set(post.id, post));
                
                allPosts = Array.from(postMap.values());
                allPosts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                syncTime = new Date().toISOString();
            }

            // Save cache
            try {
                fs.writeFileSync(cachePath, JSON.stringify({ posts: allPosts, lastSyncTime: syncTime }, null, 4), "utf8");
            } catch (_) {}

            let igUsername = "";
            try {
                const igUserUrl = `https://graph.facebook.com/${graphVersion}/${igUserId}?fields=username&access_token=${accessToken}`;
                const userRes = await fetchUrl(igUserUrl);
                if (userRes && userRes.username) {
                    igUsername = userRes.username;
                }
            } catch (_e) {}

            return { success: true, data: allPosts, igUsername: igUsername, lastSyncTime: syncTime };
        }
        catch (err)
        {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle("reply-to-ig-comment", async function handleReplyToIgComment(_event, { commentId, message, parentCommentId })
    {
        try
        {
            const settings = pathService.readSettings();
            const uploadOpts = (settings && settings.uploadOptions) || {};
            const accessToken = uploadOpts.metaAccessToken;
            const graphVersion = uploadOpts.metaGraphVersion || "v25.0";

            if (!accessToken)
            {
                return { success: false, error: "Instagram Access Token is missing in settings." };
            }

            const encodedMessage = encodeURIComponent(message);
            const targetId = parentCommentId || commentId;
            const url = `https://graph.facebook.com/${graphVersion}/${targetId}/replies?message=${encodedMessage}&access_token=${accessToken}`;
            
            const response = await postUrl(url);
            if (response.error)
            {
                return { success: false, error: response.error.message || "Failed to post reply to Meta API." };
            }

            return { success: true, data: response };
        }
        catch (err)
        {
            return { success: false, error: err.message };
        }
    });

    // ── Instagram Comments Read/Unread State ───────────────────────────────
    ipcMain.handle("get-ig-comments-state", async function handleGetIgCommentsState()
    {
        try
        {
            const repoRoot = pathService.getRepoRoot();
            const statePath = path.join(repoRoot, ".ig_comments_state.json");
            if (fs.existsSync(statePath))
            {
                const data = JSON.parse(fs.readFileSync(statePath, "utf8"));
                return {
                    success: true,
                    readCommentIds: data.readCommentIds || [],
                    noReplyNeededCommentIds: data.noReplyNeededCommentIds || []
                };
            }
            return { success: true, readCommentIds: [], noReplyNeededCommentIds: [] };
        }
        catch (err)
        {
            return { success: false, error: err.message, readCommentIds: [], noReplyNeededCommentIds: [] };
        }
    });

    ipcMain.handle("mark-ig-comments-read", async function handleMarkIgCommentsRead(_event, commentIds)
    {
        try
        {
            if (!Array.isArray(commentIds)) commentIds = [commentIds];
            const repoRoot = pathService.getRepoRoot();
            const statePath = path.join(repoRoot, ".ig_comments_state.json");
            let existing = { readCommentIds: [], noReplyNeededCommentIds: [] };
            if (fs.existsSync(statePath))
            {
                try {
                    const data = JSON.parse(fs.readFileSync(statePath, "utf8"));
                    existing = {
                        readCommentIds: data.readCommentIds || [],
                        noReplyNeededCommentIds: data.noReplyNeededCommentIds || []
                    };
                } catch (_) {}
            }
            
            existing.readCommentIds = Array.from(new Set([...existing.readCommentIds, ...commentIds]));
            fs.writeFileSync(statePath, JSON.stringify(existing, null, 4), "utf8");
            return { success: true, readCommentIds: existing.readCommentIds };
        }
        catch (err)
        {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle("mark-ig-comments-unread", async function handleMarkIgCommentsUnread(_event, commentIds)
    {
        try
        {
            if (!Array.isArray(commentIds)) commentIds = [commentIds];
            const repoRoot = pathService.getRepoRoot();
            const statePath = path.join(repoRoot, ".ig_comments_state.json");
            let existing = { readCommentIds: [], noReplyNeededCommentIds: [] };
            if (fs.existsSync(statePath))
            {
                try {
                    const data = JSON.parse(fs.readFileSync(statePath, "utf8"));
                    existing = {
                        readCommentIds: data.readCommentIds || [],
                        noReplyNeededCommentIds: data.noReplyNeededCommentIds || []
                    };
                } catch (_) {}
            }
            
            existing.readCommentIds = existing.readCommentIds.filter(id => !commentIds.includes(id));
            fs.writeFileSync(statePath, JSON.stringify(existing, null, 4), "utf8");
            return { success: true, readCommentIds: existing.readCommentIds };
        }
        catch (err)
        {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle("mark-all-ig-comments-read", async function handleMarkAllIgCommentsRead(_event, commentIds)
    {
        try
        {
            if (!Array.isArray(commentIds)) return { success: false, error: "commentIds must be an array" };
            const repoRoot = pathService.getRepoRoot();
            const statePath = path.join(repoRoot, ".ig_comments_state.json");
            let existing = { readCommentIds: [], noReplyNeededCommentIds: [] };
            if (fs.existsSync(statePath))
            {
                try {
                    const data = JSON.parse(fs.readFileSync(statePath, "utf8"));
                    existing = {
                        readCommentIds: data.readCommentIds || [],
                        noReplyNeededCommentIds: data.noReplyNeededCommentIds || []
                    };
                } catch (_) {}
            }
            
            existing.readCommentIds = commentIds;
            fs.writeFileSync(statePath, JSON.stringify(existing, null, 4), "utf8");
            return { success: true, readCommentIds: commentIds };
        }
        catch (err)
        {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle("mark-ig-comments-no-reply", async function handleMarkIgCommentsNoReply(_event, commentIds)
    {
        try
        {
            if (!Array.isArray(commentIds)) commentIds = [commentIds];
            const repoRoot = pathService.getRepoRoot();
            const statePath = path.join(repoRoot, ".ig_comments_state.json");
            let existing = { readCommentIds: [], noReplyNeededCommentIds: [] };
            if (fs.existsSync(statePath))
            {
                try {
                    const data = JSON.parse(fs.readFileSync(statePath, "utf8"));
                    existing = {
                        readCommentIds: data.readCommentIds || [],
                        noReplyNeededCommentIds: data.noReplyNeededCommentIds || []
                    };
                } catch (_) {}
            }
            
            existing.noReplyNeededCommentIds = Array.from(new Set([...existing.noReplyNeededCommentIds, ...commentIds]));
            fs.writeFileSync(statePath, JSON.stringify(existing, null, 4), "utf8");
            return { success: true, noReplyNeededCommentIds: existing.noReplyNeededCommentIds };
        }
        catch (err)
        {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle("unmark-ig-comments-no-reply", async function handleUnmarkIgCommentsNoReply(_event, commentIds)
    {
        try
        {
            if (!Array.isArray(commentIds)) commentIds = [commentIds];
            const repoRoot = pathService.getRepoRoot();
            const statePath = path.join(repoRoot, ".ig_comments_state.json");
            let existing = { readCommentIds: [], noReplyNeededCommentIds: [] };
            if (fs.existsSync(statePath))
            {
                try {
                    const data = JSON.parse(fs.readFileSync(statePath, "utf8"));
                    existing = {
                        readCommentIds: data.readCommentIds || [],
                        noReplyNeededCommentIds: data.noReplyNeededCommentIds || []
                    };
                } catch (_) {}
            }
            
            existing.noReplyNeededCommentIds = existing.noReplyNeededCommentIds.filter(id => !commentIds.includes(id));
            fs.writeFileSync(statePath, JSON.stringify(existing, null, 4), "utf8");
            return { success: true, noReplyNeededCommentIds: existing.noReplyNeededCommentIds };
        }
        catch (err)
        {
            return { success: false, error: err.message };
        }
    });

    // ── Instagram Comments AI Reply Generation and Drafting ──────────────────
    ipcMain.handle("get-ig-comments-drafts", async function handleGetIgCommentsDrafts()
    {
        try
        {
            const repoRoot = pathService.getRepoRoot();
            const draftsPath = path.join(repoRoot, ".ig_comments_drafts.json");
            if (fs.existsSync(draftsPath))
            {
                const data = JSON.parse(fs.readFileSync(draftsPath, "utf8"));
                return { success: true, drafts: data.drafts || {} };
            }
            return { success: true, drafts: {} };
        }
        catch (err)
        {
            return { success: false, error: err.message, drafts: {} };
        }
    });

    ipcMain.handle("save-ig-comment-draft", async function handleSaveIgCommentDraft(_event, { commentId, draftText })
    {
        try
        {
            const repoRoot = pathService.getRepoRoot();
            const draftsPath = path.join(repoRoot, ".ig_comments_drafts.json");
            let drafts = {};
            if (fs.existsSync(draftsPath))
            {
                try {
                    const data = JSON.parse(fs.readFileSync(draftsPath, "utf8"));
                    drafts = data.drafts || {};
                } catch (_) {}
            }
            
            drafts[commentId] = draftText;
            fs.writeFileSync(draftsPath, JSON.stringify({ drafts: drafts }, null, 4), "utf8");
            return { success: true, drafts: drafts };
        }
        catch (err)
        {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle("delete-ig-comment-draft", async function handleDeleteIgCommentDraft(_event, commentIds)
    {
        try
        {
            if (!Array.isArray(commentIds)) commentIds = [commentIds];
            const repoRoot = pathService.getRepoRoot();
            const draftsPath = path.join(repoRoot, ".ig_comments_drafts.json");
            let drafts = {};
            if (fs.existsSync(draftsPath))
            {
                try {
                    const data = JSON.parse(fs.readFileSync(draftsPath, "utf8"));
                    drafts = data.drafts || {};
                } catch (_) {}
            }
            
            commentIds.forEach(id => {
                delete drafts[id];
            });
            
            fs.writeFileSync(draftsPath, JSON.stringify({ drafts: drafts }, null, 4), "utf8");
            return { success: true, drafts: drafts };
        }
        catch (err)
        {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle("generate-ig-comment-reply-ai", async function handleGenerateIgCommentReplyAi(_event, { commentId, commentText })
    {
        try
        {
            const openaiKey = process.env.OPENAI_API_KEY || "";
            if (!openaiKey.trim())
            {
                return { success: false, error: "NO_API_KEY", message: "OpenAI API Key is missing. You can ask Antigravity in the chat to generate replies: 'Antigravity, generate drafts for my unreplied comments'!" };
            }

            if (isUnreadableComment(commentText))
            {
                const reply = await getUselessFact();
                return { success: true, reply: reply };
            }

            const settings = pathService.readSettings();
            const uploadOpts = (settings && settings.uploadOptions) || {};
            const model = uploadOpts.openaiModel || "gpt-4o-mini";

            const reply = await callOpenAiApi(openaiKey, model, commentText);
            return { success: true, reply: reply };
        }
        catch (err)
        {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle("generate-all-unreplied-drafts-ai", async function handleGenerateAllUnrepliedDraftsAi(_event, comments)
    {
        try
        {
            const openaiKey = process.env.OPENAI_API_KEY || "";
            if (!openaiKey.trim())
            {
                return { success: false, error: "NO_API_KEY" };
            }

            const settings = pathService.readSettings();
            const uploadOpts = (settings && settings.uploadOptions) || {};
            const model = uploadOpts.openaiModel || "gpt-4o-mini";

            const repoRoot = pathService.getRepoRoot();
            const draftsPath = path.join(repoRoot, ".ig_comments_drafts.json");
            
            let drafts = {};
            if (fs.existsSync(draftsPath))
            {
                try {
                    const data = JSON.parse(fs.readFileSync(draftsPath, "utf8"));
                    drafts = data.drafts || {};
                } catch (_) {}
            }

            for (const comment of comments)
            {
                if (drafts[comment.id] && drafts[comment.id].trim()) {
                    continue;
                }

                try {
                    let reply = "";
                    if (isUnreadableComment(comment.text))
                    {
                        reply = await getUselessFact();
                    }
                    else
                    {
                        reply = await callOpenAiApi(openaiKey, model, comment.text);
                    }
                    drafts[comment.id] = reply;
                } catch (e) {
                    console.error(`Error generating draft for comment ${comment.id}:`, e);
                }
            }

            fs.writeFileSync(draftsPath, JSON.stringify({ drafts: drafts }, null, 4), "utf8");
            return { success: true, drafts: drafts };
        }
        catch (err)
        {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle("generate-and-post-all-replies-ai", async function handleGenerateAndPostAllRepliesAi(_event, comments)
    {
        try
        {
            const settings = pathService.readSettings();
            const uploadOpts = (settings && settings.uploadOptions) || {};
            const accessToken = uploadOpts.metaAccessToken;
            const graphVersion = uploadOpts.metaGraphVersion || "v25.0";
            const openaiKey = process.env.OPENAI_API_KEY || "";

            if (!accessToken)
            {
                return { success: false, error: "Instagram Access Token is missing in settings." };
            }

            const model = uploadOpts.openaiModel || "gpt-4o-mini";
            const repoRoot = pathService.getRepoRoot();
            const draftsPath = path.join(repoRoot, ".ig_comments_drafts.json");
            
            let drafts = {};
            if (fs.existsSync(draftsPath))
            {
                try {
                    const data = JSON.parse(fs.readFileSync(draftsPath, "utf8"));
                    drafts = data.drafts || {};
                } catch (_) {}
            }

            const results = [];
            const postedCommentIds = [];

            for (const comment of comments)
            {
                let replyText = drafts[comment.id] || "";
                
                if (!replyText.trim())
                {
                    if (!openaiKey.trim())
                    {
                        results.push({ commentId: comment.id, success: false, error: "No API key and no existing draft." });
                        continue;
                    }
                    try {
                        if (isUnreadableComment(comment.text)) {
                            replyText = await getUselessFact();
                        } else {
                            replyText = await callOpenAiApi(openaiKey, model, comment.text);
                        }
                    } catch (e) {
                        results.push({ commentId: comment.id, success: false, error: `AI Gen failed: ${e.message}` });
                        continue;
                    }
                }

                try
                {
                    const encodedMessage = encodeURIComponent(replyText);
                    const targetId = comment.parentCommentId || comment.id;
                    const url = `https://graph.facebook.com/${graphVersion}/${targetId}/replies?message=${encodedMessage}&access_token=${accessToken}`;
                    
                    const response = await postUrl(url);
                    if (response.error)
                    {
                        results.push({ commentId: comment.id, success: false, error: response.error.message || "Meta API error" });
                    }
                    else
                    {
                        results.push({ commentId: comment.id, success: true, data: response, reply: replyText });
                        postedCommentIds.push(comment.id);
                    }
                }
                catch (e)
                {
                    results.push({ commentId: comment.id, success: false, error: e.message });
                }
            }

            if (postedCommentIds.length > 0)
            {
                postedCommentIds.forEach(id => {
                    delete drafts[id];
                });
                try {
                    fs.writeFileSync(draftsPath, JSON.stringify({ drafts: drafts }, null, 4), "utf8");
                } catch (_) {}
            }

            return { success: true, results: results, drafts: drafts };
        }
        catch (err)
        {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle("post-all-saved-drafts-ig", async function handlePostAllSavedDraftsIg(_event, comments)
    {
        try
        {
            const settings = pathService.readSettings();
            const uploadOpts = (settings && settings.uploadOptions) || {};
            const accessToken = uploadOpts.metaAccessToken;
            const graphVersion = uploadOpts.metaGraphVersion || "v25.0";

            if (!accessToken)
            {
                return { success: false, error: "Instagram Access Token is missing in settings." };
            }

            const repoRoot = pathService.getRepoRoot();
            const draftsPath = path.join(repoRoot, ".ig_comments_drafts.json");
            
            let drafts = {};
            if (fs.existsSync(draftsPath))
            {
                try {
                    const data = JSON.parse(fs.readFileSync(draftsPath, "utf8"));
                    drafts = data.drafts || {};
                } catch (_) {}
            }

            const results = [];
            const postedCommentIds = [];

            for (const comment of comments)
            {
                const replyText = drafts[comment.id] || "";
                
                if (!replyText.trim())
                {
                    continue;
                }

                try
                {
                    const encodedMessage = encodeURIComponent(replyText);
                    const targetId = comment.parentCommentId || comment.id;
                    const url = `https://graph.facebook.com/${graphVersion}/${targetId}/replies?message=${encodedMessage}&access_token=${accessToken}`;
                    
                    const response = await postUrl(url);
                    if (response.error)
                    {
                        results.push({ commentId: comment.id, success: false, error: response.error.message || "Meta API error" });
                    }
                    else
                    {
                        results.push({ commentId: comment.id, success: true, data: response, reply: replyText });
                        postedCommentIds.push(comment.id);
                    }
                }
                catch (e)
                {
                    results.push({ commentId: comment.id, success: false, error: e.message });
                }
            }

            if (postedCommentIds.length > 0)
            {
                postedCommentIds.forEach(id => {
                    delete drafts[id];
                });
                try {
                    fs.writeFileSync(draftsPath, JSON.stringify({ drafts: drafts }, null, 4), "utf8");
                } catch (_) {}
            }

            return { success: true, results: results, drafts: drafts };
        }
        catch (err)
        {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle("get-useless-fact", async function handleGetUselessFact()
    {
        try
        {
            const fact = await getUselessFact();
            return { success: true, fact: fact };
        }
        catch (err)
        {
            return { success: false, error: err.message };
        }
    });
}

async function getUselessFact() {
    try {
        const url = "https://uselessfacts.jsph.pl/api/v2/facts/random?language=en";
        const res = await fetchUrl(url);
        if (res && res.text) {
            return res.text;
        } else if (res && res.error) {
            console.error("Useless fact API error response:", res.error);
        }
    } catch (e) {
        console.error("Error fetching useless fact:", e);
    }
    // Fallback if API fails or returns invalid response
    const emojis = ['🎮', '🎯', '💀', '🔥', '🏆', '💣', '🔫', '⚡', '👑', '👾'];
    return emojis[Math.floor(Math.random() * emojis.length)];
}

function isUnreadableComment(text)
{
    if (!text || !text.trim()) return true;
    const lower = text.toLowerCase().trim();
    if (lower.includes("[gif]") || lower.includes("gif") || lower.startsWith("http://") || lower.startsWith("https://"))
    {
        return true;
    }
    const noEmojiText = text.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, "").trim();
    if (noEmojiText.length === 0)
    {
        return true;
    }
    return false;
}

function callOpenAiApi(apiKey, model, commentText)
{
    const https = require('https');
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            model: model || "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "You are a Valorant player who is funny, witty, and replies to comments in casual gamer/FPS slang (e.g. using terms like 'diff', 'clutch', 'whiff', 'hardstuck', 'peek', 'spray', 'aim labs'). Keep responses short (1-2 sentences max), highly contextual to the comment, and casual (lowercase, minimal punctuation). Avoid generic or corporate-sounding text. If the comment contains no text, is completely unreadable, or is a GIF, reply with a single gaming emoji."
                },
                {
                    role: "user",
                    content: `Comment: "${commentText}"`
                }
            ],
            temperature: 0.85,
            max_tokens: 60
        });

        const options = {
            hostname: 'api.openai.com',
            port: 443,
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(body);
                    if (response.choices && response.choices.length > 0) {
                        resolve(response.choices[0].message.content.trim().replace(/^"(.*)"$/, '$1'));
                    } else if (response.error) {
                        reject(new Error(response.error.message));
                    } else {
                        reject(new Error("Empty response from OpenAI API"));
                    }
                } catch (e) {
                    reject(new Error(`Failed to parse OpenAI response: ${body}`));
                }
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        req.write(postData);
        req.end();
    });
}

module.exports = {
    registerSystemHandlers: registerSystemHandlers
};
