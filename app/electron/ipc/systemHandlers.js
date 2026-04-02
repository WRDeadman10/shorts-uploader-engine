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
}

module.exports = {
    registerSystemHandlers: registerSystemHandlers
};
