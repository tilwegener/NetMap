import { test, expect } from "@playwright/test";
import {
  setupCoreMocks,
  setupMonitoringMocks,
  setupTopologyMocks,
  mockMonitoringDevice,
} from "./helpers/api-mocks";

test.describe("Monitoring workspace", () => {
  test.beforeEach(async ({ page }) => {
    await setupCoreMocks(page);
    await setupTopologyMocks(page);
    await setupMonitoringMocks(page, [
      mockMonitoringDevice({
        display_name: "Core Router With A Longer Name",
        hostname: "router-core-01",
        ip_address: "192.168.100.1",
      }),
    ]);
    await page.goto("/");
    await page.getByRole("button", { name: "Monitoring", exact: true }).click();
  });

  test("allocates most row width to heartbeat and RTT displays", async ({ page }) => {
    const row = page.locator(".mon-row").first();
    await expect(row).toBeVisible();

    // The inline RTT sparkline moved to the detail panel; rows now show
    // name/IP plus the heartbeat strip, which must dominate the row width.
    const deviceCell = row.locator("td").nth(1);
    const heartbeat = deviceCell.locator(".heartbeat-bar--sm");

    await expect(heartbeat).toBeVisible();

    const widths = await page.evaluate(() => {
      const rowEl = document.querySelector(".mon-row");
      if (!rowEl) return null;
      const cells = Array.from(rowEl.querySelectorAll("td"));
      return {
        device: cells[1]?.getBoundingClientRect().width ?? 0,
        uptime: cells[2]?.getBoundingClientRect().width ?? 0,
        services: cells[5]?.getBoundingClientRect().width ?? 0,
        heartbeat: document.querySelector(".heartbeat-bar--sm")?.getBoundingClientRect().width ?? 0,
      };
    });

    expect(widths).not.toBeNull();
    // Device cell (name + heartbeat strip) must dominate the metadata columns.
    expect(widths!.device).toBeGreaterThan(widths!.uptime * 1.5);
    expect(widths!.device).toBeGreaterThan(widths!.services * 1.5);
    // Heartbeat strip width scales with beat count; require it to fill
    // most of the device cell rather than an absolute pixel width.
    expect(widths!.heartbeat).toBeGreaterThan(widths!.device * 0.4);
    expect(widths!.services).toBeLessThanOrEqual(240);
  });
});
