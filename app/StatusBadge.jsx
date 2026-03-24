const statusStyles = {
    YT: "status-badge status-badge-youtube",
    IG: "status-badge status-badge-instagram",
    FB: "status-badge status-badge-facebook"
};

const statusLabels = {
    YT: "YouTube",
    IG: "Instagram",
    FB: "Facebook"
};

function StatusBadge(props)
{
    const { status } = props;
    const className = statusStyles[status] || "status-badge";
    const label = statusLabels[status] || status;

    return <span className={className}>{label}</span>;
}

export default StatusBadge;
