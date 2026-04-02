const fs = require("fs");
const path = require("path");
const { getRepoRoot, resolveVideoRoot } = require("./pathService");

function readJsonFile(filePath, fallbackValue)
{
    try
    {
        if (!fs.existsSync(filePath))
        {
            return fallbackValue;
        }

        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
    catch (_error)
    {
        return fallbackValue;
    }
}

function resolveRelativeSourcePath(relativePath)
{
    if (!relativePath)
    {
        return "";
    }

    const videoRoot = resolveVideoRoot();
    const resolvedPath = path.join(videoRoot, relativePath);

    if (fs.existsSync(resolvedPath))
    {
        return resolvedPath;
    }

    return "";
}

function computePlatformFlags(stateKey, sources)
{
    const youtubeEntry = sources.youtubeUploaded[stateKey] || sources.youtubeLedger[stateKey];
    const instagramEntry = sources.instagramLedger[stateKey];
    const facebookEntry = sources.facebookLedger[stateKey];
    const metaRow = sources.metaEntries[stateKey] || {};
    const instagramMeta = metaRow.instagram || {};
    const facebookMeta = metaRow.facebook || {};

    return {
        yt: Boolean(youtubeEntry),
        ig: (instagramMeta.status || "").toLowerCase() === "ok" || (instagramEntry && instagramEntry.status === "ok"),
        fb: (facebookMeta.status || "").toLowerCase() === "ok" || (facebookEntry && facebookEntry.status === "ok")
    };
}

function buildStatusLabel(flags)
{
    const activePlatforms = [];

    if (flags.yt)
    {
        activePlatforms.push("YouTube");
    }

    if (flags.ig)
    {
        activePlatforms.push("Instagram");
    }

    if (flags.fb)
    {
        activePlatforms.push("Facebook");
    }

    if (activePlatforms.length === 0)
    {
        return {
            status: "missing",
            statusText: "Not uploaded yet"
        };
    }

    if (activePlatforms.length === 3)
    {
        return {
            status: "complete",
            statusText: "Published on all platforms"
        };
    }

    return {
        status: "partial",
        statusText: "Published on " + activePlatforms.join(", ")
    };
}

function getVideoList()
{
    const repoRoot = getRepoRoot();
    const youtubeState = readJsonFile(path.join(repoRoot, ".youtube_upload_state.json"), { uploaded: {} });
    const metaState = readJsonFile(path.join(repoRoot, ".meta_reels_upload_state.json"), { entries: {} });
    const youtubeLedger = readJsonFile(path.join(repoRoot, ".youtube_uploaded_videos.json"), { entries: {} });
    const instagramLedger = readJsonFile(path.join(repoRoot, ".instagram_uploaded_videos.json"), { entries: {} });
    const facebookLedger = readJsonFile(path.join(repoRoot, ".facebook_uploaded_videos.json"), { entries: {} });

    const sources = {
        youtubeUploaded: youtubeState.uploaded || {},
        metaEntries: metaState.entries || {},
        youtubeLedger: youtubeLedger.entries || {},
        instagramLedger: instagramLedger.entries || {},
        facebookLedger: facebookLedger.entries || {}
    };

    const knownKeys = new Set();

    for (const collection of Object.values(sources))
    {
        for (const key of Object.keys(collection))
        {
            knownKeys.add(key);
        }
    }

    const rows = [];

    for (const stateKey of knownKeys)
    {
        const youtubeEntry = sources.youtubeUploaded[stateKey] || sources.youtubeLedger[stateKey] || {};
        const instagramEntry = sources.instagramLedger[stateKey] || {};
        const facebookEntry = sources.facebookLedger[stateKey] || {};
        const metaEntry = sources.metaEntries[stateKey] || {};
        const relativePath = youtubeEntry.relative_path || instagramEntry.relative_path || facebookEntry.relative_path || "";
        const metadataPath = youtubeEntry.metadata_file || instagramEntry.metadata_file || facebookEntry.metadata_file || metaEntry.metadata_file || "";
        const flags = computePlatformFlags(stateKey, sources);
        const statusInfo = buildStatusLabel(flags);
        const musicFile = youtubeEntry.background_music_file || sources.youtubeLedger[stateKey]?.background_music_file || "";
        const title = youtubeEntry.title || instagramEntry.title || facebookEntry.title || path.basename(relativePath || stateKey);
        const description = youtubeEntry.description || "";
        const sourcePath = resolveRelativeSourcePath(relativePath);

        rows.push({
            id: stateKey,
            stateKey: stateKey,
            title: title,
            description: description,
            duration: "--:--",
            thumbnail: path.basename(path.dirname(relativePath || "Tracked Clip")) || "Tracked Clip",
            relativePath: relativePath,
            sourcePath: sourcePath,
            metadataPath: metadataPath,
            uploadedFilePath: youtubeEntry.uploaded_file_path || youtubeEntry.source_file || instagramEntry.source_file || facebookEntry.source_file || "",
            musicTrack: musicFile ? path.basename(musicFile) : "No Track",
            yt: flags.yt,
            ig: flags.ig,
            fb: flags.fb,
            statuses: buildStatusTokens(flags),
            status: statusInfo.status,
            statusText: statusInfo.statusText
        });
    }

    rows.sort(function sortRows(left, right)
    {
        return left.relativePath.localeCompare(right.relativePath);
    });

    return rows;
}

function buildStatusTokens(flags)
{
    const tokens = [];

    if (flags.yt)
    {
        tokens.push("YT");
    }

    if (flags.ig)
    {
        tokens.push("IG");
    }

    if (flags.fb)
    {
        tokens.push("FB");
    }

    return tokens;
}

module.exports = {
    getVideoList: getVideoList
};
