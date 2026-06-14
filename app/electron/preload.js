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
    getDetailedAuditReport: function getDetailedAuditReport() {
        return ipcRenderer.invoke('get-detailed-audit-report');
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
    },
    getTokenHealth: function getTokenHealth() {
        return ipcRenderer.invoke("get-token-health");
    },
    getDiskUsage: function getDiskUsage() {
        return ipcRenderer.invoke("get-disk-usage");
    },
    backupState: function backupState() {
        return ipcRenderer.invoke("backup-state");
    },
    restoreState: function restoreState() {
        return ipcRenderer.invoke("restore-state");
    },
    getIgComments: function getIgComments(options) {
        return ipcRenderer.invoke("get-ig-comments", options);
    },
    replyToIgComment: function replyToIgComment(commentId, message, parentCommentId) {
        return ipcRenderer.invoke("reply-to-ig-comment", { commentId, message, parentCommentId });
    },
    getIgCommentsState: function getIgCommentsState() {
        return ipcRenderer.invoke("get-ig-comments-state");
    },
    markIgCommentsRead: function markIgCommentsRead(commentIds) {
        return ipcRenderer.invoke("mark-ig-comments-read", commentIds);
    },
    markIgCommentsUnread: function markIgCommentsUnread(commentIds) {
        return ipcRenderer.invoke("mark-ig-comments-unread", commentIds);
    },
    markAllIgCommentsRead: function markAllIgCommentsRead(commentIds) {
        return ipcRenderer.invoke("mark-all-ig-comments-read", commentIds);
    },
    markIgCommentsNoReply: function markIgCommentsNoReply(commentIds) {
        return ipcRenderer.invoke("mark-ig-comments-no-reply", commentIds);
    },
    unmarkIgCommentsNoReply: function unmarkIgCommentsNoReply(commentIds) {
        return ipcRenderer.invoke("unmark-ig-comments-no-reply", commentIds);
    },
    getIgCommentsDrafts: function getIgCommentsDrafts() {
        return ipcRenderer.invoke("get-ig-comments-drafts");
    },
    saveIgCommentDraft: function saveIgCommentDraft(commentId, draftText) {
        return ipcRenderer.invoke("save-ig-comment-draft", { commentId, draftText });
    },
    deleteIgCommentDraft: function deleteIgCommentDraft(commentId) {
        return ipcRenderer.invoke("delete-ig-comment-draft", commentId);
    },
    generateIgCommentReplyAi: function generateIgCommentReplyAi(commentId, commentText) {
        return ipcRenderer.invoke("generate-ig-comment-reply-ai", { commentId, commentText });
    },
    generateAllUnrepliedDraftsAi: function generateAllUnrepliedDraftsAi(comments) {
        return ipcRenderer.invoke("generate-all-unreplied-drafts-ai", comments);
    },
    generateAndPostAllRepliesAi: function generateAndPostAllRepliesAi(comments) {
        return ipcRenderer.invoke("generate-and-post-all-replies-ai", comments);
    },
    postAllSavedDraftsIg: function postAllSavedDraftsIg(comments) {
        return ipcRenderer.invoke("post-all-saved-drafts-ig", comments);
    },
    getUselessFact: function getUselessFact() {
        return ipcRenderer.invoke("get-useless-fact");
    },
    getVideoFileUrl: function getVideoFileUrl(filePath) {
        if (!filePath) return "";
        // Safely pass the path as a URI component
        return "local-video://local/" + encodeURIComponent(filePath.replace(/\\/g, '/'));
    }
});
