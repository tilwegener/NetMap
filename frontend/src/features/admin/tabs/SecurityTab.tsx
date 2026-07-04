import { useState } from "react";
import { Shield } from "lucide-react";
import { api, type User } from "../../../api/client";
import { useApiQuery } from "../../../hooks/useApiQuery";

export function SecurityTab({
  accessToken,
  users,
  initialUserFilter,
}: {
  accessToken: string;
  users: User[];
  initialUserFilter: number | null;
}) {
  const [auditOffset, setAuditOffset] = useState(0);
  const [auditUserFilter, setAuditUserFilter] = useState<number | null>(initialUserFilter);

  const auditQuery = useApiQuery(() => {
    const params: { limit: number; offset: number; actor_user_id?: number } = { limit: 50, offset: auditOffset };
    if (auditUserFilter !== null) params.actor_user_id = auditUserFilter;
    return api.listAuditLogs(accessToken, params);
  }, [accessToken, auditOffset, auditUserFilter]);

  const auditLogs = auditQuery.data?.records ?? [];
  const auditLogsTotal = auditQuery.data?.total ?? 0;

  return (
    <div className="admin-tab-content">
      <section className="panel admin-panel">
        <div className="admin-panel-header">
          <h2 className="admin-section-title"><Shield size={16} />{auditUserFilter ? `Activity — ${users.find((u) => u.id === auditUserFilter)?.username ?? "user"}` : "Login & Audit History"}</h2>
          <div className="admin-panel-actions">
            {auditUserFilter && <button type="button" className="nm-btn" onClick={() => { setAuditUserFilter(null); setAuditOffset(0); }}>All users</button>}
            <button type="button" className="nm-btn" onClick={() => void auditQuery.reload()}>Refresh</button>
          </div>
        </div>
        {auditQuery.error && <div className="form-error">{auditQuery.error}</div>}
        <div className="audit-log-table">
          <div className="audit-log-header">
            <span>Time</span>
            <span>Event</span>
            <span>Actor</span>
            <span>Context</span>
          </div>
          {auditLogs.length === 0 && <p className="audit-empty">{auditQuery.isLoading ? "Loading…" : "No audit records found."}</p>}
          {auditLogs.map((log) => {
            const dt = new Date(log.created_at);
            const category = log.action.split(".")[0];
            const actor = log.actor_user_id
              ? (users.find((u) => u.id === log.actor_user_id)?.username ?? `#${log.actor_user_id}`)
              : "system";
            return (
              <div className="audit-log-row" key={log.id}>
                <div className="audit-time-cell">
                  <span className="audit-date">{dt.toLocaleDateString()}</span>
                  <span className="audit-time">{dt.toLocaleTimeString()}</span>
                </div>
                <div className="audit-event-cell">
                  <span className={`audit-category-badge audit-category-badge--${category}`}>{category}</span>
                  <span className="audit-action">{log.action.includes(".") ? log.action.slice(log.action.indexOf(".") + 1) : log.action}</span>
                </div>
                <span className="audit-actor">{actor}</span>
                <div className="audit-context-cell">
                  {log.target && <span className="audit-target">{log.target}</span>}
                  {log.detail && <span className="audit-detail">{log.detail}</span>}
                  {!log.target && !log.detail && <span className="audit-detail">—</span>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="audit-pagination">
          <button type="button" className="nm-btn" disabled={auditOffset === 0} onClick={() => setAuditOffset((current) => Math.max(0, current - 50))}>← Prev</button>
          <span>{auditOffset + 1}–{Math.min(auditOffset + 50, auditLogsTotal)} of {auditLogsTotal}</span>
          <button type="button" className="nm-btn" disabled={auditOffset + 50 >= auditLogsTotal} onClick={() => setAuditOffset((current) => current + 50)}>Next →</button>
        </div>
      </section>
    </div>
  );
}
