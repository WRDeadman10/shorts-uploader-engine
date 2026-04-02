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

module.exports = {
    getRepoRoot: getRepoRoot,
    getRendererEntryFile: getRendererEntryFile,
    resolveVideoRoot: resolveVideoRoot
};
