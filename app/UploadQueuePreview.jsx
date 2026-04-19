import { useMemo } from 'react';

const PLATFORM_KEY = { youtube: 'yt', instagram: 'ig', facebook: 'fb' };

const STATUS_STYLE = {
    'TO BE UPLOADED': { background: '#1e293b', color: '#94a3b8' },
    'UPLOADING':      { background: '#78350f', color: '#fbbf24' },
    'UPLOADED':       { background: '#064e3b', color: '#34d399' },
};

// Derive per-video statuses from log entries and overall upload status.
// Strategy: if a video's title appears in the logs and a *later* video also
// appears, this one is done. If it appears and no later one does, it's the
// active one. If it never appears, it's still waiting.
function deriveStatuses(queue, logEntries, uploadStatus)
{
    const s = uploadStatus.status;

    if (s === 'idle')      return queue.map(() => 'TO BE UPLOADED');
    if (s === 'completed') return queue.map(() => 'UPLOADED');

    // 'running' | 'error' | 'stopped' — derive from log content
    const logText = logEntries.map(function(e) { return e.message || ''; }).join('\n');

    return queue.map(function(video, index)
    {
        if (!video.title) return 'TO BE UPLOADED';

        const seenHere = logText.includes(video.title);
        if (!seenHere) return 'TO BE UPLOADED';

        // Any later queue item already mentioned → this one finished
        const laterSeen = queue.slice(index + 1).some(function(v)
        {
            return v.title && logText.includes(v.title);
        });

        if (laterSeen) return 'UPLOADED';
        return s === 'running' ? 'UPLOADING' : 'UPLOADED';
    });
}

export function computeUploadQueue(videoList, options)
{
    let filtered = videoList;

    const uploadedOn = (options.requireUploadedOn || '').trim().toLowerCase();
    const missingOn  = (options.requireMissingOn  || '').trim().toLowerCase();

    if (uploadedOn && PLATFORM_KEY[uploadedOn])
    {
        const key = PLATFORM_KEY[uploadedOn];
        filtered = filtered.filter(function(v) { return v[key]; });
    }

    if (missingOn && PLATFORM_KEY[missingOn])
    {
        const key = PLATFORM_KEY[missingOn];
        filtered = filtered.filter(function(v) { return !v[key]; });
    }

    const max = Math.max(1, Math.round(Number(options.maxVideos) || 1));
    return filtered.slice(0, max);
}

function UploadQueuePreview({ queue, logEntries, uploadStatus })
{
    const statuses = useMemo(
        function() { return deriveStatuses(queue, logEntries, uploadStatus); },
        [queue, logEntries, uploadStatus]
    );

    const uploadedCount = statuses.filter(function(s) { return s === 'UPLOADED'; }).length;
    const uploadingCount = statuses.filter(function(s) { return s === 'UPLOADING'; }).length;

    return (
        <div className="upload-panel">
            <h2 className="upload-panel-title">
                Upload Queue
                <span style={{ marginLeft: 10, fontSize: 13, color: '#6b7280', fontWeight: 400 }}>
                    {queue.length} video{queue.length !== 1 ? 's' : ''}
                    {uploadedCount > 0 && (
                        <span style={{ marginLeft: 8, color: '#34d399' }}>· {uploadedCount} uploaded</span>
                    )}
                    {uploadingCount > 0 && (
                        <span style={{ marginLeft: 8, color: '#fbbf24' }}>· uploading…</span>
                    )}
                </span>
            </h2>

            {queue.length === 0 ? (
                <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>
                    No videos match the current filters. Adjust Max Videos, Require Uploaded On, or Require Missing On.
                </p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 380, overflowY: 'auto' }}>
                    {queue.map(function(video, i)
                    {
                        const status = statuses[i];
                        const style  = STATUS_STYLE[status] || STATUS_STYLE['TO BE UPLOADED'];
                        const hasMusic = video.musicTrack && video.musicTrack !== 'No Track';

                        return (
                            <div key={video.id || i} style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '7px 10px', borderRadius: 6,
                                background: '#0f172a', border: '1px solid #1e293b',
                            }}>
                                <span style={{ minWidth: 22, textAlign: 'right', fontSize: 12, color: '#4b5563', flexShrink: 0 }}>
                                    {i + 1}
                                </span>

                                <span
                                    title={video.title}
                                    style={{
                                        flex: 1, fontSize: 13, color: '#e2e8f0',
                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }}
                                >
                                    {video.title || '(untitled)'}
                                </span>

                                {hasMusic && (
                                    <span style={{
                                        fontSize: 11, color: '#818cf8', background: '#1e1b4b',
                                        borderRadius: 4, padding: '2px 7px',
                                        whiteSpace: 'nowrap', flexShrink: 0,
                                    }}>
                                        ♪ {video.musicTrack}
                                    </span>
                                )}

                                <span style={{
                                    fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                                    padding: '3px 8px', borderRadius: 4,
                                    whiteSpace: 'nowrap', flexShrink: 0,
                                    ...style,
                                }}>
                                    {status}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default UploadQueuePreview;
