import { test, expect } from "@playwright/test";
import {
  setupCoreMocks,
  setupTopologyMocks,
  setupInventoryMocks,
  mockDevice,
} from "./helpers/api-mocks";

test.describe("Modal layering", () => {
  test.describe("Topology — device form modal", () => {
    test.beforeEach(async ({ page }) => {
      const devices = [
        mockDevice({ id: 1, hostname: "router-01", ip_address: "192.168.1.1" }),
      ];
      await setupCoreMocks(page);
      await setupTopologyMocks(page, devices);
      await page.goto("/topology");
    });

    test("Add Device button opens device form modal", async ({ page }) => {
      const addBtn = page.getByRole("button", { name: "+ Device" });
      await addBtn.waitFor({ state: "visible", timeout: 8000 });
      await addBtn.click();
      // Device form should be rendered above topology canvas
      const form = page.locator(".device-form, [class*='device-form'], dialog, [role='dialog']");
      await expect(form.first()).toBeVisible({ timeout: 4000 });
    });

    test("modal does not render below the topology overlay layer (z-index check)", async ({ page }) => {
      const addBtn = page.getByRole("button", { name: "+ Device" });
      await addBtn.waitFor({ state: "visible", timeout: 8000 });
      await addBtn.click();

      // The modal/form element must have a z-index higher than the graph surface (z-index 15)
      const modal = page.locator(".device-form, [class*='device-form'], dialog, [role='dialog']").first();
      await modal.waitFor({ state: "visible", timeout: 4000 });

      const zIndex = await modal.evaluate((el) => {
        let node: Element | null = el;
        while (node) {
          const z = window.getComputedStyle(node).zIndex;
          if (z !== "auto" && Number(z) > 0) return Number(z);
          node = node.parentElement;
        }
        return 0;
      });
      expect(zIndex).toBeGreaterThan(15);
    });
  });

  test.describe("Inventory — device form modal", () => {
    test.beforeEach(async ({ page }) => {
      const devices = [
        mockDevice({ id: 1, hostname: "router-01", ip_address: "192.168.1.1" }),
      ];
      await setupCoreMocks(page);
      // topology/graph is needed for the dashboard shell
      await setupTopologyMocks(page, devices);
      await setupInventoryMocks(page, devices);
      await page.goto("/inventory");
    });

    test("Add Device button opens device form modal above inventory table", async ({ page }) => {
      const addBtn = page.getByRole("button", { name: "+ Device" });
      await addBtn.waitFor({ state: "visible", timeout: 8000 });
      await addBtn.click();

      const form = page.locator(".device-form, [class*='device-form'], dialog, [role='dialog']");
      await expect(form.first()).toBeVisible({ timeout: 4000 });
    });

    test("pressing Escape or clicking cancel closes the modal", async ({ page }) => {
      const addBtn = page.getByRole("button", { name: "+ Device" });
      await addBtn.waitFor({ state: "visible", timeout: 8000 });
      await addBtn.click();

      const form = page.locator(".device-form, [class*='device-form'], dialog, [role='dialog']");
      await form.first().waitFor({ state: "visible", timeout: 4000 });

      await page.keyboard.press("Escape");
      await expect(form.first()).not.toBeVisible({ timeout: 3000 });
    });
  });

  test.describe("Overlay z-index priority over Cytoscape canvas", () => {
    test("topology-overlay-layer has z-index above graph-canvas", async ({ page }) => {
      await setupCoreMocks(page);
      await setupTopologyMocks(page, []);
      await page.goto("/topology");

      await page.locator(".graph-canvas").waitFor({ state: "visible", timeout: 8000 });

      const overlayZ = await page.locator(".topology-overlay-layer").evaluate((el) =>
        Number(window.getComputedStyle(el).zIndex) || 0
      );
      // canvas is a sibling rendered before the overlay; overlay must be higher
      expect(overlayZ).toBeGreaterThan(0);
    });

    test("overlay device buttons pass clicks through to Cytoscape canvas (pointer-events: none)", async ({ page }) => {
      const devices = [mockDevice({ id: 1, hostname: "router-01" })];
      await setupCoreMocks(page);
      await setupTopologyMocks(page, devices);
      await page.goto("/topology");

      const node = page.locator(".topology-overlay-node").first();
      await node.waitFor({ state: "visible", timeout: 8000 });

      const pointerEvents = await node.evaluate((el) =>
        window.getComputedStyle(el).pointerEvents
      );
      // Must stay none so drag events reach the Cytoscape canvas beneath
      expect(pointerEvents).toBe("none");
    });
  });
});
