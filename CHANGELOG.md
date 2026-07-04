# Changelog

## Unreleased

### Added
- **Toast notifications** — actions across the app (deletes, saves, imports) now confirm success or surface failures in a bottom-right toast stack instead of failing silently or relying on scattered inline text.
- **Styled destructive-action confirmations** — deleting devices, links, groups, locations, subnets, reservations, DHCP leases, schedules, roles, and saved searches now opens a consistent danger-styled dialog with consequence text; bulk device deletes of 5+ require typing `delete` to confirm.
- **Workspace crash containment** — an unexpected error in one workspace now shows a retryable fault card while the rest of NetMap keeps working, instead of a white screen.
- **Loading skeletons** — workspaces show shimmer skeleton layouts while data loads (route changes, VLANs, IPAM) instead of blank panels or plain "Loading…" text.
- **Response-time (RTT) threshold alert rules** — Admin → Alerts now offers a "Response time above threshold" trigger with a configurable millisecond threshold (per device or fleet-wide). The background monitor fires the rule when a device's probe RTT exceeds the threshold, reusing the existing notification channels and cooldown; a persistent high-latency condition re-alerts once per cooldown period. Migration `0036_alert_rule_threshold_ms` adds `alert_rules.threshold_ms`.
- **Pause monitoring per device** — devices can be paused from the device form or the Pause/Resume button in device details. Paused devices are skipped by live/background probes (no false offline alerts), show a gray "paused" status in Monitoring (with a Paused filter and fleet paused count), and stay in inventory/topology. Migration `0037_device_monitoring_fields`.
- **Device lifecycle states** — devices carry a lifecycle of planned / active / retired / ignored. Only active devices are monitored; the rest render as paused in Monitoring and show a lifecycle badge in device details.
- **HTTP/HTTPS service checks** — Monitoring service checks now support `HTTP` and `HTTPS` types with an optional request path (e.g. `/health`). A response below 500 counts as up (401/403/404 mean the service answered); TLS is not verified because LAN devices routinely use self-signed certificates. Migration `0038_service_check_http_path`.
- **Flapping detection** — devices whose status changes 4+ times within an hour get a "flapping" badge in the Monitoring table, and a new "Device is flapping" alert rule trigger fires through the normal notification channels with per-rule cooldown.
- **Notification delivery history** — every alert notification attempt is recorded (rule, target, sent/failed, provider error summary) and shown in Admin → Alerts → Delivery history. Records are pruned after 30 days. Migration `0039_notification_deliveries`.
- **Generic webhook notification method** — Admin → Notifications now offers "Generic webhook": NetMap POSTs `{"title": "NetMap", "message": …}` as JSON to any HTTP(S) endpoint, with an optional bearer token. Respects the private-target egress blocking setting.
- **IPAM next-available-IP** — the Reserve IP dialog can fill in the next free address of the selected subnet with one click, skipping used IPs, the gateway, and the DHCP pool.
- **IP reservation expiry dates** — reservations accept an optional expiry date; expired reservations are flagged in the reservations table and a "Clear expired" action removes them in bulk. Migration `0040_ip_reservation_expiry`.
- **Saved security searches** — the Security workspace can save the current filter set under a name and re-apply or delete it from a dropdown. Saved per user. Migration `0041_saved_security_searches`.
- **What's new popup** — after login, authenticated users see a once-per-installed-version popup summarising the changelog for the version they're running. It does not prompt when a newer tag is merely available; Admin → Version can reopen it manually. GitHub release notes for `v*` tags are generated from the same `CHANGELOG.md` in CI.
- **Custom device types** — the device form's type picker gained a "Custom…" option with a free-text name (e.g. iDRAC, UPS, PDU). Custom types display consistently in Inventory, Topology, filters, and exports, and fall back to the default device icon.
- **Interactive monitoring summary cards** — the Monitored/Online/Offline cards in Monitoring now click to apply the matching status filter (click again to clear).
- **GitHub Actions security scanning** — a new report-only `security-scan.yml` workflow runs Semgrep SAST plus `pip-audit` and `npm audit` on pushes, pull requests, and a weekly schedule. All jobs are non-blocking until the baseline is triaged.
- **Instant Monitoring re-entry** — the Monitoring workspace keeps an in-memory stale-while-revalidate snapshot of the fleet summary, device table, and service checks. Returning to Monitoring renders the last known data immediately, then refreshes with a lightweight delta request when fresh or a full refresh when stale.

### Fixed
- **Refreshing the browser on the IPAM page** no longer bounces to Overview — the router now restores every route, including `/ipam`.
- **Expired sessions mid-action recover transparently** — if the access token expires while the app is open (e.g. after laptop sleep), the next API call refreshes the session and retries once instead of surfacing a 401 error.
- **Background token refresh no longer flashes the loading screen** — the hourly session refresh (and any transparent 401 recovery) keeps the current page rendered instead of re-running the app bootstrap.
- **Modals are keyboard-trapped and restore focus** — Tab cycles within any open modal, background scrolling is locked, and focus returns to the triggering control on close.
- **Browser tab titles** now reflect the current page (e.g. "NetMap — Monitoring").
- **Scheduled discovery IP conflicts are review-only** — when a scheduled scan finds a MAC-matched device at an IP that already belongs to a *different* inventory device, the move is no longer misattributed as a field change on the occupying device. It now creates an `ip_change` observation against the MAC-matched device for manual review, and the IP is never auto-applied onto an occupied address.
- **Topology link form** endpoint pickers now render above the modal scroll layer with an opaque dropdown surface, preventing the source/target menu from being clipped, hidden, or see-through while creating or editing links.
- **Topology links dropdown** now uses fixed source/target/type columns so long link labels no longer shift row spacing.
- **Device pause controls** now update Topology/Inventory state consistently, show paused devices with neutral gray styling instead of red, and expose Paused in the Inventory status filter.
- **Monitoring drilldown pause control** now lets writable users pause/resume an individual active device from the Monitoring popup, while lifecycle-paused devices explain why they cannot be resumed there.
- **IPAM next-free reservation** is now visible from subnet rows and the subnet detail modal, not only inside the generic reserve dialog.
- **IPAM reserve and next-free actions** now use the secondary button treatment from the unified UI styles; the subnet popup keeps "Reserve next IP" in the top bar beside close.
- **Pause controls** in device details, Inventory details, and the Monitoring popup now use the shared secondary button treatment from the design-system preview.
- **Dark-mode secondary buttons** now use the same raised blue family as the Monitoring popup header, so pause/resume controls remain visible before hover without clashing with the modal surface.
- **Device detail status dots** now strobe subtly with a status-coloured glow so the selected device state feels live and interactive.
- **Monitoring status dots** now use a stronger status-coloured strobe in the device table and popup header, while respecting reduced-motion preferences.
- **Monitoring offline alert spacing** now has more even top/bottom padding so the alert bar feels balanced.
- **Monitoring summary cards** no longer show the active filter ring on the default Monitored card; only explicit status filters stay highlighted.
- **Paused device status** now uses a non-pulsing neutral gray treatment across Monitoring, Inventory/detail badges, topbar paused state, and topology labels.
- **Scheduled discovery disappeared-host alerts** now require three consecutive missed scheduled scans before opening a network-change observation, reducing noise from devices that only intermittently respond.

## [1.3.1] - 2026-06-28

### Security
- **Replaced `python-jose` with `PyJWT`** to remove the unmaintained `ecdsa` dependency.
- **Pinned `cryptography>=48.0.1`**, **`starlette>=1.3.1`**, upgraded DOMPurify, and upgraded Vite/plugin-react to address dependency advisories.
- **Password changes and resets now revoke active sessions**, invalidate sibling reset tokens, and require `APP_URL` before sending reset links.
- **RBAC checks tightened** for alert management, IPAM mutations, syslog WebSockets, and configurable `security_view` access.
- **Network tools hardened** against DNS rebinding; `X-Forwarded-For` parsing now uses the rightmost forwarded address.
- **Discovery/SNMP safeguards added** with manual scheduled-discovery single-flight enforcement and an SNMP walk wall-clock deadline.
- **Syslog TCP connection handling fixed** to avoid tracking unbounded per-connection thread references.

### Added
- **Overview favourites drilldown:** clicking a favourite device now opens a monitoring detail popup directly on Overview.
- **Monitoring favourites filter:** a star toggle filters the Monitoring device table to favourites only.
- **TCP/UDP service checks:** monitored port targets can now be TCP or UDP.
- **TCP/UDP tools port check:** the Tools port checker now supports both TCP and UDP.
- **Radial group layout:** topology groups can be arranged with a radial group layout option.

### Changed
- **Inventory default page size** now defaults to 25 rows and migrates old auto-saved 10-row preferences to 25 once, while preserving later manual choices.
- **Port-check naming** now uses generic "Port check" labels and API action names instead of TCP-only wording.
- **Upgrade docs** now `cd /opt/netmap` before pull, recreate, and backup commands.

### Fixed
- **Primary button styling** no longer gets overridden in modal headers.
- **Overview favourites popup** keeps users on Overview instead of navigating to Monitoring.
- **Alert monitor service checks** now honour the configured TCP/UDP check type.

## [1.3.0] - 2026-06-18

### Security
- **Replaced `python-jose` with `PyJWT`** — eliminates the unmaintained `ecdsa` dependency that had no available patch for a Minerva timing attack (CVE). `PyJWT 2.x` uses the `cryptography` backend directly.
- **Pinned `cryptography>=48.0.1`** to resolve the bundled vulnerable OpenSSL advisory.
- **Pinned `starlette>=1.3.1`** to address several Starlette advisories (form-body limit bypass, HTTP method dispatch, path poisoning).
- **Upgraded `dompurify` to 3.4.11** — resolves all six open DOMPurify advisories (IN_PLACE bypasses, hook mutation, cross-realm sanitisation, Trusted Types).
- **Upgraded `vite` to 8.x and `@vitejs/plugin-react` to 6.x** — resolves two Vite Windows dev-server advisories and brings in `esbuild 0.28.x` and `@babel/core 7.29.7+`.
- **XFF header parsing** now takes the rightmost entry from `X-Forwarded-For` instead of the leftmost, preventing attackers from spoofing their IP for rate-limiting and audit attribution.
- **Session revocation on password change/reset** — changing a password, completing a self-service reset, or an admin resetting a user's password now revokes all active refresh tokens for that user.
- **Sibling reset tokens invalidated** — issuing or consuming a password-reset link now invalidates all other pending reset tokens for that user, preventing a stale link from overriding the final password.
- **Password-reset links require `APP_URL`** — reset emails are only sent when `APP_URL` is explicitly configured; the `Host` header is no longer used as a fallback (prevents host-header poisoning).
- **Syslog WebSocket authenticates before reserving the shared slot** — unauthenticated connections can no longer exhaust the connection quota; the slot is only claimed after a valid token is presented.
- **Syslog WebSocket honours the configurable `security_view` permission** — access now uses the RBAC permission cache instead of hardcoded role names.
- **Alert routes use `alert_write` permission** — alert rule management now checks the correct configurable permission instead of `topology_write`.
- **IPAM mutation routes use `ipam_write` permission** — subnet, reservation, DHCP import, and VLAN-import routes now check the configurable `ipam_write` permission via the shared permission dependency, removing the hardcoded NetworkAdmin role bypass.
- **Syslog TCP thread leak fixed** — per-connection threads are no longer appended to the service's tracked thread list, preventing unbounded memory growth under sustained connection churn.
- **DNS rebinding mitigated in network tools** — `ping`, `traceroute`, and `tcp_port_check` now resolve the hostname once and validate the resulting IP before passing it to the subprocess or socket, eliminating the time-of-check/time-of-use gap.
- **Manual scheduled discovery enforces single-flight** — the HTTP endpoint now uses the same lock+set guard as the scheduler loop, preventing concurrent nmap processes for the same schedule from being spawned via rapid API calls.
- **SNMP walk has a wall-clock deadline** — `SnmpClient.walk()` now accepts a `max_wall_seconds` parameter (default 30 s) and stops after that time, preventing a slow or controlled target from holding a worker thread indefinitely.

## [1.3.0] - 2026-06-16

### Changed
- **IP address placeholders** across discovery, device forms, VLAN/IPAM fields, and network tools now use generic `192.168.1.x` examples.
- **Inter font bundled:** The UI now ships Inter (weights 400–600) via `@fontsource/inter` instead of relying on a system-installed font. Typography is consistent across browsers and containers; body text uses weight 400 with antialiasing for a lighter feel.
- **Consistent modals and controls:** Shared modal shell, buttons, search inputs, and status pills are now used across IPAM, Inventory, Monitoring, Topology, Locations, Admin, and related panels — dialogs, toolbars, and forms behave the same way throughout the app.
- **Primary action buttons** use a deeper teal instead of the brighter accent, so `+ Device` and other primary CTAs are less visually loud.
- **Discovery scan SNMP** is now a dedicated toggle button with a labelled configuration panel, instead of a checkbox buried in the form. Post-scan actions separate "Import selected" (primary) from "Update existing" (secondary).
- **Sidebar:** Overview uses a home icon (Monitoring keeps the activity chart icon). The NetMap brand navigates to Overview; collapse is a compact icon on the right.
- **Announcement banner (MOTD)** uses a purple alert style to distinguish it from offline and network-update notices.

### Added
- **Overview — Recently updated:** Users with write access can add a device or run a network scan from the Recently updated panel header (and empty state).
- **Overview favourites drilldown:** Clicking a favourite device on the Overview page now opens a monitoring detail popup without leaving Overview.
- **VLAN filter** in the Monitoring workspace: a dropdown next to the site filter lets you narrow the device list by VLAN ID.
- **Favourites filter** in the Monitoring workspace: a star toggle now filters the device table to favourites only, matching Inventory.

### Fixed
- **Icon Manager server-pack path** no longer shows the internal `dev/` prefix in the help text.
- **Search box focus rings** in Inventory, Locations, and Monitoring now align with the outer search container instead of glowing around the inner input only.
- **Monitoring search** no longer shows a double border from overlapping wrapper and input styles.
- **Monitoring "Reset columns"** removed — column widths are fixed by default.
- **Locations "View larger map" link** no longer has a pill background behind the text.
- **Discovery scan modal actions** no longer sit on a shaded footer bar.
- **Monitoring search** shows a single outer border (no double-border from wrapper + input).
- **Topology ribbon toolbar** normalises button, select, and status chip heights; `+ Device` matches other controls.
- **Inventory MOTD spacing** tightened so the announcement bar sits closer to the stat cards below it.
- **Inventory table** uses the full panel width on wide (1440p) screens with rebalanced column proportions.
- **IPAM subnet drilldown tabs** no longer cause a horizontal scrollbar; tabs use an equal-width grid within the modal.
- **IPAM subnet drilldown address table** no longer inherits the monitoring table’s 1580px minimum width. Columns are equal thirds; IP addresses are left-aligned, Status and Label are centred. Label shows inventory display names (with hostname fallback for registered devices; DHCP entries match inventory by MAC when possible).
- **Overview favourites row** alignment: uptime, RTT, and star columns line up correctly; RTT hides on narrow viewports without breaking the grid.
- **Inventory default page size** now migrates old auto-saved 10-row preferences to 25 rows once, while still allowing users to choose 10 rows afterward.
- **Monitoring group dropdown** was missing groups for devices whose group was set via a topology group relationship rather than the denormalised string field. The monitoring API now falls back to the `TopologyGroup` table by FK when the string field is null.
- **Topology sidebar** open/close no longer recentres or pans the map. Previously `cy.fit()` was being called on sidebar toggle, which would jump the viewport. The sidebar now only calls `cy.resize()` (resize without refit).
- **Topology zone backgrounds** no longer flicker every 30 seconds during live status polling. The zone style effect had `filteredGraph` in its dependency array; since the style values don't depend on device data, it was needlessly re-applying styles on every status poll.
- **Monitoring probe reliability:** ICMP failure messages are now logged at `WARNING` level (visible at the default `info` log level) instead of `DEBUG`, making it easier to diagnose devices showing offline. The probe also logs raw ping output when ICMP succeeds but returns zero replies. The `received` field is now handled null-safely so a parse failure no longer silently shadows the underlying error.
- **ICMP monitoring now works correctly:** `apt-get install iputils-ping` runs `setcap cap_net_raw+ep /bin/ping || true` in its postinstall script — the `|| true` meant `setcap` silently failed in Docker's build sandbox (which doesn't grant `CAP_SETFCAP`), leaving the `ping` binary with no file capability. The Dockerfile now installs `libcap2-bin` and runs `setcap cap_net_raw+ep /bin/ping` explicitly in the same `RUN` layer, which runs with the full build-time capability set and correctly stamps the capability on the binary. Previously only TCP fallback was ever used for monitoring probes.

---

## [1.2.9] - 2026-06-15

### Fixed
- Corrected version identifier to resolve a false "update available" notification caused by a duplicate tag during the 1.2.8 release.

---

## [1.2.8] - 2026-06-14

### Added
- **LLDP Neighbours tool** (Tools workspace): queries a device's LLDP-MIB over SNMP to discover adjacent devices on each switch port. Results are matched to inventory by MAC, management IP, or hostname; unmatched neighbours are flagged. One-click topology link creation from matched pairs.
- **OS field** on devices: stores the operating system string (e.g. "Ubuntu 24.04", "Cisco IOS"), editable inline in device details or via the Add/Edit form. SNMP enrichment preview now suggests `sysDescr` as the OS and `sysName` as the hostname for the source device when those fields are blank.
- **Created timestamp** in device details (read-only).
- **Port ranges and comma-separated ports** in service checks: the port field now accepts `443`, `67,68`, `8080-8090`, or any combination — one check entry is created per port under the same label.
- **Last poll relative time**: the topbar "Last poll" indicator now shows a live "(X min ago)" note that updates every 30 seconds.
- **Service check device picker**: the "Specific device" form now includes a searchable dropdown so you no longer need to pre-click a device in the table before adding a scoped check. The dropdown has an embedded search field that filters in real time.
- **IPAM range reservations**: the Reserve IP dialog now accepts a range in the IP address field (e.g. `192.168.1.10-35`). Entering a range shows a live count preview and creates all IPs in sequence on submit. MAC address field is hidden in range mode.

### Changed
- **Admin Credentials tab renamed to "SNMP Profiles"** for clarity — the tab manages SNMP community strings and auth profiles, not user credentials.
- **Automation tab change observations** now use the card-row layout (type badge, summary, identity, schedule name, Acknowledge/Resolve actions), matching the discovery modal style.
- **Port Monitoring modal** (formerly "Service Checks"): renamed, widened, and redesigned to a horizontal two-column layout with the form on the left and the active-checks list on the right. The device picker supports multi-selection with a live search bar and scrollable device list.
- **IPAM reserved colour** changed from purple to deep teal to better match the green/teal palette.
- **IPAM DHCP range pill** in dark mode is now muted (dimmer border and text) to reduce visual noise.
- **IPAM free-cell hover** colour changed to `#2dba7c` (device green) with matching legend and tooltip dot.
- **Login screen** now displays the app favicon (with dark rounded background) in place of the generic network icon, on both the left branding panel and the login form header. The left panel has a soft teal glow behind the icon.
- Dark mode is now the default theme for new installations and users who have not previously set a preference.
- Frontend `npm run dev` now uses port 5173 and proxies `/api` to the local AIO container on `127.0.0.1:8090` by default, so CSS/React changes can be hot-reloaded from VS Code without rebuilding the container.

### Fixed
- **Public IP monitoring**: registered devices with public IPs were always probed as offline. The background monitor now probes all registered devices regardless of the public-targets gate (that restriction applies only to interactive Tools pings).
- **Monitoring panel height**: the Devices panel no longer has a fixed 520 px cap — it expands to fill available viewport height.
- **Monitoring table spacing**: the device column now uses aligned lanes for device identity, a compact heartbeat strip, and a lighter mini RTT graph, while uptime, RTT, service, checked, and favourite columns stay compact on the right.
- **Monitoring "X minutes ago" timezone offset**: `func.max(checked_at)` from SQLite returns a naive datetime; JavaScript was parsing it as local time, producing large offsets for non-UTC users. Fixed by applying `_as_utc()` to all three `checked_at` datetime fields in the monitoring API response.
- **Port checks now run in parallel**: sequential 2-second TCP timeouts across all devices × all port targets could push the effective monitor cycle far beyond the configured interval. Checks now run concurrently (up to 12 connections), matching the existing ICMP approach.

---

## [1.2.7] - 2026-06-03

### Discovery
- Added scheduled discovery scans with review-only network-change observations for new devices, MAC-matched IP changes, changed device fields, and disappeared hosts.
- Discovery schedules can run automatically or on demand, retain normal scan records, optionally notify through saved notification profiles, and avoid silently mutating inventory.
- Discovery now recognizes existing devices by normalized MAC address when a DHCP/Wi-Fi device returns at a new IP.
- Discovery import can explicitly update the IP address for a MAC-matched device when "Update IP when MAC matches" is selected.

### Monitoring
- Cleaned up the selected-device RTT chart with a lighter line, subtle guide grid, smaller endpoint marker, and dark-mode chart colors.
- Inventory uses the shared Monitoring-style live status pill, while Topology no longer shows a map-level Live/Paused pill.
- Monitoring device analysis now normalizes SQLite-returned timestamps as UTC before Python-side comparisons, preventing 500 errors from mixed naive/aware datetimes.
- Persisted monitoring status now feeds the shared frontend graph and Topology canvas, so status changes update node badges, details, and graph colors consistently instead of only the Inventory table.
- Background monitoring now falls back to a short TCP reachability probe when ICMP ping is unavailable, avoiding all devices being marked `unknown` in restricted container runtimes.
- Fixed a bug where the port-target DB query ran outside its SQLAlchemy session context, causing every monitor cycle to raise an error and never write device status or history rows to the database.
- Reduced the initial startup delay before the first monitor cycle from 30 seconds to 5 seconds so status indicators appear promptly after the container starts.
- Reduced the per-device ICMP probe from 2 packets / 2-second timeout to 1 packet / 1-second timeout, halving the check duration for offline devices without affecting cycle reliability.
- Favourite device status dots on the Overview page now reflect the live polling state from the shared graph rather than the one-time snapshot loaded on mount.

### Topology
- Scaled the topology group background slider so the UI still runs 0-100% while the effective background opacity stays capped at 10%.

### Security / Syslog
- OpenWrt banIP firewall prefixes now parse action, chain/context, and feed/list metadata.
- Corrupt `firewall.db` files encountered during retention cleanup are now recreated automatically instead of leaving startup maintenance errors in the logs.
- Firewall retention cleanup now skips overlapping in-process runs and defers gracefully when SQLite reports `database is locked`, avoiding startup maintenance tracebacks while retrying on the next retention pass.
- Security raw-log search now matches individual prefix terms instead of requiring the full query as an exact phrase.
- Security filters now use draft values with an explicit Search button or Enter key; quick filters and clickable event cells still apply immediately.
- Active network tool subprocess execution now allowlists ping/traceroute commands and rejects control characters in command arguments.

### Admin
- Added an Automation tab to the Admin panel with scheduled scan management (create, enable/pause, run on demand, delete) and a change observations panel (new device, IP change, field change, disappeared) with acknowledge and resolve actions.

### UI / General
- Overview panel headers are now consistent: top-row panels (Network health, Device types, Top groups) all use the standard header height, and the bottom-row Favourites header uses the compact variant so it aligns with Recently updated.
- Monitoring table now has a status filter dropdown (All / Online / Offline / Warning / Unknown) and a sortable status column header (asc = online first, desc = offline first).
- Topology entity dropdowns (Devices, Links, Groups) now have a sticky search bar that clears automatically when switching sections; items filter in real time against name, IP, link endpoints/type, or group name.
- Hovering a row in the entity panel now illuminates the corresponding node/edge on the canvas via a Cytoscape shadow glow (teal for devices and their connected edges, purple for group zones and member nodes, teal for link endpoints).
- Topology entity dropdown rows glow on hover via a subtle ring box-shadow (teal for devices/links, purple for groups).
- Search bar in dark mode now inherits the dropdown background seamlessly instead of rendering with a distinct white box.
- Fixed topology groups dropdown rendering the visibility eye button on a blank second line by correcting the grid column count from 3 to 4.
- Fixed topology links dropdown arrow asymmetry by centering the arrow glyph and widening its column from 14px to 22px.

### Exports / Operations
- Dev AIO compose now defaults `TRUSTED_HOSTS` to `["*"]` so local dev images can be opened through LAN IPs or hostnames without the SPA startup API calls returning 400.
- Network report PDF generation now skips malformed or unreadable `firewall.db` summary data instead of returning HTTP 500.
- Topology PNG export now renders via SVG→canvas using the same drawing logic as the SVG download; device icons, group zone boxes and labels, device name labels, and link labels (with background pill matching live-map style) all export correctly. Export is theme-aware (light/dark mode colours). Edge lines clip to each node's bounding-box boundary so connections to large zone groups terminate at the zone border rather than the center.
- Dev and test builds now track candidate `1.2.7` while production remains `1.2.6`.

---

## [1.2.6] - 2026-06-01

### Discovery
- Added discovery result review for rescans: scan results now show whether each host is new, already known, or has changed inventory fields.
- Discovery import can now add only new devices, fill missing hostname/MAC/vendor values, or explicitly override selected existing fields.
- Discovery can enrich missing MAC/vendor details from router or L3-switch SNMP ARP tables, including a default ARP source from the selected VLAN/group gateway when available.

### SNMP
- Added an SNMPv2c probe tool for system identity, interface state, and ARP table reads.
- Added encrypted SNMP credential profiles managed from Admin -> Credentials.
- Devices can be assigned SNMP profiles, and router/L3-switch details can preview and apply ARP-table enrichment to matching inventory devices.

### Monitoring
- Added the first named service-check foundation: TCP service checks can be managed globally or per device through Monitoring.
- Monitor history now stores richer service result metadata while retaining compatibility with existing port-result rows.
- Admin live-ping changes now update the app shell immediately; Inventory, Topology, and Monitoring clearly show when live polling is disabled.

### Version Display
- Dev and test builds can display channel labels such as `Dev: 1.2.6` or `Test: 1.2.6` when a `VERSION_CHANNEL` file is present.
- Version checking now treats a local candidate version ahead of the latest production tag as up to date.

---

## [1.2.5] - 2026-05-27

### Docker / Runtime
- Fixed startup 502s where nginx could not reach `/tmp/uvicorn.sock` while firewall search-index maintenance ran during FastAPI startup.

---

## [1.2.4] - 2026-05-27

### Topology
- Topology layouts and display preferences now autosave per user and sync across devices.
- Fixed layout reloads overwriting saved node positions with stale canvas state.
- Link creation now uses a searchable endpoint picker.
- Map labels and link selection are easier to use on dense topology views.
- Firewall activity is no longer aggregated across all devices when the topology page opens; selected-device activity loads on demand.
- Updating VLAN DNS settings no longer crashes when IPAM contains separate subnet rows matching the same VLAN and CIDR.

### Performance
- Workspaces now load on demand, so heavier pages like Topology are not bundled into the initial app load.

### Docker / Runtime
- Corrupt `firewall.db` startup state is recovered automatically by recreating only the firewall/syslog event database.

---

## [1.2.3] - 2026-05-25

### Security / Session
- Firewall raw-log search index recovery now rebuilds malformed FTS state before running index health checks, preventing damaged search indexes from blocking application startup.

---

## [1.2.2] - 2026-05-25

### Docker / Runtime
- Added a backwards-compatible AIO entrypoint path so containers still start when an environment references the previous `/app/docker/aio-entrypoint.sh` location.

### Security / Session
- Firewall raw-log search index startup now detects malformed FTS state and rebuilds the derived index instead of blocking application startup.

---

## [1.2.1] - 2026-05-25

### Topology
- Saved topology layouts now persist reliably per user after Docker image upgrades.
- Group anchor positions are preserved with device positions, and invalid saved coordinates are ignored instead of breaking the topology page.

### Docker / Runtime
- AIO image startup files now install to fixed runtime paths and are verified during the image build to prevent missing-entrypoint startup failures.

### Security / Session
- Notification delivery failures now return sanitized messages to the UI while detailed diagnostics stay in server logs.

### Network Tools
- Ping and traceroute target handling now resolves hostnames before execution and passes normalized targets safely to subprocesses.

---

## [1.2.0] - 2026-05-24

### Favourites
- Favourites are now per-user rather than global; each account maintains its own starred device set stored in a new `user_device_favourites` table.
- Favourite state is fetched once per session and overlaid in the frontend, keeping the global monitoring cache intact.

### Admin
- Added SuperAdmin login-lockout unlock controls for user accounts.
- Added a System diagnostics panel with database sizes, WAL sizes, monitoring cache/status counters, syslog retention details, process PID, and manual refresh.
- App name setting now correctly updates the brand name displayed on the login screen (was previously hardcoded to "NetMap").

### Monitoring / Performance
- Heartbeat queries use `ROW_NUMBER()` window function for more efficient per-device latest-event retrieval.
- Monitoring poll uses a `changed_since` cursor so only devices with status changes are returned on subsequent polls, reducing payload size.
- Device status event aggregation and IP pre-parsing moved to SQL, reducing Python-side processing.

### Backend / Performance
- Discovery scans now support private IPv4 and IPv6 `start-end` ranges by converting validated ranges to nmap-safe CIDR targets while preserving the displayed input.
- IPAM subnet utilization now uses per-request numeric IP indexes and binary-search counts instead of repeatedly scanning all known IPs per subnet.
- Firewall `raw_log` search now uses SQLite FTS5 with startup-created sync triggers and existing-row rebuild support.
- Added SuperAdmin-only `/api/v1/system/diagnostics` for lightweight runtime diagnostics.

### Docker / Runtime
- Moved the AIO image entrypoint to `/usr/local/bin/netmap-aio-entrypoint` and nginx template to `/etc/netmap/aio-nginx.conf.template`; the image build now verifies both files exist to prevent startup failures from a missing `/app/docker/aio-entrypoint.sh`.

### Security / Session
- Logout and idle cleanup can revoke sessions via the refresh cookie without requiring a still-valid access token.
- CSRF cleanup clears the root-path cookie used by the SPA.

### Network Tools
- Bounded DNS, ping, traceroute, hostname resolution, and active tool subprocess timeouts to avoid tying up backend workers.

### Topology
- Group boxes no longer drift downward on the map when the spacing or per-row slider is dragged.

---

## [1.1.0] - 2026-05-23

### Inventory
- Redesigned header: icon-box stat chips, merged filter/bulk-edit row, quick status-filter dropdown
- Pagination with per-page selector (persists via `localStorage`)
- DeviceTypeIcon in table, bulk-edit type dropdown, and device details panel
- VLAN and Location cells show small coloured icons

### IPAM
- Removed Conflicts stat chip; conflicts banner is now full-width
- Subnets table fills page width (removed grid wrapper)
- Reservations panel: subnet filter dropdown, delete button on existing reservations, table header icons
- Free-address hover changed from purple to teal; added "click to reserve" hint text

### UI / General
- Light mode panel headers softened to `#edf3f7` across overview, monitoring, and IPAM
- Cancel button styling fixed consistently across all modal and popup contexts
- Topology toolbar dark mode polish

### Frontend (internal)
- `main.tsx` (12,790 lines) fully split into ~55 focused modules
- `src/utils/` — IP math, formatters, sort, topology, relationships, security, CSV, monitoring, download
- `src/components/` — 13 atom components (Modal, DashStat, HealthDonut, IpGrid, HeartbeatBar, etc.)
- `src/features/` — auth views, device/topology/IPAM forms and panels, all 12 workspace pages
- `src/App.tsx`, `src/Sidebar.tsx`, `src/views/` — shell extracted; `main.tsx` is now a 10-line entry point

---

## [1.0.5] - 2026-05-20

- Separate `firewall.db` to isolate syslog flood writes from main app
- SQLite WAL mode + `busy_timeout=5000` on both databases
- nmap discovery runs via `sudo` inside the container
- CSRF cookie `path` fixed to `"/"` so the SPA can read it on all routes
- Syslog blank-entry filter (skips events where all parsed fields are None)
- Firewall logs UI rework: action pills, quick filter buttons, dark mode variants
- Version display reads `/app/VERSION` file; version checker uses GitHub tags API
- Timezone support added to container
- Firewall live-tail fix
- Discovery scan auto-populates group IP range
- UI consistency pass across pages
