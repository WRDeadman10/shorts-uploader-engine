const dataService = require("../services/dataService");
const uploadService = require("../services/uploadService");
const { spawnSync } = require("child_process");
const pythonService = require("../services/pythonService");

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

    ipcMain.handle("run-env-check", async function handleRunEnvCheck(_event)
    {
        const pythonResult = await pythonService.resolvePythonCommand();
        const ffmpegResult = spawnSync('ffmpeg', ['-version'], { windowsHide: true });
        const ffprobeResult = spawnSync('ffprobe', ['-version'], { windowsHide: true });

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
            }
        };
    });
}

module.exports = {
    registerSystemHandlers: registerSystemHandlers
};
