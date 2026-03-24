import { useAppStore } from "./useAppStore.js";

function Audit()
{
    const auditRows = useAppStore(function selectAuditRows(state)
    {
        return state.auditRows;
    });

    return (
        <section className="audit-page page-panel">
            <div className="page-heading">
                <span className="page-eyebrow">Delivery Audit</span>
                <h1 className="page-title">Platform Coverage</h1>
                <p className="page-placeholder">Missing and partial deliveries are flagged automatically.</p>
            </div>
            <div className="audit-table-shell">
                <table className="audit-table">
                    <thead>
                        <tr>
                            <th>Video</th>
                            <th>YT</th>
                            <th>IG</th>
                            <th>FB</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {auditRows.map(function mapRow(row)
                        {
                            const rowClassName = getRowClassName(row.status);

                            return (
                                <tr key={row.id} className={rowClassName}>
                                    <td>{row.video}</td>
                                    <td>{row.yt ? "Yes" : "No"}</td>
                                    <td>{row.ig ? "Yes" : "No"}</td>
                                    <td>{row.fb ? "Yes" : "No"}</td>
                                    <td>{formatStatus(row.status)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

function getRowClassName(status)
{
    if (status === "missing")
    {
        return "audit-row audit-row-missing";
    }

    if (status === "partial")
    {
        return "audit-row audit-row-partial";
    }

    return "audit-row audit-row-complete";
}

function formatStatus(status)
{
    if (status === "missing")
    {
        return "Missing";
    }

    if (status === "partial")
    {
        return "Partial";
    }

    return "Complete";
}

export default Audit;
