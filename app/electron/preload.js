const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
    runUpload: function runUpload(payload)
    {
        return ipcRenderer.invoke("run-upload", payload);
    },
    stopUpload: function stopUpload(sessionId)
    {
        return ipcRenderer.invoke("stop-upload", sessionId ? { sessionId: sessionId } : undefined);
    },
    getAllUploadStatuses: function getAllUploadStatuses()
    {
        return ipcRenderer.invoke("get-all-upload-statuses");
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
    },
    runEnvCheck: function runEnvCheck() { return ipcRenderer.invoke('run-env-check'); },
    runTool: function runTool(payload) {
        return ipcRenderer.invoke('run-tool', payload);
    },
    stopTool: function stopTool(sessionId) {
        return ipcRenderer.invoke('stop-tool', sessionId ? { sessionId: sessionId } : undefined);
    },
    getToolStatus: function getToolStatus() {
        return ipcRenderer.invoke('get-tool-status');
    },
    getAllToolStatuses: function getAllToolStatuses() {
        return ipcRenderer.invoke('get-all-tool-statuses');
    },
    onSessions: function onSessions(callback) {
        var listener = function(_event, data) { callback(data); };
        ipcRenderer.on('app:sessions', listener);
        return function unsubscribe() { ipcRenderer.removeListener('app:sessions', listener); };
    },
    getAuditReport: function getAuditReport() {
        return ipcRenderer.invoke('get-audit-report');
    },
    getThumbnail: function getThumbnail(thumbPath)
    {
        return ipcRenderer.invoke("get-thumbnail", thumbPath);
    },
    showInFolder: function showInFolder(filePath)
    {
        return ipcRenderer.invoke("show-in-folder", filePath);
    },
    refreshMetaToken: function refreshMetaToken(userToken, pageId, graphVersion) {
        return ipcRenderer.invoke("refresh-meta-token", userToken, pageId, graphVersion);
    }
});
