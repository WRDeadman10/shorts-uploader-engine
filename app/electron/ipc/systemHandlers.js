function registerSystemHandlers(ipcMain, getMainWindow)
{
    ipcMain.handle("get-video-list", async function handleGetVideoList()
    {
        return [
            {
                id: "video-001",
                title: "Ace Clutch Compilation",
                duration: "00:28",
                status: "Ready for YouTube",
                thumbnail: "Gradient Preview",
                statuses: ["YT", "IG"]
            },
            {
                id: "video-002",
                title: "Operator Highlights",
                duration: "00:34",
                status: "Awaiting Facebook export",
                thumbnail: "Velocity Frame",
                statuses: ["YT", "FB"]
            },
            {
                id: "video-003",
                title: "Post-Plant Lineups",
                duration: "00:22",
                status: "Instagram package ready",
                thumbnail: "Arena Snapshot",
                statuses: ["IG", "FB"]
            }
        ];
    });

    ipcMain.handle("stream-log", async function handleStreamLog()
    {
        const mainWindow = getMainWindow();

        if (mainWindow && mainWindow.webContents)
        {
            mainWindow.webContents.send("app:log", {
                level: "info",
                message: "Mock upload log stream initialized."
            });
        }

        return {
            success: true,
            streaming: true
        };
    });
}

module.exports = {
    registerSystemHandlers: registerSystemHandlers
};
