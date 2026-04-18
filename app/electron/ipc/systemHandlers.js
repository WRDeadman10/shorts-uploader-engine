const dataService = require("../services/dataService");
const uploadService = require("../services/uploadService");
const { spawnSync } = require("child_process");
const pythonService = require("../services/pythonService");
const pathService = require("../services/pathService");
const fs = require('fs');
const path = require('path');

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
}

module.exports = {
    registerSystemHandlers: registerSystemHandlers
};
