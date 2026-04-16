# Active Context: NetAutoGen — Cisco Config Generator

## Current State

**Project Status**: ✅ NetAutoGen network automation tool built on top of Next.js template

The application converts abstract YAML topology definitions into Cisco IOS device configurations
using a Nunjucks (Jinja2-compatible) template engine with multi-protocol support.

## Recently Completed

- [x] Extensible YAML topology schema (`src/lib/netauto/types.ts`)
- [x] Variable resolver for W/X/Y/Z placeholder interpolation (`resolver.ts`)
- [x] Topology normalizer with role detection + OSPF network derivation (`normalizer.ts`)
- [x] Nunjucks rendering engine with custom IOS filters (`engine.ts`)
- [x] Partial templates for all supported protocols/features (`templates/partials.ts`)
- [x] Template registry mapping DeviceRole → full config template (`templates/registry.ts`)
- [x] Two built-in example topologies (`examples.ts`)
- [x] POST `/api/render` route
- [x] Interactive Next.js UI with IOS syntax highlighting (`NetAutoApp.tsx`)
- [x] Dark theme styled for terminal/network engineer UX

## Current Structure

| File/Directory | Purpose | Status |
|----------------|---------|--------|
| `src/lib/netauto/types.ts` | TypeScript interfaces for full topology schema | ✅ |
| `src/lib/netauto/resolver.ts` | Variable placeholder resolution | ✅ |
| `src/lib/netauto/normalizer.ts` | Topology normalization, OSPF helper math | ✅ |
| `src/lib/netauto/engine.ts` | Nunjucks render engine + custom filters | ✅ |
| `src/lib/netauto/templates/partials.ts` | All Nunjucks partial templates | ✅ |
| `src/lib/netauto/templates/registry.ts` | Per-role full config templates | ✅ |
| `src/lib/netauto/examples.ts` | Built-in example YAML topologies | ✅ |
| `src/lib/netauto/index.ts` | Public API (`renderTopology`) | ✅ |
| `src/app/api/render/route.ts` | POST /api/render endpoint | ✅ |
| `src/components/NetAutoApp.tsx` | Main interactive UI (client component) | ✅ |
| `src/app/page.tsx` | Home page | ✅ |

## Architecture

```
YAML string
  ↓ js-yaml parse
TopologyDef (raw)
  ↓ resolveVars() — replace W/X/Y/Z everywhere
TopologyDef (resolved)
  ↓ normalizeTopology() — split into NormalizedDevice[]
NormalizedDevice[]
  ↓ renderDevice() per device — Nunjucks + TEMPLATES[role]
RenderResult[] — { device, role, config }
```

## Supported Protocols / Features

- **Routing**: OSPF (multi-area), EIGRP, BGP (iBGP/eBGP), Static routes
- **L2**: VLANs, STP/RSTP, VTP, Trunk/Access ports
- **Port Channels**: PAgP (desirable), LACP (active), Static (on)
- **Services**: DHCP server (pools + excluded), NTP, SSH/AAA
- **Redundancy**: HSRP (standby groups, priority, preempt)
- **Variable system**: Abstract labels (W/X/Y/Z) resolved before render

## Extensibility Points

To add a new protocol:
1. Add type in `types.ts`
2. Write a partial in `templates/partials.ts`
3. Import + inject it into the relevant role template in `templates/registry.ts`

## Dependencies Added

- `js-yaml` — YAML parsing
- `nunjucks` — Jinja2-compatible templating
- `@types/js-yaml`, `@types/nunjucks` — TypeScript types

## Session History

| Date | Changes |
|------|---------|
| Initial | Template created with base setup |
| 2026-04-16 | Built full NetAutoGen network automation tool |
| 2026-04-16 | Fixed dark theme Tailwind v4 preflight conflicts |
| 2026-04-16 | Major config-correctness audit & fixes: /32 mask, static route newline, DHCP indent, native VLAN, nonegotiate, SVIs with HSRP, L3 switch routed-interface `no switchport`, ospf_area on SVIs, port-channel member switchport, bpduguard per-port |
| 2026-04-16 | Added MST support: MstConfig + MstInstance types, region/revision/instance mappings, per-instance root role + explicit priority + timers; new EXAMPLE_MST topology; `spanning-tree extend system-id` emitted by default; vlan_priorities override field for PVST |
| 2026-04-16 | Declarative top-level routing hierarchy: `routing: {protocol, process_id, auto_router_id, areas[]}` auto-synthesizes per-device OSPF blocks from interface `ospf_area` tags. Added `endpoints:` section (PCs/hosts) rendered as documentation comment block. `connected_to` now auto-fills interface descriptions. `auto_router_id` produces role-scoped unique IDs (R1→1.1.1.1, DLS1→10.1.1.1, FW1→172.16.1.1). OSPF network statement dedup across global+interface-derived sources. |

## Config Correctness Checklist (verified)

- ✅ `/32` → `255.255.255.255` (fixed JS `>>> 32` quirk)
- ✅ Static routes terminated with `\n` before `!` separator
- ✅ DHCP pool sub-commands have single-space indent
- ✅ Trunk ports include `switchport nonegotiate` + `switchport trunk native vlan`
- ✅ Access ports include per-port `spanning-tree portfast` + `bpduguard enable`
- ✅ L3 switch routed interfaces get `no switchport` before `ip address`
- ✅ SVIs render with HSRP, helper-address, and OSPF integration
- ✅ Port-channel members include `switchport` before `channel-group`
- ✅ PAgP `desirable↔desirable` and LACP `active↔active` supported
- ✅ HSRP primary/standby priorities (110/100) with preempt
- ✅ SVI networks auto-advertised into OSPF via `ospf_area` on SviDef
- ✅ Variable placeholders (W/X/Y/Z) resolve inside `native_vlan`, `allowed_vlans`, `ospf_area`
