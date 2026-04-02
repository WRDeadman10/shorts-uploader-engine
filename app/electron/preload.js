const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
    runUpload: function runUpload(payload)
    {
        return ipcRenderer.invoke("run-upload", payload);
    },
    stopUpload: function stopUpload()
    {
        return ipcRenderer.invoke("stop-upload");
    },
    getVideoList: function getVideoList()
    {
        return ipcRenderer.invoke("get-video-list");
    },
    getUploadStatus: function getUploadStatus()
    {
        return ipcRenderer.invoke("get-upload-status");
    },
    streamLog: function streamLog()
    {
        return ipcRenderer.invoke("stream-log");
    },
    onLog: function onLog(callback)
    {
        const listener = function handleLogEvent(_event, message)
        {
            callback(message);
        };

        ipcRenderer.on("app:log", listener);

        return function unsubscribe()
        {
            ipcRenderer.removeListener("app:log", listener);
        };
    },
    loadWorkflowSettings: function loadWorkflowSettings()
    {
        return ipcRenderer.invoke("load-workflow-settings");
    },
    saveWorkflowSettings: function saveWorkflowSettings(settings)
    {
        return ipcRenderer.invoke("save-workflow-settings", settings);
    }
});
