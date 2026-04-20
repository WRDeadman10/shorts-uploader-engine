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

module.exports = {
    getRepoRoot: getRepoRoot,
    getRendererEntryFile: getRendererEntryFile,
    resolveVideoRoot: resolveVideoRoot,
    readSettings: readSettings,
    saveSettings: saveSettings,
    readAuditReport: readAuditReport
};
