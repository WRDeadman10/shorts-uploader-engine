import React, { useState } from 'react';
import { useAppStore } from './useAppStore.js';

export default function Setup() {
    const { envCheckResult, runEnvCheck } = useAppStore();
    const [checking, setChecking] = useState(false);

    async function handleCheck() {
        setChecking(true);
        await runEnvCheck();
        setChecking(false);
    }

    return (
        <div className='page-content'>
            <h1>Environment Setup</h1>
            <button onClick={handleCheck} disabled={checking}>
                {checking ? 'Checking...' : 'Run Check'}
            </button>
            {envCheckResult !== null && (
                <ul>
                    <li>{envCheckResult.python.found ? 'Python: found' : 'Python: not found'}</li>
                    <li>{envCheckResult.ffmpeg.found ? `ffmpeg: found (${envCheckResult.ffmpeg.version})` : 'ffmpeg: not found'}</li>
                    <li>{envCheckResult.ffprobe.found ? `ffprobe: found (${envCheckResult.ffprobe.version})` : 'ffprobe: not found'}</li>
                </ul>
            )}
            {envCheckResult === null && (
                <p>Click Run Check to verify your environment.</p>
            )}
        </div>
    );
}
