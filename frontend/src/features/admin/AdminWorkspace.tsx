import { useState } from "react";
import { Settings, Shield } from "lucide-react";
import {
  IconUsers, IconShieldCheck, IconCloud, IconAlertCircle,
  IconServer, IconCalendarClock, IconPalette,
} from "@tabler/icons-react";
import {
  api,
  type SystemSettings, type VersionInfo,
  type DashboardSummary, type TopologyGraph,
} from "../../api/client";
import { useApiQuery } from "../../hooks/useApiQuery";

import { SystemTab } from "./tabs/SystemTab";
import { UsersTab } from "./tabs/UsersTab";
import { SecurityTab } from "./tabs/SecurityTab";
import { NotificationsTab } from "./tabs/NotificationsTab";
import { AlertsTab } from "./tabs/AlertsTab";
import { GroupsTab } from "./tabs/GroupsTab";
import { CredentialsTab } from "./tabs/CredentialsTab";
import { AutomationTab } from "./tabs/AutomationTab";
import { DeviceIconsTab } from "./tabs/DeviceIconsTab";

type AdminTabId = "system" | "devices-icons" | "users" | "security" | "notifications" | "alerts" | "groups" | "credentials" | "automation";

const adminTabs = [
  { id: "system", label: "System", Icon: Settings },
  { id: "devices-icons", label: "Devices & Icons", Icon: IconPalette },
  { id: "users", label: "Users", Icon: IconUsers },
  { id: "groups", label: "Groups", Icon: IconShieldCheck },
  { id: "credentials", label: "SNMP Profiles", Icon: IconServer },
  { id: "notifications", label: "Notifications", Icon: IconCloud },
  { id: "alerts", label: "Alerts", Icon: IconAlertCircle },
  { id: "automation", label: "Automation", Icon: IconCalendarClock },
  { id: "security", label: "Security", Icon: Shield },
] as const;

export function AdminWorkspace({
  accessToken,
  graph,
  summary,
  onSettingsChange,
  onOpenWhatsNew,
  versionInfo,
}: {
  accessToken: string;
  graph: TopologyGraph;
  summary: DashboardSummary | null;
  onSettingsChange: (settings: SystemSettings) => void;
  onOpenWhatsNew: () => void;
  versionInfo: VersionInfo | null;
}) {
  const [activeTab, setActiveTab] = useState<AdminTabId>("system");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // Set when the Users tab jumps to Security with a per-user audit filter;
  // cleared on any direct tab-bar navigation.
  const [auditFocusUserId, setAuditFocusUserId] = useState<number | null>(null);

  const usersQuery = useApiQuery(() => api.listUsers(accessToken), [accessToken]);
  const users = usersQuery.data ?? [];

  function showUserAudit(userId: number) {
    setAuditFocusUserId(userId);
    setActiveTab("security");
  }

  return (
    <section className="admin-layout">
      <div className="admin-tabs">
        {adminTabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={`admin-tab-btn${activeTab === id ? " active" : ""}`}
            onClick={() => { setAuditFocusUserId(null); setActiveTab(id); }}
          >
            <Icon size={14} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {error && <div className="form-error">{error}</div>}
      {success && <div className="success-banner">{success}</div>}
      {usersQuery.error && <div className="form-error">{usersQuery.error}</div>}

      {activeTab === "system" && (
        <SystemTab
          accessToken={accessToken}
          graph={graph}
          summary={summary}
          userCount={users.length}
          versionInfo={versionInfo}
          onOpenWhatsNew={onOpenWhatsNew}
          onSettingsChange={onSettingsChange}
          onError={setError}
          onSuccess={setSuccess}
        />
      )}
      {activeTab === "users" && (
        <UsersTab
          accessToken={accessToken}
          users={users}
          usersLoading={usersQuery.isLoading}
          setUsers={usersQuery.setData}
          onReloadUsers={() => void usersQuery.reload()}
          onShowUserAudit={showUserAudit}
          onError={setError}
          onSuccess={setSuccess}
        />
      )}
      {activeTab === "devices-icons" && (
        <DeviceIconsTab accessToken={accessToken} onError={setError} onSuccess={setSuccess} />
      )}
      {activeTab === "security" && (
        <SecurityTab
          accessToken={accessToken}
          users={users}
          initialUserFilter={auditFocusUserId}
        />
      )}
      {activeTab === "notifications" && (
        <NotificationsTab accessToken={accessToken} onError={setError} onSuccess={setSuccess} />
      )}
      {activeTab === "alerts" && (
        <AlertsTab accessToken={accessToken} graph={graph} />
      )}
      {activeTab === "groups" && (
        <GroupsTab accessToken={accessToken} onError={setError} onSuccess={setSuccess} />
      )}
      {activeTab === "credentials" && (
        <CredentialsTab accessToken={accessToken} onError={setError} onSuccess={setSuccess} />
      )}
      {activeTab === "automation" && (
        <AutomationTab accessToken={accessToken} onError={setError} onSuccess={setSuccess} />
      )}
    </section>
  );
}
