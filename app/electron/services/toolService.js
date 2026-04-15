const path = require('path');
const { spawn } = require('child_process');
const { getRepoRoot } = require('./pathService');
const { resolvePythonCommand } = require('./pythonService');

let getMainWindow = null;
let activeProcess = null;
let status = createInitialStatus();

function createInitialStatus() {
    return {
        success: true,
        toolName: '',
        status: 'idle',
        pid: 0,
        errorMessage: '',
        startedAt: '',
        completedAt: ''
    };
}

function attachWindowGetter(windowGetter) {
    getMainWindow = windowGetter;
}

function getToolStatus() {
    return { ...status, hasActiveProcess: Boolean(activeProcess) };
}

function sendLog(type, message, source = 'system') {
    const win = getMainWindow ? getMainWindow() : null;
    if (win && !win.isDestroyed()) {
        win.webContents.send('app:log', { type, message, source, ts: new Date().toISOString() });
    }
}

async function runTool(payload) {
    if (activeProcess) {
        return { ...getToolStatus(), success: false, errorMessage: 'A tool is already running.' };
    }
    const { toolName, args = [] } = payload || {};
    if (!toolName) {
        return { ...getToolStatus(), success: false, errorMessage: 'toolName is required.' };
    }
    const pythonCommand = resolvePythonCommand();
    if (!pythonCommand.found) {
        status = { ...createInitialStatus(), success: false, status: 'error', errorMessage: 'Python not found.', toolName };
        sendLog('error', 'Python not found.', toolName);
        return getToolStatus();
    }
    const repoRoot = getRepoRoot();
    const scriptPath = path.join(repoRoot, toolName);
    status = { ...createInitialStatus(), toolName, status: 'running', startedAt: new Date().toISOString(), pid: 0 };
    sendLog('info', '[tool] Starting ' + toolName + ' ' + args.join(' '), toolName);
    const proc = spawn(pythonCommand.command, [scriptPath, ...args], { cwd: repoRoot, env: process.env });
    activeProcess = proc;
    status.pid = proc.pid;
    proc.stdout.on('data', function onStdout(chunk) {
        sendLog('stdout', chunk.toString(), toolName);
    });
    proc.stderr.on('data', function onStderr(chunk) {
        sendLog('error', chunk.toString(), toolName);
    });
    proc.on('close', function onClose(code) {
        activeProcess = null;
        status = {
            ...status,
            status: code === 0 ? 'done' : 'error',
            success: code === 0,
            errorMessage: code === 0 ? '' : 'Exit code ' + code,
            completedAt: new Date().toISOString()
        };
        sendLog('info', '[tool] ' + toolName + ' finished with code ' + code, toolName);
    });
    return getToolStatus();
}

function stopTool() {
    if (!activeProcess) {
        return { ...getToolStatus(), success: false, errorMessage: 'No tool running.' };
    }
    activeProcess.kill();
    activeProcess = null;
    status = { ...status, status: 'stopped', completedAt: new Date().toISOString() };
    sendLog('warn', 'Tool manually stopped.', 'system');
    return getToolStatus();
}

module.exports = { attachWindowGetter, runTool, stopTool, getToolStatus };
