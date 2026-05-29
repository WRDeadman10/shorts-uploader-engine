const path = require('path');
const { spawn } = require('child_process');
const { Notification } = require('electron');
const { getRepoRoot } = require('./pathService');
const { resolvePythonCommand } = require('./pythonService');

const ANSI_ESCAPE_RE = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

let getMainWindow = null;

// sessionId → { process, logBuffer, status }
const sessions = new Map();

function attachWindowGetter(windowGetter) {
    getMainWindow = windowGetter;
}

function getAllToolStatuses() {
    return Array.from(sessions.values()).map(function(s) { return s.status; });
}

function getToolStatus() {
    // Backward compat: return most recent running, or last, or idle
    const all = getAllToolStatuses();
    if (all.length === 0) return { success: true, toolName: '', status: 'idle', pid: 0, errorMessage: '', startedAt: '', completedAt: '' };
    const running = all.filter(function(s) { return s.status === 'running'; });
    if (running.length > 0) return running[running.length - 1];
    return all[all.length - 1];
}

function pushLog(sessionId, stream, message) {
    const session = sessions.get(sessionId);
    const bufLen = session ? session.logBuffer.length : 0;
    const entry = {
        id: String(Date.now()) + '-' + String(bufLen + 1),
        sessionId: sessionId,
        sessionType: 'tool',
        timestamp: new Date().toISOString(),
        stream: stream,
        message: message
    };
    if (session) {
        session.logBuffer.push(entry);
        if (session.logBuffer.length > 500) session.logBuffer = session.logBuffer.slice(-500);
    }
    const win = getMainWindow ? getMainWindow() : null;
    if (win && !win.isDestroyed() && win.webContents) {
        win.webContents.send('app:log', entry);
    }
}

function broadcastStatuses() {
    const win = getMainWindow ? getMainWindow() : null;
    if (win && !win.isDestroyed() && win.webContents) {
        win.webContents.send('app:sessions', { tool: getAllToolStatuses() });
    }
}

async function runTool(payload) {
    // No "already running" guard — allow multiple concurrent tool sessions
    const { toolName, args = [] } = payload || {};
    if (!toolName) {
        return { success: false, errorMessage: 'toolName is required.' };
    }
    const pythonCommand = resolvePythonCommand();
    const sessionId = String(Date.now());

    if (!pythonCommand.found) {
        const errStatus = { success: false, sessionId, toolName, status: 'error', errorMessage: 'Python not found.', pid: 0, startedAt: new Date().toISOString(), completedAt: new Date().toISOString() };
        sessions.set(sessionId, { process: null, logBuffer: [], status: errStatus });
        pushLog(sessionId, 'system', 'Python not found.');
        broadcastStatuses();
        return errStatus;
    }

    const repoRoot = getRepoRoot();
    const scriptPath = path.join(repoRoot, toolName);
    const sessionStatus = { success: true, sessionId, toolName, status: 'running', pid: 0, errorMessage: '', startedAt: new Date().toISOString(), completedAt: '' };
    const session = { process: null, logBuffer: [], status: sessionStatus };
    sessions.set(sessionId, session);

    pushLog(sessionId, 'system', '[tool] Starting ' + toolName + ' ' + args.join(' '));
    const proc = spawn(pythonCommand.command, [scriptPath, ...args], {
        cwd: repoRoot,
        windowsHide: true,
        env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1', PYTHONUNBUFFERED: '1' }),
    });
    session.process = proc;
    session.status.pid = proc.pid || 0;
    broadcastStatuses();

    proc.stdout.on('data', function onStdout(chunk) {
        const lines = chunk.toString().split(/\r?\n/);
        lines.forEach(function(l) {
            const cleaned = l.replace(ANSI_ESCAPE_RE, '').trimEnd();
            if (cleaned.trim()) pushLog(sessionId, 'stdout', cleaned);
        });
    });
    proc.stderr.on('data', function onStderr(chunk) {
        const lines = chunk.toString().split(/\r?\n/);
        lines.forEach(function(l) {
            const cleaned = l.replace(ANSI_ESCAPE_RE, '').trimEnd();
            if (cleaned.trim()) pushLog(sessionId, 'stderr', cleaned);
        });
    });
    proc.on('close', function onClose(code) {
        session.process = null;
        session.status = Object.assign({}, session.status, {
            status: code === 0 ? 'done' : 'error',
            success: code === 0,
            errorMessage: code === 0 ? '' : 'Exit code ' + code,
            pid: 0,
            completedAt: new Date().toISOString()
        });
        pushLog(sessionId, 'system', '[tool] ' + toolName + ' finished with code ' + code);
        broadcastStatuses();
        
        if (Notification.isSupported()) {
            new Notification({
                title: "Tool " + (code === 0 ? "Completed" : "Failed"),
                body: toolName + " finished with code " + code
            }).show();
        }
    });
    return session.status;
}

function stopTool(sessionId) {
    if (sessionId) {
        const session = sessions.get(sessionId);
        if (!session || !session.process) return getAllToolStatuses();
        session.process.kill();
        session.process = null;
        session.status = Object.assign({}, session.status, { status: 'stopped', pid: 0, completedAt: new Date().toISOString() });
        pushLog(sessionId, 'system', 'Tool manually stopped.');
    } else {
        // Stop all running tools
        sessions.forEach(function(session) {
            if (session.process) {
                session.process.kill();
                session.process = null;
                session.status = Object.assign({}, session.status, { status: 'stopped', pid: 0, completedAt: new Date().toISOString() });
                pushLog(session.status.sessionId, 'system', 'Tool manually stopped.');
            }
        });
    }
    broadcastStatuses();
    return getAllToolStatuses();
}

module.exports = { attachWindowGetter, runTool, stopTool, getToolStatus, getAllToolStatuses };
