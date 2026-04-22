const toolService = require('../services/toolService');

function registerToolHandlers(ipcMain, getMainWindow) {
    toolService.attachWindowGetter(getMainWindow);

    ipcMain.handle('run-tool', async function handleRunTool(_event, payload) {
        return toolService.runTool(payload);
    });

    ipcMain.handle('stop-tool', async function handleStopTool(_event, payload) {
        return toolService.stopTool(payload && payload.sessionId);
    });

    ipcMain.handle('get-tool-status', async function handleGetToolStatus() {
        return toolService.getToolStatus();
    });

    ipcMain.handle('get-all-tool-statuses', async function handleGetAllToolStatuses() {
        return toolService.getAllToolStatuses();
    });
}

module.exports = { registerToolHandlers };
