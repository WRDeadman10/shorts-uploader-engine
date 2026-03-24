function registerUploadHandlers(ipcMain)
{
    ipcMain.handle("run-upload", async function handleRunUpload(_event, payload)
    {
        return {
            success: true,
            status: "queued",
            progress: 12,
            platform: payload && payload.platforms ? Object.keys(payload.platforms).filter(function filterEnabledPlatform(key)
            {
                return payload.platforms[key];
            }).join(",") : "youtube",
            uploadId: "mock-upload-001",
            receivedPayload: payload || null
        };
    });

    ipcMain.handle("stop-upload", async function handleStopUpload()
    {
        return {
            success: true,
            status: "stopped",
            progress: 0,
            uploadId: "mock-upload-001"
        };
    });

    ipcMain.handle("get-upload-status", async function handleGetUploadStatus()
    {
        return {
            uploadId: "mock-upload-001",
            status: "idle",
            progress: 0,
            platform: "youtube"
        };
    });
}

module.exports = {
    registerUploadHandlers: registerUploadHandlers
};
