import DOMPurify from "dompurify";
import type { DeviceIcon } from "./api/client";
import { localIconPacksStorageKey, deviceTypeIconMapStorageKey } from "./constants";
import tablerIconMetaUrl from "../node_modules/@tabler/icons/icons.json?url";
import tablerOutlineNodesUrl from "../node_modules/@tabler/icons/tabler-nodes-outline.json?url";

export type IconGlyphDefinition = { value: string; label: string; path?: string; url?: string; symbol?: string };
export type IconPack = { id: string; name: string; icons: IconGlyphDefinition[] };
type TablerNode = [string, Record<string, string | number | boolean | null | undefined>];

function tablerNodeToMarkup(node: TablerNode) {
  const [tag, attrs] = node;
  const attrText = Object.entries(attrs)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => `${key}="${String(value).replace(/"/g, "&quot;")}"`)
    .join(" ");
  return `<${tag}${attrText ? ` ${attrText}` : ""}/>`;
}

function buildFullTablerIconPack(
  meta: Record<string, { name?: string }>,
  nodes: Record<string, TablerNode[]>,
): IconPack {
  return {
    id: "tabler-full",
    name: "Tabler Icons",
    icons: Object.entries(nodes)
      .map(([value, iconNodes]) => ({
        value,
        label: labelFromIconValue(meta[value]?.name ?? value),
        path: iconNodes.map(tablerNodeToMarkup).join(""),
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  };
}

let fullTablerIconPackPromise: Promise<IconPack> | null = null;

// All paths are Tabler Icons (MIT), viewBox 0 0 24 24, stroke-width 1.5
export const builtInIconPack: IconPack = {
  id: "built-in",
  name: "Built-in (Tabler)",
  icons: [
    { value: "device",      label: "Device",      symbol: "◻", path: '<path d="M3 19l18 0"/><path d="M5 7a1 1 0 0 1 1 -1h12a1 1 0 0 1 1 1v8a1 1 0 0 1 -1 1h-12a1 1 0 0 1 -1 -1l0 -8"/>' },
    { value: "router",      label: "Router",      symbol: "⇄", path: '<path d="M3 15a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2l0 -4"/><path d="M17 17l0 .01"/><path d="M13 17l0 .01"/><path d="M15 13l0 -2"/><path d="M11.75 8.75a4 4 0 0 1 6.5 0"/><path d="M8.5 6.5a8 8 0 0 1 13 0"/>' },
    { value: "switch",      label: "Switch",      symbol: "▦", path: '<path d="M6 9a6 6 0 1 0 12 0a6 6 0 0 0 -12 0"/><path d="M12 3c1.333 .333 2 2.333 2 6s-.667 5.667 -2 6"/><path d="M12 3c-1.333 .333 -2 2.333 -2 6s.667 5.667 2 6"/><path d="M6 9h12"/><path d="M3 20h7"/><path d="M14 20h7"/><path d="M10 20a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"/><path d="M12 15v3"/>' },
    { value: "firewall",    label: "Firewall",    symbol: "🛡", path: '<path d="M11.46 20.846a12 12 0 0 1 -7.96 -14.846a12 12 0 0 0 8.5 -3a12 12 0 0 0 8.5 3a12 12 0 0 1 -.09 7.06"/><path d="M15 19l2 2l4 -4"/>' },
    { value: "server",      label: "Server",      symbol: "🖥", path: '<path d="M3 7a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v2a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3"/><path d="M3 15a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v2a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3l0 -2"/><path d="M7 8l0 .01"/><path d="M7 16l0 .01"/>' },
    { value: "wireless",    label: "Wireless AP", symbol: "📶", path: '<path d="M12 12l0 .01"/><path d="M14.828 9.172a4 4 0 0 1 0 5.656"/><path d="M17.657 6.343a8 8 0 0 1 0 11.314"/><path d="M9.168 14.828a4 4 0 0 1 0 -5.656"/><path d="M6.337 17.657a8 8 0 0 1 0 -11.314"/>' },
    { value: "workstation", label: "Workstation", symbol: "💻", path: '<path d="M3 5a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1v-10"/><path d="M7 20h10"/><path d="M9 16v4"/><path d="M15 16v4"/>' },
    { value: "cloud",       label: "Cloud",       symbol: "☁", path: '<path d="M6.657 18c-2.572 0 -4.657 -2.007 -4.657 -4.483c0 -2.475 2.085 -4.482 4.657 -4.482c.393 -1.762 1.794 -3.2 3.675 -3.773c1.88 -.572 3.956 -.193 5.444 1c1.488 1.19 2.162 3.007 1.77 4.769h.99c1.913 0 3.464 1.56 3.464 3.486c0 1.927 -1.551 3.487 -3.465 3.487h-11.878"/>' },
    { value: "database",    label: "Database",    symbol: "🗄", path: '<path d="M4 6a8 3 0 1 0 16 0a8 3 0 1 0 -16 0"/><path d="M4 6v6a8 3 0 0 0 16 0v-6"/><path d="M4 12v6a8 3 0 0 0 16 0v-6"/>' },
    { value: "nas",         label: "NAS",         symbol: "💾", path: '<path d="M3 7a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v2a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-2"/><path d="M3 15a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v2a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3l0 -2"/><path d="M7 8l0 .01"/><path d="M7 16l0 .01"/><path d="M11 8h6"/><path d="M11 16h6"/>' },
    { value: "camera",      label: "Camera",      symbol: "📷", path: '<path d="M5 7h1a2 2 0 0 0 2 -2a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2"/><path d="M9 13a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/>' },
    { value: "printer",     label: "Printer",     symbol: "🖨", path: '<path d="M17 17h2a2 2 0 0 0 2 -2v-4a2 2 0 0 0 -2 -2h-14a2 2 0 0 0 -2 2v4a2 2 0 0 0 2 2h2"/><path d="M17 9v-4a2 2 0 0 0 -2 -2h-6a2 2 0 0 0 -2 2v4"/><path d="M7 15a2 2 0 0 1 2 -2h6a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-6a2 2 0 0 1 -2 -2l0 -4"/>' },
    { value: "iot",         label: "IoT Device",  symbol: "⚙", path: '<path d="M5 6a1 1 0 0 1 1 -1h12a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-12a1 1 0 0 1 -1 -1l0 -12"/><path d="M9 9h6v6h-6l0 -6"/><path d="M3 10h2"/><path d="M3 14h2"/><path d="M10 3v2"/><path d="M14 3v2"/><path d="M21 10h-2"/><path d="M21 14h-2"/><path d="M14 21v-2"/><path d="M10 21v-2"/>' },
    { value: "hypervisor",  label: "Hypervisor",  symbol: "⬡", path: '<path d="M10 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M3 19a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M17 19a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M6.5 17.5l5.5 -4.5l5.5 4.5"/><path d="M12 7l0 6"/>' },
    { value: "phone",       label: "Phone",       symbol: "📱", path: '<path d="M6 5a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2v-14"/><path d="M11 4h2"/><path d="M12 17v.01"/>' },
    { value: "vpn",         label: "VPN",         symbol: "🔒", path: '<path d="M5 13a7 7 0 0 1 14 0"/><path d="M8 13v-3a4 4 0 0 1 8 0v3"/><path d="M7 13h10a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-4a2 2 0 0 1 2 -2z"/><path d="M12 17l0 .01"/>' },
    { value: "unknown",     label: "Unknown",     symbol: "?",  path: '<path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/><path d="M12 16v.01"/><path d="M12 13a2 2 0 0 0 .914 -3.782a1.98 1.98 0 0 0 -2.414 .483"/>' },
  ],
};

export let fullTablerIconPack: IconPack = { id: "tabler-full", name: "Tabler Icons", icons: [] };

export function loadFullTablerIconPack(): Promise<IconPack> {
  if (fullTablerIconPack.icons.length > 0) return Promise.resolve(fullTablerIconPack);
  if (!fullTablerIconPackPromise) {
    fullTablerIconPackPromise = Promise.all([
      fetch(tablerIconMetaUrl).then((response) => response.json()),
      fetch(tablerOutlineNodesUrl).then((response) => response.json()),
    ]).then(([meta, nodes]) => {
      fullTablerIconPack = buildFullTablerIconPack(
        meta as Record<string, { name?: string }>,
        nodes as Record<string, TablerNode[]>,
      );
      return fullTablerIconPack;
    });
  }
  return fullTablerIconPackPromise;
}

export const defaultDeviceTypeIconMap: Record<string, string> = {
  router: "router",
  switch: "switch",
  firewall: "firewall",
  server: "server",
  wireless: "wireless",
  workstation: "workstation",
  database: "database",
  nas: "nas",
  camera: "camera",
  printer: "printer",
  iot: "iot",
  hypervisor: "hypervisor",
  phone: "phone",
  vpn: "vpn",
  cloud: "cloud",
  other: "device",
  "virtual-machine": "hypervisor",
  unknown: "unknown",
};

// ── Mutable icon state (module-level singletons) ──────────────────────────────

export let runtimeIconPackId = builtInIconPack.id;
export let runtimeIconDefs = new Map<string, IconGlyphDefinition>(builtInIconPack.icons.map((icon) => [icon.value, icon]));
export let runtimeIconOptions = builtInIconPack.icons.map(({ label, value }) => ({ label, value }));
export let allRuntimePacks: IconPack[] = [builtInIconPack, fullTablerIconPack];
export let deviceTypeIconMap: Record<string, string> = { ...defaultDeviceTypeIconMap };

// ── Device type icon map helpers ──────────────────────────────────────────────

export function readDeviceTypeIconMap(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(deviceTypeIconMapStorageKey);
    if (!raw) return { ...defaultDeviceTypeIconMap };
    const parsed = JSON.parse(raw) as Record<string, string>;
    return { ...defaultDeviceTypeIconMap, ...parsed };
  } catch {
    return { ...defaultDeviceTypeIconMap };
  }
}

export function writeDeviceTypeIconMap(map: Record<string, string>): void {
  window.localStorage.setItem(deviceTypeIconMapStorageKey, JSON.stringify(map));
}

export function applyDeviceTypeIconMap(map: Record<string, string>): void {
  deviceTypeIconMap = { ...defaultDeviceTypeIconMap, ...map };
  writeDeviceTypeIconMap(map);
}

export function refreshDeviceTypeIconMap(): void {
  deviceTypeIconMap = readDeviceTypeIconMap();
}

// ── SVG / icon pack helpers ───────────────────────────────────────────────────

export function sanitizeSvgPath(raw: string): string {
  return DOMPurify.sanitize(raw, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ["script", "iframe", "object", "embed", "link", "meta", "foreignObject"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onmouseout", "onfocus", "onblur"],
  });
}

export function sanitizeIconDefs(raw: unknown): IconGlyphDefinition[] {
  if (!Array.isArray(raw)) return [];
  const sanitized: IconGlyphDefinition[] = [];
  raw.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const value = String((item as { value?: unknown }).value ?? "").trim();
    const label = String((item as { label?: unknown }).label ?? "").trim();
    const pathRaw = (item as { path?: unknown }).path;
    const path = typeof pathRaw === "string" ? sanitizeSvgPath(pathRaw.trim()) : undefined;
    const symbolRaw = (item as { symbol?: unknown }).symbol;
    const symbol = typeof symbolRaw === "string" ? symbolRaw.trim() : undefined;
    const urlRaw = (item as { url?: unknown }).url;
    const url = typeof urlRaw === "string" ? urlRaw.trim() : undefined;
    if (!value || !label || (!path && !url)) return;
    sanitized.push({ value, label, path: path || undefined, url, symbol });
  });
  return sanitized;
}

export function slugifyIconValue(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .trim()
    .slice(0, 100);
}

export function labelFromIconValue(input: string) {
  return input
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function extractSvgIconMarkup(svgText: string) {
  const matches = svgText.match(/<(path|circle|rect|line|polyline|polygon|ellipse)\b[^>]*\/?>/gi) || [];
  return matches.join("");
}

export async function loadIconPacks(): Promise<IconPack[]> {
  try {
    const indexResponse = await fetch("/icon-packs/index.json", { cache: "no-store" });
    if (!indexResponse.ok) return [];
    const indexJson = await indexResponse.json() as { packs?: Array<{ id?: string; name?: string; file?: string }> };
    const entries = Array.isArray(indexJson.packs) ? indexJson.packs : [];
    const loaded = await Promise.all(entries.map(async (entry) => {
      const id = String(entry.id ?? "").trim();
      const name = String(entry.name ?? id).trim();
      const file = String(entry.file ?? "").trim();
      if (!id || !file) return null;
      try {
        const packResponse = await fetch(`/icon-packs/${file}`, { cache: "no-store" });
        if (!packResponse.ok) return null;
        const packJson = await packResponse.json() as { icons?: unknown };
        const icons = sanitizeIconDefs(packJson.icons);
        if (icons.length === 0) return null;
        return { id, name: name || id, icons };
      } catch {
        return null;
      }
    }));
    return loaded.filter((pack): pack is IconPack => Boolean(pack));
  } catch {
    return [];
  }
}

export function readLocalIconPacks(): IconPack[] {
  try {
    const raw = window.localStorage.getItem(localIconPacksStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<{ id?: unknown; name?: unknown; icons?: unknown }>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((pack) => {
        const id = String(pack.id ?? "").trim();
        const name = String(pack.name ?? id).trim();
        const icons = sanitizeIconDefs(pack.icons);
        if (!id || !name || icons.length === 0) return null;
        return { id, name, icons };
      })
      .filter((pack): pack is IconPack => Boolean(pack));
  } catch {
    return [];
  }
}

export function writeLocalIconPacks(packs: IconPack[]) {
  window.localStorage.setItem(localIconPacksStorageKey, JSON.stringify(packs));
}

export function applyIconPackSelection(iconPacks: IconPack[], packId: string) {
  const selected = iconPacks.find((pack) => pack.id === packId) ?? builtInIconPack;
  const merged = new Map<string, IconGlyphDefinition>();
  iconPacks.forEach((pack) => pack.icons.forEach((icon) => merged.set(icon.value, icon)));
  selected.icons.forEach((icon) => merged.set(icon.value, icon));
  const ordered = [
    ...selected.icons,
    ...builtInIconPack.icons.filter((icon) => !selected.icons.some((row) => row.value === icon.value)),
  ];
  runtimeIconPackId = selected.id;
  runtimeIconDefs = merged;
  runtimeIconOptions = ordered.map(({ label, value }) => ({ label, value }));
  allRuntimePacks = iconPacks;
}

// ── Icon resolution helpers ───────────────────────────────────────────────────

export function resolveDeviceIcon(icon: DeviceIcon | string | null | undefined): DeviceIcon {
  const key = String(icon ?? "").trim();
  if (key.length === 0 || key === "unknown") return "device";
  return runtimeIconDefs.has(key) ? key : "device";
}

export function iconLabel(icon: DeviceIcon) {
  const key = resolveDeviceIcon(icon);
  return runtimeIconDefs.get(key)?.label ?? runtimeIconDefs.get("device")?.label ?? "Device";
}

export function iconSymbol(icon: DeviceIcon) {
  const key = resolveDeviceIcon(icon);
  return runtimeIconDefs.get(key)?.symbol || runtimeIconDefs.get("device")?.symbol || "□";
}

export function iconSelectLabel(icon: DeviceIcon) {
  return `${iconSymbol(icon)} ${iconLabel(icon)}`;
}

export function deviceIconUrl(icon: DeviceIcon, color = "#3b7cc9") {
  const def = runtimeIconDefs.get(resolveDeviceIcon(icon));
  if (def?.url) return def.url;
  const path = def?.path ?? runtimeIconDefs.get("device")?.path ?? "";
  const safeColor = color.replace(/[<>"'&]/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${safeColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function deviceIconPath(icon: DeviceIcon) {
  const key = resolveDeviceIcon(icon);
  return runtimeIconDefs.get(key)?.path ?? runtimeIconDefs.get("device")?.path ?? runtimeIconDefs.get("unknown")?.path ?? "";
}
