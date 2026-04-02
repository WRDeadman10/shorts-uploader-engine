import { useAppStore } from "./useAppStore.js";

function Topbar(props)
{
    const { title } = props;
    const uploadStatus = useAppStore(function selectUploadStatus(state)
    {
        return state.uploadStatus;
    });
    const statusLabel = uploadStatus.platform ? uploadStatus.status + " - " + uploadStatus.platform : uploadStatus.status;

    return (
        <header className="topbar">
            <div>
                <p className="topbar-kicker">Workspace</p>
                <h2 className="topbar-title">{title}</h2>
            </div>
            <div className="topbar-status">
                <span className="status-dot" />
                <span>{statusLabel}</span>
            </div>
        </header>
    );
}

export default Topbar;
