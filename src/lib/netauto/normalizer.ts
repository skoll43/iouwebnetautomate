// ============================================================
// Topology Normalizer
// Converts the loose abstract YAML into a strongly-typed,
// fully-resolved structure ready for template rendering.
// ============================================================

import { TopologyDef, DeviceConfig, InterfaceDef, DeviceRole } from "./types";
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
}

export function normalizeTopology(raw: TopologyDef): NormalizedDevice[] {
  const vars = raw.variables ?? {};
  // Resolve variable placeholders everywhere
  const topo = resolveVars(raw, vars) as TopologyDef;

  const devices: NormalizedDevice[] = [];

  const pushGroup = (
    group: Record<string, DeviceConfig> | undefined,
    role: DeviceRole
  ) => {
    if (!group) return;
    for (const [hostname, cfg] of Object.entries(group)) {
      devices.push({
        hostname,
        role,
        platform: cfg.platform ?? "cisco_ios",
        config: { hostname, ...cfg },
        globalVlans: topo.vlans,
        globalRouting: topo.routing,
      });
    }
  };

  pushGroup(topo.devices?.routers, "router");
  pushGroup(topo.devices?.layer3_switches, "l3_switch");
  pushGroup(topo.devices?.layer2_switches, "l2_switch");
  pushGroup(topo.devices?.firewalls, "firewall");

  return devices;
}

/**
 * Build the list of VLANs a given device should configure.
 * L3 switches: all vlans (they are the VTP server / SVI owner).
 * L2 switches: only the vlans referenced on their access ports.
 */
export function deviceVlans(device: NormalizedDevice): Array<{ id: string; name: string }> {
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
