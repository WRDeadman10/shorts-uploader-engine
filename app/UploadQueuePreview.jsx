import { useMemo, useEffect, useState } from 'react';

const PLATFORM_KEY = { youtube: 'yt', instagram: 'ig', facebook: 'fb' };

const STATUS_STYLE = {
    'TO BE UPLOADED': { background: '#1e293b', color: '#94a3b8', border: '1px solid #334155' },
    'UPLOADING':      { background: '#78350f', color: '#fbbf24', border: '1px solid #b45309' },
    'UPLOADED':       { background: '#064e3b', color: '#34d399', border: '1px solid #059669' },
};

function deriveStatuses(queue, logEntries, uploadStatus)
{
    const s = uploadStatus.status;
    if (s === 'idle')      return queue.map(() => 'TO BE UPLOADED');
    if (s === 'completed') return queue.map(() => 'UPLOADED');

    const logText = logEntries.map(function(e) { return e.message || ''; }).join('\n');

    return queue.map(function(video, index)
    {
        const name = video.fileName || video.title || '';
        if (!name) return 'TO BE UPLOADED';

        const seenHere = logText.includes(name);
        if (!seenHere) return 'TO BE UPLOADED';

        const laterSeen = queue.slice(index + 1).some(function(v)
        {
            return (v.fileName || v.title) && logText.includes(v.fileName || v.title);
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

function VideoCard({ video, index, status })
{
    const [thumbSrc, setThumbSrc] = useState(null);

    useEffect(function loadThumb()
    {
        if (!video.thumbnailPath || !window.api || !window.api.getThumbnail) return;
        let cancelled = false;

        window.api.getThumbnail(video.thumbnailPath).then(function(dataUrl)
        {
            if (!cancelled) setThumbSrc(dataUrl);
        });

        return function() { cancelled = true; };
    }, [video.thumbnailPath]);

    const style = STATUS_STYLE[status] || STATUS_STYLE['TO BE UPLOADED'];
    const hasMusic = video.musicTrack && video.musicTrack !== 'No Track';
    const displayName = video.fileName || video.title || '(untitled)';
    const relPath = video.relativePath || '';

    return (
        <div style={{
            display: 'flex', alignItems: 'stretch', gap: 0,
            borderRadius: 8, overflow: 'hidden',
            border: '1px solid #1e293b',
            background: '#0f172a',
        }}>
            {/* Thumbnail */}
            <div style={{
                width: 112, flexShrink: 0,
                background: '#1e293b',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
            }}>
                {thumbSrc
                    ? <img src={thumbSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    : <span style={{ fontSize: 11, color: '#4b5563', userSelect: 'none' }}>#{index + 1}</span>
                }
            </div>

            {/* Info */}
            <div style={{ flex: 1, padding: '10px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, minWidth: 0 }}>
                <span
                    title={displayName}
                    style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                    {displayName}
                </span>
                {relPath && (
                    <span
                        title={relPath}
                        style={{ fontSize: 11, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                        {relPath}
                    </span>
                )}
                {hasMusic && (
                    <span style={{ fontSize: 11, color: '#818cf8', background: '#1e1b4b', borderRadius: 4, padding: '1px 6px', alignSelf: 'flex-start' }}>
                        ♪ {video.musicTrack}
                    </span>
                )}
            </div>

            {/* Status */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px', flexShrink: 0 }}>
                <span style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
                    padding: '4px 10px', borderRadius: 4,
                    ...style,
                }}>
                    {status}
                </span>
            </div>
        </div>
    );
}

function UploadQueuePreview({ queue, logEntries, uploadStatus })
{
    const statuses = useMemo(
        function() { return deriveStatuses(queue, logEntries, uploadStatus); },
        [queue, logEntries, uploadStatus]
    );

    const uploadedCount  = statuses.filter(function(s) { return s === 'UPLOADED'; }).length;
    const uploadingCount = statuses.filter(function(s) { return s === 'UPLOADING'; }).length;

    return (
        <div className="upload-panel">
            <h2 className="upload-panel-title">
                Upload Queue
                <span style={{ marginLeft: 10, fontSize: 13, color: '#6b7280', fontWeight: 400 }}>
                    {queue.length} video{queue.length !== 1 ? 's' : ''}
                    {uploadedCount  > 0 && <span style={{ marginLeft: 8, color: '#34d399' }}>· {uploadedCount} uploaded</span>}
                    {uploadingCount > 0 && <span style={{ marginLeft: 8, color: '#fbbf24' }}>· uploading…</span>}
                </span>
            </h2>

            {queue.length === 0
                ? <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>No videos match the current filters.</p>
                : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 480, overflowY: 'auto' }}>
                        {queue.map(function(video, i)
                        {
                            return (
                                <VideoCard
                                    key={video.id || i}
                                    video={video}
                                    index={i}
                                    status={statuses[i]}
                                />
                            );
                        })}
                    </div>
                )
            }
        </div>
    );
}

export default UploadQueuePreview;
