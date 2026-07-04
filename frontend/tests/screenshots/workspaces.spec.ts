import { test, expect, type Page } from "@playwright/test";
import {
  setupCoreMocks, setupTopologyMocks, setupInventoryMocks, setupMonitoringMocks,
  mockDevice, mockRelationship, mockMonitoringDevice,
} from "../e2e/helpers/api-mocks";

/**
 * Light/dark visual baselines for every workspace route (Phase 3.3).
 * Deterministic by construction: fixed clock, fixed viewport, fully mocked
 * API. Baselines live in workspaces.spec.ts-snapshots/ — regenerate with
 * --update-snapshots and review the diff images before accepting.
 */

const routes = [
  "/overview", "/topology", "/inventory", "/vlans", "/locations",
  "/monitoring", "/ipam", "/tools", "/security", "/exports",
  "/admin", "/profile",
] as const;

const FIXED_NOW = new Date("2026-06-15T12:00:00Z");

async function setupScreenshotMocks(page: Page) {
  // Catch-all FIRST — Playwright matches routes in reverse registration
  // order, so everything registered below takes precedence over this.
  await page.route("**/api/v1/**", (route) => {
    const url = route.request().url();
    const wantsObject = /summary|status|settings|version|analysis|whats-new/.test(url);
    void route.fulfill({ json: wantsObject ? {} : [] });
  });

  await setupCoreMocks(page);
  await setupTopologyMocks(
    page,
    [
      mockDevice({ id: 1, hostname: "router-01", display_name: "Core Router", topology_group: "Core" }),
      mockDevice({ id: 2, hostname: "switch-01", ip_address: "192.168.1.2", monitor_status: "offline", topology_group: "Core" }),
      mockDevice({ id: 3, hostname: "nas-01", ip_address: "192.168.1.20", topology_group: "Storage" }),
    ],
    [mockRelationship()],
  );
  await setupInventoryMocks(page, [
    mockDevice({ id: 1, hostname: "router-01", display_name: "Core Router" }),
    mockDevice({ id: 2, hostname: "switch-01", ip_address: "192.168.1.2", monitor_status: "offline" }),
  ]);
  await setupMonitoringMocks(page, [
    mockMonitoringDevice(),
    mockMonitoringDevice({ device_id: 2, display_name: "Edge Switch", hostname: "switch-01", ip_address: "192.168.1.2", status: "offline", uptime_24h: 0.72 }),
  ]);

  await page.route("**/api/v1/ipam/summary*", (route) =>
    route.fulfill({
      json: {
        total_subnets: 1, total_ips: 254, used_ips: 3, reserved_ips: 1,
        dhcp_leases: 0, conflicts: 0, utilization_pct: 1.2,
      },
    })
  );
  await page.route("**/api/v1/syslog/status", (route) =>
    route.fulfill({
      json: {
        retention_days: 30, udp_enabled: true, udp_port: 5514,
        tcp_enabled: false, tcp_port: 5514, tls_enabled: false, tls_port: 6514,
        allowlist_enabled: false, total_events: 1240, received_packets: 1300,
        stored_events: 1240, dropped_unparsed: 0, denied_senders: 0,
        last_packet_at: "2026-06-15T11:59:00Z", last_packet_sender: "192.168.1.1",
        last_stored_at: "2026-06-15T11:59:00Z", last_stored_sender: "192.168.1.1",
        last_drop_at: null, last_drop_sender: null, last_drop_raw: null,
        retention_last_run_at: "2026-06-15T00:00:00Z",
        last_event_received_at: "2026-06-15T11:59:00Z",
      },
    })
  );
  await page.route("**/api/v1/syslog/events*", (route) =>
    route.fulfill({ json: { records: [], total: 0, limit: 100, offset: 0 } })
  );
  await page.route("**/api/v1/admin/settings", (route) =>
    route.fulfill({
      json: {
        app_name: "NetMap", login_message: "", announcement: "",
        live_ping_enabled: true, monitor_interval_seconds: 300,
        idle_timeout_minutes: 15, active_network_public_targets_enabled: false,
      },
    })
  );
  await page.route("**/api/v1/admin/users", (route) =>
    route.fulfill({
      json: [{
        id: 1, username: "admin", email: "admin@example.com", role: "SuperAdmin",
        is_active: true, avatar_data: null,
      }],
    })
  );
  await page.route("**/api/v1/audit-logs*", (route) =>
    route.fulfill({ json: { records: [], total: 0 } })
  );
}

for (const theme of ["light", "dark"] as const) {
  test.describe(`workspaces — ${theme}`, () => {
    for (const route of routes) {
      const slug = route.slice(1);
      test(`${slug} (${theme})`, async ({ page }) => {
        await page.clock.setFixedTime(FIXED_NOW);
        await setupScreenshotMocks(page);
        await page.addInitScript((value) => {
          window.localStorage.setItem("netmap.theme", value);
        }, theme);
        await page.goto(route);
        await expect(page.locator(".app-shell")).toBeVisible({ timeout: 15_000 });
        // Let lazy chunks, fonts, and the cytoscape canvas settle.
        await page.waitForTimeout(1_200);
        await expect(page).toHaveScreenshot(`${slug}-${theme}.png`);
      });
    }
  });
}
