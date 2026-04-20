# NetAuto Lean Architecture

## Overview

NetAuto generates Cisco device configurations from YAML topology definitions. This document proposes a leaner architecture using a bicycle analogy: **the frame is the core, add-ons are optional features**.

---

## Current Architecture

### Data Flow

```
YAML Input → parse_yaml → normalizeTopology (resolve vars) → renderDevice (Nunjucks)
```

**Pipeline:**
1. `types.ts` (295 lines) - defines all topology structures
2. `normalizer.ts` - resolves variables and synthesizes routing
3. `resolver.ts` - string template variable substitution
4. `engine.ts` - Nunjucks rendering with custom filters
5. `templates/registry.ts` - device role templates
6. `templates/partials.ts` - reusable config blocks

### Code Size

| File | Lines | Purpose |
|------|-------|---------|
| types.ts | 295 | All type definitions |
| normalizer.ts | 256 | Topology normalization |
| engine.ts | 150 | Rendering engine |
| resolver.ts | 53 | Variable resolution |
| partials.ts | 202 | Template partials |
| registry.ts | 165 | Template registry |
| **Total** | **1121** | Core implementation |

---

## The Bicycle: Core vs Add-ons

### Frame (Core - Always Required)

The frame is what makes the bicycle functional - without it, nothing works. These are the essential features that **every** network needs:

| Feature | Types | Partial | Description |
|--------|-------|---------|-------------|
| **VLANs** | `VlanDef` | `VLAN_DB_PARTIAL` | Virtual LAN definitions |
| **Interfaces** | `InterfaceDef` | `INTERFACES_PARTIAL` | Access/trunk/routed ports |
| **Device Roles** | `DeviceRole` | template header | Router, L3, L2, Firewall |
| **Variables** | `VariableMap` | resolver | W, X, Y, Z substitution |

### Wheels (Common - Usually Needed)

Wheels are standard add-ons that most bicycles have but aren't strictly the frame:

| Feature | Types | Partial | Conditional | Description |
|--------|------|---------|-------------|-------------|
| **SVI** | `SviDef` | `SVI_PARTIAL` | if `svis` exists | Layer 3 VLAN interfaces |
| **Port Channels** | `PortChannelDef` | `PORT_CHANNELS_PARTIAL` | if `port_channels` exists | LACP/PAgP bundling |
| **Static Routes** | `StaticRoute` | `STATIC_ROUTES_PARTIAL` | if `protocol: static` | Basic routing |
| **Endpoints** | `EndpointDef` | `ENDPOINTS_PARTIAL` | if `endpoints` exist | Documentation |

### Add-ons (Advanced Features)

These are the premium accessories - great for specific use cases but optional:

| Feature | Types | Partial | Weight | Description |
|--------|------|---------|--------|---------|
| **OSPF** | `OspfConfig` | `OSPF_PARTIAL` | ~50 lines | Link-state routing |
| **EIGRP** | `EigrpConfig` | `EIGRP_PARTIAL` | ~40 lines | Distance-vector routing |
| **BGP** | `BgpConfig` | `BGP_PARTIAL` | ~45 lines | Border Gateway Protocol |
| **MST** | `MstConfig` | STP partial | ~30 lines | Multiple Spanning Tree |
| **DHCP** | `DhcpPoolDef` | `DHCP_PARTIAL` | ~35 lines | DHCP pools |
| **HSRP** | `HsrpConfig` | interface partial | ~15 lines | Gateway redundancy |
| **VTP** | `VtpConfig` | `VTP_PARTIAL` | ~10 lines | VLAN trunking protocol |
| **NTP** | `NtpConfig` | `NTP_PARTIAL` | ~5 lines | Time sync |
| **SSH** | `SshConfig` | `SSH_PARTIAL` | ~15 lines | Remote access |

---

## Lean Implementation Recommendations

### 1. Feature Flag System

Add a `features` top-level key to enable/disable routing protocols:

```yaml
topology_name: "lean-lab"
features:
  routing: ["ospf", "eigrp"]    # enabled protocols
  stp: "rapid-pvst"              # or "mst", "pvst", or false
  services: ["dhcp", "ntp"]        # enabled services

variables:
  W: "10"

vlans:
  - vlan_id: "{{W}}"
    name: "DATA"

devices:
  routers:
    R1:
      interfaces:
        - name: "G0/0"
          ip: "192.168.1.1/24"
```

**Implementation:**
```typescript
// normalizer.ts
interface FeatureFlags {
  routing?: ("ospf" | "eigrp" | "bgp" | "static")[];
  stp?: "pvst" | "rapid-pvst" | "mst" | false;
  services?: ("dhcp" | "ntp" | "ssh")[];
}

// In normalizeTopology, skip features not in the enabled list
function shouldIncludeRouting(protocol: string, features: FeatureFlags): boolean {
  if (!features.routing) return true; // all allowed if not specified
  return features.routing.includes(protocol as any);
}
```

### 2. Plugin System for Partial Templates

Create a registry with lazy loading:

```typescript
// templates/plugin-registry.ts
import type { PartialBlock } from "./types";

const PARTIAL_REGISTRY: Record<string, PartialBlock> = {
  interfaces: { template: INTERFACES_PARTIAL, weight: "core" },
  svi: { template: SVI_PARTIAL, weight: "common" },
  port_channels: { template: PORT_CHANNELS_PARTIAL, weight: "common" },
  ospf: { template: OSPF_PARTIAL, weight: "add-on", cost: 50 },
  eigrp: { template: EIGRP_PARTIAL, weight: "add-on", cost: 40 },
  bgp: { template: BGP_PARTIAL, weight: "add-on", cost: 45 },
  dhcp: { template: DHCP_PARTIAL, weight: "add-on", cost: 35 },
  // ...
};

export function loadPartials(features: string[]): string[] {
  return features.map(f => PARTIAL_REGISTRY[f]?.template).filter(Boolean);
}
```

### 3. Type Splitting

Move advanced types to separate files:

```
lib/netauto/
  types/
    core.ts        # VlanDef, InterfaceDef, DeviceConfig, TopologyDef
    routing.ts    # OspfConfig, EigrpConfig, BgpConfig
    services.ts   # DhcpConfig, NtpConfig, SshConfig
    stp.ts       # SpanningTreeConfig, MstConfig
```

**core.ts (~80 lines):**
```typescript
export interface VlanDef { vlan_id: string; name: string; subnet?: string; gateway?: string; }
export interface InterfaceDef { name: string; description?: string; ip?: string; type?: InterfaceType; /* ... */ }
export type DeviceRole = "router" | "l3_switch" | "l2_switch" | "firewall";
export interface DeviceConfig { hostname?: string; role?: DeviceRole; /* ... */ }
```

### 4. Template Composition

Build templates dynamically based on enabled features:

```typescript
// templates/builder.ts
function buildTemplate(role: DeviceRole, features: string[]): string {
  const partials = [
    getHeader(role),
    getCorePartials(),  // always included
    ...features.map(f => PARTIAL_REGISTRY[f].template),
  ];
  return partials.join("\n!\n");
}
```

---

## Simplification Opportunities

### Types (Current → Lean)

| Current Type | Category | Recommendation |
|-------------|----------|--------------|
| `OspfConfig` | add-on | Move to routing.ts |
| `EigrpConfig` | add-on | Move to routing.ts |
| `BgpConfig` | add-on | Move to routing.ts |
| `MstConfig` | add-on | Move to stp.ts |
| `DhcpPoolDef` | add-on | Move to services.ts |
| `HsrpConfig` | add-on | Inline into InterfaceDef |
| `NtpConfig` | add-on | Move to services.ts |
| `SshConfig` | add-on | Move to services.ts |

### Templates (Current → Lean)

The partials check for `if routing` / `if dhcp` etc. This is already efficient - leaner paths should be even simpler:

```nunjucks
{# CURRENT: always checks #}
{% for rp in routing %}{% if rp.protocol == "ospf" %}router ospf ...{% endif %}{% endfor %}

{# LEAN: omit entire block when routing array is empty #}
{% if routing | selectattr("protocol", "equalto", "ospf") | list %}
router ospf ...
{% endif %}
```

---

## Migration Path

### Phase 1: Feature Flags (Non-Breaking)

1. Add `features` to `TopologyDef` (optional field)
2. Modify `normalizeTopology` to respect flags
3. No changes to YAML input - backward compatible

### Phase 2: Type Splitting (Non-Breaking)

1. Create `lib/netauto/types/` directory
2. Move groups of types to separate files
3. Re-export from `types.ts` for backward compatibility

### Phase 3: Dynamic Templates (Breaking)

1. Update YAML schema to require explicit features
2. Build templates dynamically from feature list
3. Remove conditional checks for non-enabled features

---

## Summary

| Concept | Description |
|---------|-------------|
| **Frame** | VLANs + Interfaces + Device Roles + Variables |
| **Wheels** | SVIs + Port Channels + Static Routes + Endpoints |
| **Add-ons** | OSPF/EIGRP/BGP + MST + DHCP + HSRP + VTP + NTP + SSH |
| **Feature Flags** | Enable only needed add-ons |
| **Plugin Registry** | Lazy-load template partials |
| **Type Splitting** | Separate core vs advanced types |

The lean architecture should support:
- **Minimal path**: ~40 lines types + single template = basic VLAN/routed config
- **Full path**: Current 295 lines + all partials = all features
- **Custom path**: Feature flag to enable only what's needed