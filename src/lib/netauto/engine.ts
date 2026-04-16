// ============================================================
// Template Rendering Engine
// Uses Nunjucks (Jinja2-compatible) to render per-device configs
// from a NormalizedDevice context.
// ============================================================

import nunjucks from "nunjucks";
import { NormalizedDevice, deviceVlans, ospfNetworksForDevice } from "./normalizer";
import { cidrToOspfNetwork } from "./normalizer";
import { TEMPLATES } from "./templates/registry";

// ------------------------------------------------------------------
// Custom Nunjucks filters
// ------------------------------------------------------------------

const env = nunjucks.configure({ autoescape: false, trimBlocks: true, lstripBlocks: true });

/** cidr_to_mask: "10.0.0.1/24" → "10.0.0.1 255.255.255.0" */
env.addFilter("cidr_to_mask", (cidr: string) => {
  if (!cidr || !cidr.includes("/")) return cidr;
  const [ip, prefixStr] = cidr.split("/");
  const prefix = parseInt(prefixStr, 10);
  // Build mask avoiding >>> 32 quirk in JS (shift counts are mod 32).
  let mask = 0;
  if (prefix >= 32) mask = 0xffffffff;
  else if (prefix > 0) mask = (0xffffffff << (32 - prefix)) >>> 0;
  const maskStr = [(mask >>> 24) & 0xff, (mask >>> 16) & 0xff, (mask >>> 8) & 0xff, mask & 0xff].join(".");
  return `${ip} ${maskStr}`;
});

/** ip_only: "10.0.0.1/24" → "10.0.0.1" */
env.addFilter("ip_only", (cidr: string) => cidr?.split("/")?.[0] ?? cidr);

/** prefix_only: "10.0.0.1/24" → "24" */
env.addFilter("prefix_only", (cidr: string) => cidr?.split("/")?.[1] ?? "32");

/** wildcard: "10.0.0.0/24" → "0.0.0.255" */
env.addFilter("wildcard", (cidr: string) => {
  const { wildcard } = cidrToOspfNetwork(cidr);
  return wildcard;
});

/** network_addr: "10.0.0.1/24" → "10.0.0.0" */
env.addFilter("network_addr", (cidr: string) => {
  const { network } = cidrToOspfNetwork(cidr);
  return network;
});

/** strip_prefix: "E0/0" → "Ethernet0/0"  (IOL shorthand expansion) */
env.addFilter("expand_iface", (name: string) => {
  if (!name) return name;
  return name
    .replace(/^Lo(\d)/, "Loopback$1")
    .replace(/^S(\d)/, "Serial$1")
    .replace(/^E(\d)/, "Ethernet$1")
    .replace(/^Gi(\d)/, "GigabitEthernet$1")
    .replace(/^Fa(\d)/, "FastEthernet$1")
    .replace(/^Po(\d)/, "Port-channel$1");
});

// ------------------------------------------------------------------
// Context builder – assembles the full template context
// ------------------------------------------------------------------

export function buildContext(device: NormalizedDevice) {
  // Endpoints connected to THIS device (via "<hostname>:<iface>")
  const endpointsHere = Object.entries(device.endpoints ?? {})
    .filter(([, ep]) => typeof ep.connected_to === "string" && ep.connected_to.split(":")[0] === device.hostname)
    .map(([name, ep]) => ({ name, ...ep }));

  // Pre-render the endpoints comment block as a raw string because
  // Nunjucks' trimBlocks eats newlines after loop control tags and
  // collapses multi-line comment blocks.
  const endpointsComment = endpointsHere.length === 0
    ? ""
    : [
        "! --- Connected endpoints ---",
        ...endpointsHere.map((ep) => {
          const parts: string[] = [`!   ${ep.name}`];
          if (ep.vlan) parts.push(`vlan=${ep.vlan}`);
          if (ep.ip_assignment) parts.push(`addr=${ep.ip_assignment}`);
          if (ep.ip) parts.push(`ip=${ep.ip}`);
          if (ep.connected_to) parts.push(`port=${String(ep.connected_to).replace(`${device.hostname}:`, "")}`);
          return parts.join("  ");
        }),
        "! ---------------------------",
      ].join("\n");

  // Dedupe OSPF networks (same network+area may appear via interface tag
  // AND via global areas[].networks) to avoid duplicate `network` lines.
  const seen = new Set<string>();
  const ospfNetworks = ospfNetworksForDevice(device).filter((n) => {
    const key = `${n.network}|${n.wildcard}|${n.area}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    hostname: device.hostname,
    role: device.role,
    platform: device.platform,
    interfaces: device.config.interfaces ?? [],
    port_channels: device.config.port_channels ?? [],
    svis: device.config.svis ?? [],
    routing: device.config.routing ?? [],
    dhcp: device.config.dhcp ?? null,
    ntp: device.config.ntp ?? null,
    ssh: device.config.ssh ?? null,
    spanning_tree: device.config.spanning_tree ?? null,
    vtp: device.config.vtp ?? null,
    enable_secret: device.config.enable_secret ?? null,
    banner: device.config.banner ?? null,
    services: device.config.services ?? [],
    vlans: deviceVlans(device),
    global_vlans: device.globalVlans ?? [],
    global_routing: device.globalRouting ?? null,
    endpoints: endpointsHere,
    endpoints_comment: endpointsComment,
    // Computed helpers
    ospf_networks: ospfNetworks,
  };
}

// ------------------------------------------------------------------
// Main render function
// ------------------------------------------------------------------

export type RenderResult = {
  device: string;
  role: string;
  config: string;
  error?: string;
};

export function renderDevice(device: NormalizedDevice): RenderResult {
  const template = TEMPLATES[device.role] ?? TEMPLATES["router"];
  const ctx = buildContext(device);
  try {
    const config = env.renderString(template, ctx);
    return { device: device.hostname, role: device.role, config: config.trim() };
  } catch (err) {
    return {
      device: device.hostname,
      role: device.role,
      config: "",
      error: String(err),
    };
  }
}
