const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { registerUploadHandlers } = require("./ipc/uploadHandlers");
const { registerSystemHandlers } = require("./ipc/systemHandlers");

let mainWindow = null;

function createMainWindow()
{
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 900,
        backgroundColor: "#0f1117",
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            nodeIntegration: false,
            contextIsolation: true
        }
    });
}

app.whenReady().then(function onAppReady()
{
    registerUploadHandlers(ipcMain);
    registerSystemHandlers(ipcMain, function getMainWindow()
    {
        return mainWindow;
    });

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
