const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { registerUploadHandlers } = require("./ipc/uploadHandlers");
const { registerSystemHandlers } = require("./ipc/systemHandlers");
const { getRendererEntryFile } = require("./services/pathService");

let mainWindow = null;

function createMainWindow()
{
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1180,
        minHeight: 760,
        backgroundColor: "#0f1117",
        title: "Content Command Center",
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    loadRenderer(mainWindow);
}

async function loadRenderer(windowInstance)
{
    const devServerUrl = process.env.VITE_DEV_SERVER_URL;

    if (devServerUrl)
    {
        await windowInstance.loadURL(devServerUrl);
        return;
    }

    await windowInstance.loadFile(getRendererEntryFile());
}

app.whenReady().then(function onAppReady()
{
    registerUploadHandlers(ipcMain, function getMainWindow()
    {
        return mainWindow;
    });
    registerSystemHandlers(ipcMain);

    createMainWindow();

    app.on("activate", function handleActivate()
    {
        if (BrowserWindow.getAllWindows().length === 0)
        {
            createMainWindow();
        }
    });
});

app.on("window-all-closed", function handleWindowAllClosed()
{
    if (process.platform !== "darwin")
    {
        app.quit();
    }
});
