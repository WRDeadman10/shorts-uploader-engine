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
    const reportPath = path.join(repoRoot, "upload_status_report.json");
    const siblingRoot = path.resolve(repoRoot, "..", "VALORANT");

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

module.exports = {
    getRepoRoot: getRepoRoot,
    getRendererEntryFile: getRendererEntryFile,
    resolveVideoRoot: resolveVideoRoot,
    readSettings: readSettings,
    saveSettings: saveSettings
};
