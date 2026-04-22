const uploadService = require("../services/uploadService");

function registerUploadHandlers(ipcMain, getMainWindow)
{
    uploadService.attachWindowGetter(getMainWindow);

    ipcMain.handle("run-upload", async function handleRunUpload(_event, payload)
    {
        return uploadService.runUpload(payload);
    });

    ipcMain.handle("stop-upload", async function handleStopUpload(_event, payload)
    {
        return uploadService.stopUpload(payload && payload.sessionId);
    });

    ipcMain.handle("get-upload-status", async function handleGetUploadStatus()
    {
        return uploadService.getUploadStatus();
    });

    ipcMain.handle("get-all-upload-statuses", async function handleGetAllUploadStatuses()
    {
        return uploadService.getAllStatuses();
    });
}

module.exports = {
    registerUploadHandlers: registerUploadHandlers
};
