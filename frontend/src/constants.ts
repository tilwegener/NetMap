export const tokenStorageKey = "netmap.tokens";
export const themeStorageKey = "netmap.theme";
export const iconPackStorageKey = "netmap.icon_pack";
export const localIconPacksStorageKey = "netmap.icon_packs.local";
export const deviceTypeIconMapStorageKey = "netmap.device_type_icons";

export const topologyLayoutStoragePrefix = "netmap.topology-layout";
export const topologyLayoutVersion = 3;
export const topologyDisplayPrefsStoragePrefix = "netmap.topology-display-prefs";

export const deviceColors = [
  { label: "Green", value: "#2d9d78" },
  { label: "Blue", value: "#3276b1" },
  { label: "Teal", value: "#1d6472" },
  { label: "Amber", value: "#d99a22" },
  { label: "Red", value: "#b44444" },
  { label: "Slate", value: "#5b7c91" },
  { label: "Gray", value: "#8a96a3" },
];

export const deviceTypeOptions = [
  "router",
  "switch",
  "firewall",
  "server",
  "wireless",
  "workstation",
  "database",
  "nas",
  "camera",
  "printer",
  "iot",
  "hypervisor",
  "phone",
  "vpn",
  "cloud",
  "other",
  "unknown",
];

export const SUBNET_REF = [
  { prefix: 8,  mask: "255.0.0.0",       hosts: 16_777_214 },
  { prefix: 12, mask: "255.240.0.0",      hosts: 1_048_574  },
  { prefix: 16, mask: "255.255.0.0",      hosts: 65_534     },
  { prefix: 20, mask: "255.255.240.0",    hosts: 4_094      },
  { prefix: 22, mask: "255.255.252.0",    hosts: 1_022      },
  { prefix: 24, mask: "255.255.255.0",    hosts: 254        },
  { prefix: 25, mask: "255.255.255.128",  hosts: 126        },
  { prefix: 26, mask: "255.255.255.192",  hosts: 62         },
  { prefix: 27, mask: "255.255.255.224",  hosts: 30         },
  { prefix: 28, mask: "255.255.255.240",  hosts: 14         },
  { prefix: 29, mask: "255.255.255.248",  hosts: 6          },
  { prefix: 30, mask: "255.255.255.252",  hosts: 2          },
] as const;
