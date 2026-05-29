const { app, BrowserWindow, ipcMain, Notification, protocol, net } = require("electron");
const path = require("path");
const { registerUploadHandlers } = require("./ipc/uploadHandlers");
const { registerSystemHandlers } = require("./ipc/systemHandlers");
const { registerToolHandlers } = require("./ipc/toolHandlers");
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

const { readSettings } = require("./services/pathService");

protocol.registerSchemesAsPrivileged([
    { scheme: 'local-video', privileges: { bypassCSP: true, stream: true, standard: true, supportFetchAPI: true, secure: true } }
]);

app.whenReady().then(function onAppReady()
{
    // Register custom protocol for local video preview
    protocol.handle("local-video", (request) => {
        try {
            const urlObj = new URL(request.url);
            // The path is encoded in the pathname after the first slash
            const filePath = decodeURIComponent(urlObj.pathname.substring(1));
            return net.fetch("file:///" + filePath);
        } catch (err) {
            console.error("local-video protocol error:", err);
            return new Response("Not found", { status: 404 });
        }
    });

    registerUploadHandlers(ipcMain, function getMainWindow()
    {
        return mainWindow;
    });
    registerSystemHandlers(ipcMain);
    registerToolHandlers(ipcMain, function getMainWindow() { return mainWindow; });

    createMainWindow();

    app.on("activate", function handleActivate()
    {
        if (BrowserWindow.getAllWindows().length === 0)
        {
            createMainWindow();
        }
    });

    ipcMain.handle("refresh-meta-token", async (event, userToken, pageId, graphVersion) => {
        try {
            const result = await new Promise((resolve) => {
                const https = require('https');
                const url = `https://graph.facebook.com/${graphVersion}/me/accounts?fields=id,name,access_token,instagram_business_account%7Bid,username%7D&access_token=${userToken}`;
                https.get(url, (res) => {
                    let data = '';
                    res.on('data', (chunk) => data += chunk);
                    res.on('end', () => {
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.error) {
                                resolve({ success: false, errorMessage: parsed.error.message || "Meta API error" });
                                return;
                            }
                            if (parsed.data) {
                                for (const account of parsed.data) {
                                    if (String(account.id) === String(pageId)) {
                                        resolve({ success: true, pageToken: account.access_token, igUserId: account.instagram_business_account ? account.instagram_business_account.id : "" });
                                        return;
                                    }
                                }
                            }
                            resolve({ success: false, errorMessage: "Could not find Page ID in the accounts returned." });
                        } catch (e) {
                            resolve({ success: false, errorMessage: "Failed to parse Meta API response" });
                        }
                    });
                }).on('error', (err) => {
                    resolve({ success: false, errorMessage: err.message });
                });
            });
            return result;
        } catch (e) {
            return { success: false, errorMessage: e.message };
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
