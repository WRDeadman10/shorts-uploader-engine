import Card from "./Card.jsx";
import ProgressBar from "./ProgressBar.jsx";
import { useAppStore } from "./useAppStore.js";

function Dashboard()
{
    const dashboardStats = useAppStore(function selectDashboardStats(state)
    {
        return state.dashboardStats;
    });
    const uploadPipelines = useAppStore(function selectUploadPipelines(state)
    {
        return state.uploadPipelines;
    });

    return (
        <section className="dashboard-page page-panel">
            <div className="page-heading">
                <span className="page-eyebrow">Operations Snapshot</span>
                <h1 className="page-title">Dashboard</h1>
                <p className="page-placeholder">Live metrics and platform readiness at a glance.</p>
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
