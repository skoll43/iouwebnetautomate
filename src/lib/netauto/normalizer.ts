// ============================================================
// Topology Normalizer
// Converts the loose abstract YAML into a strongly-typed,
// fully-resolved structure ready for template rendering.
// Supports both hierarchy styles:
//   (A) Declarative top-level `routing:` block — auto-applied to
//       every OSPF-capable device based on interface ospf_area tags.
//   (B) Per-device `routing: [...]` arrays — full control for
//       multi-protocol or asymmetric deployments.
// ============================================================

import {
  TopologyDef,
  DeviceConfig,
  DeviceRole,
  RoutingProtocol,
  GlobalRouting,
  EndpointDef,
} from "./types";
import { resolveVars } from "./resolver";

export interface NormalizedDevice {
  hostname: string;
  role: DeviceRole;
  platform: string;
  config: DeviceConfig;
  /** All VLAN definitions from the topology (resolved) */
  globalVlans: TopologyDef["vlans"];
  /** Global routing block (resolved) */
  globalRouting: TopologyDef["routing"];
  /** Endpoints defined in the topology (for documentation comment block) */
  endpoints: Record<string, EndpointDef>;
}

export function normalizeTopology(raw: TopologyDef): NormalizedDevice[] {
  const vars = raw.variables ?? {};
  // Resolve variable placeholders everywhere
  const topo = resolveVars(raw, vars) as TopologyDef;

  const devices: NormalizedDevice[] = [];
  const endpoints = (topo.devices?.endpoints ?? {}) as Record<string, EndpointDef>;

  const pushGroup = (
    group: Record<string, DeviceConfig> | undefined,
    role: DeviceRole
  ) => {
    if (!group) return;
    for (const [hostname, cfg] of Object.entries(group)) {
      // Clone + inject the hostname
      const deviceCfg: DeviceConfig = { hostname, ...cfg };

      // Auto-synthesize routing block from global routing hierarchy
      // if the device has none of its own.
      deviceCfg.routing = synthesizeRouting(deviceCfg, topo.routing, role, hostname);

      // Auto-fill interface descriptions from connected_to when empty
      if (deviceCfg.interfaces) {
        deviceCfg.interfaces = deviceCfg.interfaces.map((iface) => ({
          ...iface,
          description:
            iface.description ??
            (iface.connected_to ? `To ${iface.connected_to}` : undefined),
        }));
      }

      devices.push({
        hostname,
        role,
        platform: cfg.platform ?? "cisco_ios",
        config: deviceCfg,
        globalVlans: topo.vlans,
        globalRouting: topo.routing,
        endpoints,
      });
    }
  };

  pushGroup(topo.devices?.routers, "router");
  pushGroup(topo.devices?.layer3_switches, "l3_switch");
  pushGroup(topo.devices?.layer2_switches, "l2_switch");
  pushGroup(topo.devices?.firewalls, "firewall");

  return devices;
}

// ------------------------------------------------------------------
// Routing synthesis from the global declarative block
// ------------------------------------------------------------------

function synthesizeRouting(
  cfg: DeviceConfig,
  global: GlobalRouting | undefined,
  role: DeviceRole,
  hostname: string
): RoutingProtocol[] | undefined {
  // Device has its own routing configuration — honor it as-is.
  if (cfg.routing && cfg.routing.length > 0) return cfg.routing;

  // No global block or role is L2-only → nothing to do.
  if (!global) return undefined;
  if (role === "l2_switch") return undefined;

  const proto = (global.protocol ?? "").toString().toLowerCase();

  // Does this device have at least one interface that speaks this protocol?
  const hasOspfTag =
    (cfg.interfaces ?? []).some((i) => i.ospf_area !== undefined) ||
    (cfg.svis ?? []).some((s) => s.ospf_area !== undefined);

  if (proto === "ospf") {
    if (!hasOspfTag) return undefined;
    // The interface/SVI ospf_area tags are the source of truth for the
    // `network ... area N` lines — we set `areas: []` here so the OSPF
    // partial does NOT emit them again from the global block.
    // (Duplicate network statements are harmless on IOS but visually
    // noisy.)
    return [
      {
        protocol: "ospf",
        ospf: {
          process_id: global.process_id ?? 1,
          router_id: global.auto_router_id
            ? deriveRouterId(hostname, role)
            : undefined,
          areas: [],
        },
      },
    ];
  }

  if (proto === "eigrp") {
    if (!global.as_number) return undefined;
    return [
      {
        protocol: "eigrp",
        eigrp: {
          as_number: global.as_number,
          networks: global.networks ?? [],
          no_auto_summary: true,
        },
      },
    ];
  }

  return undefined;
}

/**
 * Derive a deterministic, role-scoped router-id.
 *   routers   : N.N.N.N         (R1 → 1.1.1.1,   R3 → 3.3.3.3)
 *   l3_switch : 10.N.N.N        (DLS1 → 10.1.1.1, DLS2 → 10.2.2.2)
 *   firewall  : 172.16.N.N      (FW1 → 172.16.1.1)
 *   fallback  : simple hash inside 10.0.0.0/8
 */
function deriveRouterId(hostname: string, role: DeviceRole): string {
  const digits = hostname.match(/\d+/);
  const n = digits ? parseInt(digits[0], 10) : NaN;
  if (!isNaN(n) && n > 0 && n < 256) {
    switch (role) {
      case "router":     return `${n}.${n}.${n}.${n}`;
      case "l3_switch":  return `10.${n}.${n}.${n}`;
      case "firewall":   return `172.16.${n}.${n}`;
      default:           return `${n}.${n}.${n}.${n}`;
    }
  }
  // Fallback: simple hash inside 10.0.0.0/8
  let h = 0;
  for (let i = 0; i < hostname.length; i++) h = (h * 31 + hostname.charCodeAt(i)) >>> 0;
  return `10.${(h >>> 16) & 0xff}.${(h >>> 8) & 0xff}.${h & 0xff}`;
}

// ------------------------------------------------------------------
// VLAN derivation
// ------------------------------------------------------------------

/**
 * Build the list of VLANs a given device should configure.
 * L3 switches: all vlans (they are the VTP server / SVI owner).
 * L2 switches: only the vlans referenced on their access ports.
 */
export function deviceVlans(
  device: NormalizedDevice
): Array<{ id: string; name: string }> {
  const globalVlans = device.globalVlans ?? [];
  if (device.role === "l3_switch") {
    return globalVlans.map((v) => ({ id: v.vlan_id, name: v.name }));
  }
  if (device.role === "l2_switch") {
    const usedIds = new Set<string>();
    for (const iface of device.config.interfaces ?? []) {
      if (iface.vlan) usedIds.add(iface.vlan);
    }
    return globalVlans
      .filter((v) => usedIds.has(v.vlan_id))
      .map((v) => ({ id: v.vlan_id, name: v.name }));
  }
  return [];
}

// ------------------------------------------------------------------
// OSPF network aggregation
// ------------------------------------------------------------------

/**
 * Aggregate all OSPF network/area statements to inject into the OSPF router
 * block, derived from per-interface and per-SVI ospf_area annotations.
 */
export function ospfNetworksForDevice(
  device: NormalizedDevice
): Array<{ network: string; wildcard: string; area: string | number }> {
  const result: Array<{ network: string; wildcard: string; area: string | number }> = [];

  for (const iface of device.config.interfaces ?? []) {
    if (iface.ospf_area !== undefined && iface.ip) {
      const { network, wildcard } = cidrToOspfNetwork(iface.ip);
      result.push({ network, wildcard, area: iface.ospf_area });
    }
  }

  for (const svi of device.config.svis ?? []) {
    if (svi.ospf_area !== undefined && svi.ip) {
      const { network, wildcard } = cidrToOspfNetwork(svi.ip);
      result.push({ network, wildcard, area: svi.ospf_area });
    }
  }

  return result;
}

/** Convert CIDR prefix to OSPF "network X.X.X.X wildcard A.A.A.A area N" */
export function cidrToOspfNetwork(cidr: string): { network: string; wildcard: string } {
  const [ip, prefixStr] = cidr.split("/");
  if (!prefixStr) return { network: ip, wildcard: "0.0.0.0" };
  const prefix = parseInt(prefixStr, 10);
  // Avoid the >>> 32 identity quirk in JS
  let mask = 0;
  if (prefix >= 32) mask = 0xffffffff;
  else if (prefix > 0) mask = (0xffffffff << (32 - prefix)) >>> 0;
  const wildcardMask = (~mask) >>> 0;
  const wildcard = [
    (wildcardMask >>> 24) & 0xff,
    (wildcardMask >>> 16) & 0xff,
    (wildcardMask >>> 8) & 0xff,
    wildcardMask & 0xff,
  ].join(".");
  const netInt = ipToInt(ip) & mask;
  return { network: intToIp(netInt), wildcard };
}

function ipToInt(ip: string): number {
  return ip.split(".").reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
}

function intToIp(n: number): string {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff].join(".");
}
