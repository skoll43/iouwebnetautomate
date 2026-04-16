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
