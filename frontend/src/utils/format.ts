import type { Device, DeviceStatus } from "../api/client";

export function formatDeviceTypeLabel(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatMs(value: number | null): string {
  if (value === null) return "-";
  return `${value.toFixed(1)} ms`;
}

export function deviceLabel(device: Device) {
  return device.display_name || device.hostname || device.ip_address || `Device ${device.id}`;
}

export function userInitials(username: string) {
  const parts = username.trim().split(/[\s._-]+/);
  if (parts.length >= 2 && parts[1].length > 0) return (parts[0][0] + parts[1][0]).toUpperCase();
  return username.slice(0, 2).toUpperCase();
}

export function toOptionalPort(value: string): number | "" {
  if (!value.trim()) return "";
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : "";
}

export function dateTimeLocalToIso(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}

export function toDateTimeLocal(value: Date) {
  const offsetMs = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function formatEventTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

export function blankToUndefined(value: string) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

export function blankToNull(value: string) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function deviceVlanDisplay(device: Device) {
  const group = (device.topology_group || "").trim();
  const vlan = (device.vlan_id || "").trim();
  if (group && vlan) {
    const normalizedGroup = group.toLowerCase();
    const normalizedVlan = vlan.toLowerCase();
    if (normalizedGroup === normalizedVlan || normalizedGroup.includes(normalizedVlan)) return group;
    return `${vlan} - ${group}`;
  }
  if (group) return group;
  if (vlan) return vlan;
  return "—";
}

export function initialDeviceName(device: Device | null, cloneSource: Device | null) {
  if (device) return device.hostname ?? "";
  if (cloneSource?.hostname) return `${cloneSource.hostname} copy`;
  if (cloneSource?.ip_address) return `${cloneSource.ip_address} copy`;
  return "";
}

export function estimateGroupCenter(
  devices: Device[],
  positions: Record<string, { x: number; y: number }>,
) {
  const points = devices
    .map((device) => positions[`device-${device.id}`])
    .filter((point): point is { x: number; y: number } => Boolean(point));
  if (points.length === 0) return { x: 0, y: 0 };
  const total = points.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
  return { x: total.x / points.length, y: total.y / points.length };
}

export function statusColor(status: DeviceStatus | "paused" | string) {
  return ({
    online:   "#2d9d78",
    offline:  "#8a96a3",
    warning:  "#d99a22",
    unknown:  "#5b7c91",
    disabled: "#9aabb6",
    paused:   "#9aabb6",
  } as Record<string, string>)[status] ?? "#5b7c91";
}
