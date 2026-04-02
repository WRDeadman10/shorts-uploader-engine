const uploadService = require("../services/uploadService");

function registerUploadHandlers(ipcMain, getMainWindow)
{
    uploadService.attachWindowGetter(getMainWindow);

    ipcMain.handle("run-upload", async function handleRunUpload(_event, payload)
    {
        return uploadService.runUpload(payload);
    });

    ipcMain.handle("stop-upload", async function handleStopUpload()
    {
        return uploadService.stopUpload();
    });

    ipcMain.handle("get-upload-status", async function handleGetUploadStatus()
    {
        return uploadService.getUploadStatus();
    });
}

module.exports = {
    registerUploadHandlers: registerUploadHandlers
};
