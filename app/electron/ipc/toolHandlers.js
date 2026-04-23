const toolService = require('../services/toolService');

function registerToolHandlers(ipcMain, getMainWindow) {
    toolService.attachWindowGetter(getMainWindow);

    ipcMain.handle('run-tool', async function handleRunTool(_event, payload) {
        return toolService.runTool(payload);
    });

    ipcMain.handle('stop-tool', async function handleStopTool() {
        return toolService.stopTool();
    });

    ipcMain.handle('get-tool-status', async function handleGetToolStatus() {
        return toolService.getToolStatus();
    });
}

module.exports = { registerToolHandlers };
