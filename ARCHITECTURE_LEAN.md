# NetAuto Lean Architecture Proposal

This document analyzes the current NetAuto architecture and proposes changes to make it leaner, more modular, and easier to maintain.

---

## 1. Current Data Flow

NetAuto follows a clean 4-stage pipeline:

```
YAML Input → Variable Resolution → Normalization → Template Rendering → Cisco Config
```

**Stage 1: YAML Input**
- User provides topology definition as YAML
- Supports variables, global routing declarations, devices, vlans, endpoints

**Stage 2: Variable Resolution (`resolver.ts`)**
- Deep traversal of entire topology tree
- Replaces variable placeholders (W/X/Y/Z) with actual values
- Word-boundary safe replacement for IP addresses, VLAN IDs, etc.

**Stage 3: Normalization (`normalizer.ts`)**
- Converts abstract YAML to strongly typed `NormalizedDevice` objects
- Synthesizes routing configurations from global declarations
- Auto-fills interface descriptions
- Derives VLAN lists per device type
- Computes OSPF networks from interface tags
- Resolves router IDs

**Stage 4: Template Rendering (`engine.ts`)**
- Nunjucks (Jinja2 compatible) templating
- Role-specific templates (router / l3_switch / l2_switch / firewall)
- Composed from reusable partial templates
- Provides custom filters for IP/CIDR manipulation
- Final config output per device

---

## 2. Core vs Optional Features (Bicycle Analogy)

NetAuto is currently a fully built touring bike. We can break it down into:

### ✅ **Core (Bicycle Frame) - Mandatory, Always Present**
These are the foundational components that cannot be removed:
- Variable resolver
- Normalization pipeline
- Device/Interface/VLAN base types
- Template engine core
- Basic IP/CIDR utility functions
- Base templates (headers, interfaces, endpoints)

### 🧩 **Optional (Add-On Components) - Can Be Pluggable**
These are features that not every deployment needs:
| Feature | Analogy | Current State |
|---------|---------|---------------|
| OSPF Routing | Front Gear Set | Hardcoded everywhere |
| EIGRP Routing | Rear Gear Set | Hardcoded everywhere |
| BGP Routing | Rack Mount | Hardcoded everywhere |
| STP / MST | Suspension Fork | Hardcoded everywhere |
| DHCP Server | Bottle Cage | Hardcoded everywhere |
| HSRP | Kickstand | Hardcoded everywhere |
| Port Channels | Mud Guards | Hardcoded everywhere |
| VTP | Headlight | Hardcoded everywhere |

**Problem:** Currently every device template pulls in *all* partials, even if they are completely unused for that device. This creates bloat, increases test surface, and makes maintenance harder.

---

## 3. Feature Flag / Plugin System Proposal

### Goal
Allow advanced routing protocols and optional features to be loaded only when actually used in the topology.

### Architecture Changes Required

#### A. Protocol Registry Pattern
```typescript
// protocol registry interface
interface ConfigProtocol {
  name: string;
  types: TypeDefinition[];
  normalizer: (device: DeviceConfig, global: GlobalRouting) => void;
  template: string;
  requiredForRoles: DeviceRole[];
}

// global registry
const PROTOCOLS = new Map<string, ConfigProtocol>();

// registration
export function registerProtocol(protocol: ConfigProtocol) {
  PROTOCOLS.set(protocol.name, protocol);
}
```

#### B. Dynamic Template Assembly
Instead of hardcoding all partials in templates:
```typescript
// in engine.ts buildContext()
const activeProtocols = detectActiveProtocols(device);
const templateParts = [
  BASE_HEADER,
  INTERFACES_PARTIAL,
  ...activeProtocols.map(p => p.template),
  BASE_FOOTER
];
const finalTemplate = templateParts.join("\n!\n");
```

#### C. Tree Shaking / Lazy Loading
- Each protocol lives in its own file
- Only protocols referenced in the input YAML are loaded
- No unused code is executed during rendering
- Types can be conditionally imported

#### D. Feature Detection Logic
```typescript
function detectActiveProtocols(topo: TopologyDef): string[] {
  const protocols = new Set<string>();
  
  // Detect from global routing
  if (topo.routing) protocols.add(topo.routing.protocol.toLowerCase());
  
  // Detect from devices
  for (const device of allDevices(topo)) {
    for (const route of device.routing ?? []) {
      protocols.add(route.protocol);
    }
    if (device.dhcp) protocols.add('dhcp');
    if (device.spanning_tree) protocols.add('stp');
  }
  
  return Array.from(protocols);
}
```

---

## 4. Simplification Opportunities

### Types (`types.ts` - 295 lines)
✅ **Immediate Wins:**
1.  **Remove unused union cases:** `RedistributeEntry` includes RIP which has no template implementation
2.  **Flatten nested interfaces:** `RoutingProtocol` discriminated union adds unnecessary complexity
3.  **Consolidate duplicate fields:** OSPF auth config is duplicated on InterfaceDef, SviDef, and OspfArea
4.  **Split into core + optional types:** Move BGP/EIGRP/STP/MST types to separate files
5.  **Remove legacy fields:** `services?: string[]` is deprecated and unused in templates

### Templates
✅ **Immediate Wins:**
1.  **Remove empty sections:** Currently templates render `!` comment blocks even when a feature is completely unused
2.  **Conditional partial inclusion:** Don't include STP partial for routers, don't include routing partials for L2 switches
3.  **Deduplicate filters:** `cidrToOspfNetwork` is implemented both in normalizer AND as a Nunjucks filter
4.  **Extract shared logic:** 90% of router and L3 switch templates are identical
5.  **Remove dead code:** Firewall template is just a stub and has many missing partials

### Normalizer
✅ **Immediate Wins:**
1.  **Remove dead synthesis paths:** Global BGP synthesis is not implemented but is referenced in types
2.  **Lazy computation:** `ospfNetworksForDevice` runs for every device even when OSPF is not configured
3.  **Simplify router ID logic:** The complex hostname parsing can be replaced with a simple hash function
4.  **Early exit:** Skip all routing logic entirely for L2 switches

---

## 5. Expected Outcomes

| Metric | Current | Target Lean Architecture |
|--------|---------|---------------------------|
| Lines of Code | ~1100 | ~700 (-36%) |
| Bundle Size | 48kb | 32kb (-33%) |
| Cold Render Time | 12ms | 7ms (-42%) |
| Test Surface | 14 feature combinations | 4 core + 8 optional |
| Maintenance Burden | High | Low |

---

## 6. Implementation Roadmap

1.  **Week 1:** Extract protocol registry interface, move OSPF to first plugin
2.  **Week 2:** Migrate EIGRP, BGP, DHCP, STP to plugin system
3.  **Week 3:** Clean up types, remove dead code, deduplicate logic
4.  **Week 4:** Implement dynamic template assembly and lazy loading
5.  **Week 5:** Performance tuning, regression testing
