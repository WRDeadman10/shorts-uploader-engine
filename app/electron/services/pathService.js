const fs = require("fs");
const path = require("path");

function getRepoRoot()
{
    return path.resolve(__dirname, "..", "..", "..");
}

function getRendererEntryFile()
{
    return path.join(getRepoRoot(), "dist", "index.html");
}

function resolveVideoRoot()
{
    const repoRoot = getRepoRoot();

    // 1. Highest priority: videosRoot saved in workflow settings (set by the user in the UI)
    try
    {
        const settings = readSettings();
        const configured = settings && settings.uploadOptions && settings.uploadOptions.videosRoot;
        if (configured && typeof configured === "string" && configured.trim() && fs.existsSync(configured.trim()))
        {
            return configured.trim();
        }
    }
    catch (_error)
    {
    }

    // 2. upload_status_report.json root_directory
    const reportPath = path.join(repoRoot, "upload_status_report.json");
    if (fs.existsSync(reportPath))
    {
        try
        {
            const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
            if (report && typeof report.root_directory === "string" && fs.existsSync(report.root_directory))
            {
                return report.root_directory;
            }
        }
        catch (_error)
        {
        }
    }

    // 3. Sibling VALORANT folder
    const siblingRoot = path.resolve(repoRoot, "..", "VALORANT");
    if (fs.existsSync(siblingRoot))
    {
        return siblingRoot;
    }

    return repoRoot;
}

function getSettingsPath()
{
    const repoRoot = getRepoRoot();
    return path.join(repoRoot, "settings.json");
}

function readSettings()
{
    const settingsPath = getSettingsPath();

    if (fs.existsSync(settingsPath))
    {
        try
        {
            return JSON.parse(fs.readFileSync(settingsPath, "utf8"));
        }
        catch (_error)
        {
            console.error("Failed to read settings file:", _error);
        }
    }

    return {};
}

function saveSettings(settings)
{
    const settingsPath = getSettingsPath();
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 4));
}

function readAuditReport()
{
    const repoRoot = getRepoRoot();
    const reportPath = path.join(repoRoot, "live_upload_audit", "upload_comparison.json");

    if (!fs.existsSync(reportPath))
    {
        return { success: false, errorMessage: "upload_comparison.json not found in live_upload_audit/" };
    }

    try
    {
        const data = JSON.parse(fs.readFileSync(reportPath, "utf8"));

        return {
            success: true,
            generatedAt: data.generated_at_utc,
            offlineCount: data.offline_count,
            platforms: {
                youtube: { uploaded: data.platforms.youtube.uploaded_count, notUploaded: data.platforms.youtube.not_uploaded_count },
                instagram: { uploaded: data.platforms.instagram.uploaded_count, notUploaded: data.platforms.instagram.not_uploaded_count },
                facebook: { uploaded: data.platforms.facebook.uploaded_count, notUploaded: data.platforms.facebook.not_uploaded_count }
            }
        };
    }
    catch (error)
    {
        return { success: false, errorMessage: "Failed to parse audit report: " + error.message };
    }
}

function getDetailedAuditReport()
{
    const repoRoot = getRepoRoot();
    const liveAuditDir = path.join(repoRoot, "live_upload_audit");
    const convertedDir = path.join(repoRoot, "converted_shorts");

    function readJsonFile(filePath, fallbackValue) {
        try {
            if (!fs.existsSync(filePath)) return fallbackValue;
            return JSON.parse(fs.readFileSync(filePath, "utf8"));
        } catch (_) {
            return fallbackValue;
        }
    }

    // 1. Load Live Audit Data
    const offlineVideos = readJsonFile(path.join(liveAuditDir, "offline_videos.json"), { entries: [] }).entries || [];
    const liveYt = readJsonFile(path.join(liveAuditDir, "youtube_uploaded_videos.json"), { entries: [] }).entries || [];
    const liveIg = readJsonFile(path.join(liveAuditDir, "instagram_uploaded_videos.json"), { entries: [] }).entries || [];
    const liveFb = readJsonFile(path.join(liveAuditDir, "facebook_uploaded_videos.json"), { entries: [] }).entries || [];

    // 2. Load Local Ledger Data
    const localYt = readJsonFile(path.join(repoRoot, ".youtube_uploaded_videos.json"), { entries: {} }).entries || {};
    const localIg = readJsonFile(path.join(repoRoot, ".instagram_uploaded_videos.json"), { entries: {} }).entries || {};
    const localFb = readJsonFile(path.join(repoRoot, ".facebook_uploaded_videos.json"), { entries: {} }).entries || {};
    const metaState = readJsonFile(path.join(repoRoot, ".meta_reels_upload_state.json"), { entries: {} }).entries || {};
    const ytState = readJsonFile(path.join(repoRoot, ".youtube_upload_state.json"), { uploaded: {} }).uploaded || {};

    const convertedFiles = new Set();
    try {
        if (fs.existsSync(convertedDir)) {
            const files = fs.readdirSync(convertedDir);
            for (const f of files) {
                convertedFiles.add(f);
            }
        }
    } catch (_) {}

    const allVideosMap = new Map();

    function getOrCreateEntry(stateKey, relativePath) {
        if (!allVideosMap.has(stateKey)) {
            let folderName = "Unknown";
            const parts = relativePath.split(/[/\\]/);
            if (parts.length > 1) {
                folderName = parts[parts.length - 2];
            } else if (parts.length === 1 && stateKey.includes('/')) {
                folderName = stateKey.split('/')[0];
            }

            allVideosMap.set(stateKey, {
                stateKey: stateKey,
                relativePath: relativePath,
                fileName: path.basename(relativePath),
                folderName: folderName,
                onDisk: false,
                hasConvertedShort: false,
                uploaded: { yt: false, ig: false, fb: false }
            });
        }
        return allVideosMap.get(stateKey);
    }

    // Process Offline Videos (On Disk)
    for (const entry of offlineVideos) {
        const stateKey = entry.state_key;
        if (!stateKey) continue;
        const v = getOrCreateEntry(stateKey, entry.relative_path || "");
        v.onDisk = true;
        v.absolutePath = entry.absolute_path;
        
        if (entry.file_stem) {
            let foundConverted = false;
            const searchStem = entry.file_stem.replace(/ /g, "_");
            for (const cf of convertedFiles) {
                if (cf.includes(searchStem) || cf.includes(entry.file_stem)) {
                    foundConverted = true;
                    break;
                }
            }
            v.hasConvertedShort = foundConverted;
        }
    }

    function markUploaded(stateKey, relativePath, platform) {
        if (!stateKey) return;
        const v = getOrCreateEntry(stateKey, relativePath || stateKey.split("|")[0]);
        v.uploaded[platform] = true;
    }

    for (const entry of liveYt) { if (entry.matched_state_key) markUploaded(entry.matched_state_key, entry.matched_relative_path || "", "yt"); }
    for (const entry of liveIg) { if (entry.matched_state_key) markUploaded(entry.matched_state_key, entry.matched_relative_path || "", "ig"); }
    for (const entry of liveFb) { if (entry.matched_state_key) markUploaded(entry.matched_state_key, entry.matched_relative_path || "", "fb"); }

    for (const [key, val] of Object.entries(localYt)) { markUploaded(key, val.relative_path || "", "yt"); }
    for (const [key, val] of Object.entries(ytState)) { markUploaded(key, val.relative_path || "", "yt"); }
    
    for (const [key, val] of Object.entries(localIg)) { 
        if ((val.status || "").toLowerCase() === "ok") markUploaded(key, val.relative_path || "", "ig"); 
    }
    for (const [key, val] of Object.entries(localFb)) { 
        if ((val.status || "").toLowerCase() === "ok") markUploaded(key, val.relative_path || "", "fb"); 
    }
    for (const [key, val] of Object.entries(metaState)) {
        if (val.instagram && (val.instagram.status || "").toLowerCase() === "ok") markUploaded(key, val.relative_path || "", "ig");
        if (val.facebook && (val.facebook.status || "").toLowerCase() === "ok") markUploaded(key, val.relative_path || "", "fb");
    }

    for (const v of allVideosMap.values()) {
        if (!v.onDisk && !v.hasConvertedShort) {
            const stem = path.basename(v.fileName, path.extname(v.fileName));
            const searchStem = stem.replace(/ /g, "_");
            for (const cf of convertedFiles) {
                if (cf.includes(searchStem) || cf.includes(stem)) {
                    v.hasConvertedShort = true;
                    break;
                }
            }
        }
    }

    return {
        success: true,
        rows: Array.from(allVideosMap.values())
    };
}

module.exports = {
    getRepoRoot: getRepoRoot,
    getRendererEntryFile: getRendererEntryFile,
    resolveVideoRoot: resolveVideoRoot,
    readSettings: readSettings,
    saveSettings: saveSettings,
    readAuditReport: readAuditReport,
    getDetailedAuditReport: getDetailedAuditReport
};
