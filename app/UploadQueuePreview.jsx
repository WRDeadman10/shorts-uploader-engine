import { useMemo, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import StatusBadge from './StatusBadge.jsx';

const PLATFORM_KEY = { youtube: 'yt', instagram: 'ig', facebook: 'fb' };

const QUEUE_BORDER = {
    'TO BE UPLOADED': '1px solid var(--border)',
    'UPLOADING':      '2px solid #f59e0b',
    'UPLOADED':       '1px solid #059669',
};

const QUEUE_GLOW = {
    'TO BE UPLOADED': 'none',
    'UPLOADING':      '0 0 16px rgba(245,158,11,0.35)',
    'UPLOADED':       '0 0 8px rgba(5,150,105,0.25)',
};

const CARD_BG = {
    'TO BE UPLOADED': 'linear-gradient(180deg, rgba(26,29,36,0.98), rgba(20,24,33,0.98))',
    'UPLOADING':      'linear-gradient(180deg, rgba(120,53,15,0.45) 0%, rgba(20,24,33,0.98) 60%)',
    'UPLOADED':       'linear-gradient(180deg, rgba(6,78,59,0.35) 0%, rgba(20,24,33,0.98) 60%)',
};

const STATUS_PILL = {
    'TO BE UPLOADED': { background: '#1e293b', color: '#94a3b8' },
    'UPLOADING':      { background: '#92400e', color: '#fbbf24' },
    'UPLOADED':       { background: '#064e3b', color: '#34d399' },
};

// Normalize path separators to forward-slash for comparison.
function normPath(p) { return (p || '').replace(/\\/g, '/').trim(); }

// Matches "[ok][instagram]", "[ok][facebook]", "[ok] uploaded:", "[error][platform]", "[fatal]"
// These are the immediate completion signals the script emits after each video.
const RE_PROCESSING = /\[\d+\/\d+\] processing:\s*(.+)/;
const RE_COMPLETE    = /\[ok\]\[|\[ok\] uploaded:|\[error\]\[|\[fatal\]/;

// Parse log entries into:
//   completedPaths – videos that emitted [ok]/[error]/[fatal] after their processing line
//   uploadingPath  – the current video being processed (started but not yet complete)
function parseProcessingLog(logEntries)
{
    const completedPaths = new Set();
    let currentPath = null;
    let currentDone  = false;

    for (const entry of logEntries)
    {
        const msg = entry.message || '';

        const mStart = msg.match(RE_PROCESSING);
        if (mStart)
        {
            // Starting a new video — previous one is implicitly done if not already marked
            currentPath = normPath(mStart[1]);
            currentDone  = false;
            continue;
        }

        // Completion signal for the current video
        if (currentPath && !currentDone && RE_COMPLETE.test(msg))
        {
            completedPaths.add(currentPath);
            currentDone = true;
        }
    }

    // If the current video hasn't received a completion line yet it is still uploading
    const uploadingPath = (currentPath && !currentDone) ? currentPath : null;

    return { completedPaths, uploadingPath };
}

function deriveStatuses(queue, logEntries, uploadStatus)
{
    const s = uploadStatus.status;
    if (s === 'idle') return queue.map(() => 'TO BE UPLOADED');

    const { completedPaths, uploadingPath } = parseProcessingLog(logEntries);

    // Run finished with no log data — mark everything uploaded
    if (s === 'completed' && completedPaths.size === 0 && !uploadingPath)
        return queue.map(() => 'UPLOADED');

    return queue.map(function(video)
    {
        const key = normPath(video.relativePath || video.fileName || video.title || '');
        if (!key) return 'TO BE UPLOADED';
        if (completedPaths.has(key)) return 'UPLOADED';
        if (key === uploadingPath && s === 'running') return 'UPLOADING';
        return 'TO BE UPLOADED';
    });
}

export function computeUploadQueue(videoList, options, platforms)
{
    let filtered = videoList;

    const uploadedOn = (options.requireUploadedOn || '').trim().toLowerCase();
    const missingOn  = (options.requireMissingOn  || '').trim().toLowerCase();

    if (uploadedOn && PLATFORM_KEY[uploadedOn])
        filtered = filtered.filter(v => v[PLATFORM_KEY[uploadedOn]]);

    if (missingOn && PLATFORM_KEY[missingOn])
    {
        filtered = filtered.filter(v => !v[PLATFORM_KEY[missingOn]]);
    }
    else if (!missingOn && platforms)
    {
        // Auto-filter: exclude videos already uploaded on ALL selected platforms
        const selected = Object.keys(PLATFORM_KEY).filter(p => platforms[p]);
        if (selected.length > 0)
            filtered = filtered.filter(v => selected.every(p => !v[PLATFORM_KEY[p]]));
    }

    const max = Math.max(1, Math.round(Number(options.maxVideos) || 1));
    return filtered.slice(0, max);
}

function QueueCard({ video, index, queueStatus })
{
    const [thumbSrc, setThumbSrc] = useState(null);

    useEffect(function loadThumb()
    {
        if (!video.thumbnailPath || !window.api?.getThumbnail) return;
        let cancelled = false;
        window.api.getThumbnail(video.thumbnailPath).then(url => { if (!cancelled) setThumbSrc(url); });
        return () => { cancelled = true; };
    }, [video.thumbnailPath]);

    const folderName  = video.thumbnail || '';          // path.basename of parent dir
    const fileName    = video.fileName  || '';          // disk filename e.g. clip_01.mp4
    const relPath     = video.relativePath || '';
    const title       = video.title    || fileName;
    const hasMusic    = video.musicTrack && video.musicTrack !== 'No Track';
    const pill        = STATUS_PILL[queueStatus] || STATUS_PILL['TO BE UPLOADED'];

    const isUploading = queueStatus === 'UPLOADING';

    return (
        <motion.article
            className="library-card"
            style={{
                border: QUEUE_BORDER[queueStatus],
                boxShadow: QUEUE_GLOW[queueStatus],
                background: CARD_BG[queueStatus],
            }}
            animate={isUploading ? { boxShadow: ['0 0 8px rgba(245,158,11,0.2)', '0 0 24px rgba(245,158,11,0.55)', '0 0 8px rgba(245,158,11,0.2)'] } : {}}
            transition={isUploading ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.18, ease: 'easeOut' }}
            whileHover={!isUploading ? { y: -4, scale: 1.01 } : {}}
        >
            {/* Media area — thumbnail */}
            <div className="library-card-media" style={{ position: 'relative', minHeight: 130, padding: 12 }}>
                {thumbSrc && (
                    <img
                        src={thumbSrc}
                        alt=""
                        style={{
                            position: 'absolute', inset: 0, width: '100%', height: '100%',
                            objectFit: 'cover', display: 'block', borderRadius: '20px 20px 0 0',
                        }}
                    />
                )}
                {/* Overlay scrim for text readability */}
                <div style={{
                    position: 'absolute', inset: 0, borderRadius: '20px 20px 0 0',
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.1) 60%, rgba(0,0,0,0.6) 100%)',
                }} />
                {/* Folder name top-left */}
                <span style={{
                    position: 'relative', fontSize: 11, color: '#cbd5e1',
                    background: 'rgba(0,0,0,0.55)', borderRadius: 4, padding: '2px 6px',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%', display: 'inline-block',
                }}>
                    {folderName || '—'}
                </span>
                {/* Queue index + status pill bottom-right */}
                <div style={{ position: 'absolute', bottom: 10, right: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
                        padding: '3px 8px', borderRadius: 4,
                        ...pill,
                    }}>
                        {queueStatus}
                    </span>
                    <span style={{ fontSize: 11, color: '#64748b', background: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: '2px 6px' }}>
                        #{index + 1}
                    </span>
                </div>
            </div>

            {/* Body */}
            <div className="library-card-body" style={{ gap: 8 }}>
                {/* Disk filename */}
                <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={fileName}>
                    {fileName}
                </p>
                {/* Relative path */}
                <p className="library-card-path" title={relPath} style={{ margin: 0, fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {relPath}
                </p>
                {/* AI Title */}
                <h3 className="library-card-title" title={title} style={{ fontSize: '0.95rem', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {title}
                </h3>
                {/* Music */}
                {hasMusic && (
                    <span style={{ fontSize: 11, color: '#818cf8', background: '#1e1b4b', borderRadius: 4, padding: '1px 6px', alignSelf: 'flex-start' }}>
                        ♪ {video.musicTrack}
                    </span>
                )}
                {/* Platform statuses */}
                <div className="library-card-statuses">
                    {(video.statuses || []).map(s => <StatusBadge key={s} status={s} />)}
                </div>
            </div>
        </motion.article>
    );
}

function UploadQueuePreview({ queue, logEntries, uploadStatus })
{
    const statuses = useMemo(
        () => deriveStatuses(queue, logEntries, uploadStatus),
        [queue, logEntries, uploadStatus]
    );

    const uploadedCount  = statuses.filter(s => s === 'UPLOADED').length;
    const uploadingCount = statuses.filter(s => s === 'UPLOADING').length;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <h2 style={{ margin: 0, fontSize: '1rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Upload Queue
                </h2>
                <span style={{ fontSize: 13, color: '#6b7280' }}>
                    {queue.length} video{queue.length !== 1 ? 's' : ''}
                    {uploadedCount  > 0 && <span style={{ marginLeft: 8, color: '#34d399' }}>· {uploadedCount} uploaded</span>}
                    {uploadingCount > 0 && <span style={{ marginLeft: 8, color: '#fbbf24' }}>· uploading…</span>}
                </span>
            </div>

            {queue.length === 0
                ? (
                    <div style={{ padding: '40px 24px', textAlign: 'center', color: '#4b5563', border: '1px dashed #334155', borderRadius: 12 }}>
                        <p style={{ margin: 0, fontSize: 14 }}>No videos match the current filters.</p>
                        <p style={{ margin: '6px 0 0', fontSize: 12 }}>Adjust Max Videos, Uploaded On, or Missing On in the sidebar.</p>
                    </div>
                )
                : (
                    <div className="library-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
                        {queue.map((video, i) => (
                            <QueueCard
                                key={video.id || i}
                                video={video}
                                index={i}
                                queueStatus={statuses[i]}
                            />
                        ))}
                    </div>
                )
            }
        </div>
    );
}

export default UploadQueuePreview;
