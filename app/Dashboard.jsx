import Card from "./Card.jsx";
import ProgressBar from "./ProgressBar.jsx";
import { useAppStore } from "./useAppStore.js";

function Dashboard()
{
    const videoList = useAppStore(function selectVideoList(state)
    {
        return state.videoList;
    });
    const uploadStatus = useAppStore(function selectUploadStatus(state)
    {
        return state.uploadStatus;
    });

    const totalTracked = videoList.length;
    const youtubeCount = videoList.filter(function filterYoutube(video)
    {
        return video.yt;
    }).length;
    const instagramCount = videoList.filter(function filterInstagram(video)
    {
        return video.ig;
    }).length;
    const facebookCount = videoList.filter(function filterFacebook(video)
    {
        return video.fb;
    }).length;
    const completedCount = videoList.filter(function filterCompleted(video)
    {
        return video.status === "complete";
    }).length;
    const completionRate = totalTracked > 0 ? Math.round((completedCount / totalTracked) * 100) : 0;
    const dashboardStats = [
        {
            id: "tracked",
            label: "Tracked Videos",
            value: String(totalTracked),
            detail: "Merged from JSON state and ledgers"
        },
        {
            id: "youtube",
            label: "YouTube Uploaded",
            value: String(youtubeCount),
            detail: "Detected from YouTube state"
        },
        {
            id: "complete",
            label: "Full Coverage",
            value: String(completedCount),
            detail: "Published on all three platforms"
        },
        {
            id: "status",
            label: "Active Upload",
            value: uploadStatus.status,
            detail: uploadStatus.commandPreview || "No process running"
        }
    ];
    const uploadPipelines = [
        {
            id: "youtube",
            label: "YouTube Coverage",
            progress: totalTracked > 0 ? Math.round((youtubeCount / totalTracked) * 100) : 0,
            detail: youtubeCount + " of " + totalTracked + " tracked videos"
        },
        {
            id: "instagram",
            label: "Instagram Coverage",
            progress: totalTracked > 0 ? Math.round((instagramCount / totalTracked) * 100) : 0,
            detail: instagramCount + " of " + totalTracked + " tracked videos"
        },
        {
            id: "facebook",
            label: "Facebook / Full Completion",
            progress: totalTracked > 0 ? Math.max(Math.round((facebookCount / totalTracked) * 100), completionRate) : 0,
            detail: facebookCount + " Facebook uploads, " + completionRate + "% fully complete"
        }
    ];

    return (
        <section className="dashboard-page page-panel">
            <div className="page-heading">
                <span className="page-eyebrow">Operations Snapshot</span>
                <h1 className="page-title">Dashboard</h1>
                <p className="page-placeholder">Counts are driven by the current Python JSON state files.</p>
            </div>
            <div className="dashboard-grid">
                {dashboardStats.map(function mapStat(stat)
                {
                    return (
                        <Card
                            key={stat.id}
                            title={stat.label}
                            value={stat.value}
                            subtitle={stat.detail}
                        />
                    );
                })}
            </div>
            <div className="dashboard-stack">
                {uploadPipelines.map(function mapPipeline(pipeline)
                {
                    return (
                        <Card
                            key={pipeline.id}
                            title={pipeline.label}
                            subtitle={pipeline.detail}
                        >
                            <ProgressBar value={pipeline.progress} label={pipeline.progress + "%"} />
                        </Card>
                    );
                })}
            </div>
        </section>
    );
}

export default Dashboard;
