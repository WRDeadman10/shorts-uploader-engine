const dataService = require("../services/dataService");
const uploadService = require("../services/uploadService");

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

    ipcMain.handle("save-workflow-settings", async function handleSaveWorkflowSettings(settings)
    {
        return dataService.saveWorkflowSettings(settings);
    });
}

module.exports = {
    registerSystemHandlers: registerSystemHandlers
};
