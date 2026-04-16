// ============================================================
// Network Automation - Type Definitions
// Extensible schema for multi-protocol Cisco lab topologies
// ============================================================

export type VariableMap = Record<string, string>;

// ----- VLAN -----
export interface VlanDef {
  vlan_id: string;           // may be a variable ref like "W"
  name: string;
  subnet?: string;           // e.g. "172.30.W.0/24"
  /** Optional default gateway for the subnet (used by DHCP pool defaults) */
  gateway?: string;
}

/** Per-device SVI (VLAN L3 interface) */
export interface SviDef {
  vlan_id: string;
  ip?: string;               // e.g. "172.30.19.1/24"
  description?: string;
  helper_addresses?: string[];
  hsrp?: HsrpConfig;
  shutdown?: boolean;
  ospf_area?: string | number;
}

// ----- ROUTING -----

export type OspfArea = {
  area_id: string | number;
  networks: string[];
  auth?: "none" | "simple" | "md5";
  auth_key?: string;
};

export interface OspfConfig {
  process_id?: number;        // defaults to 1
  router_id?: string;
  areas: OspfArea[];
  passive_interfaces?: string[];
  default_route_originate?: boolean;
  redistribute?: RedistributeEntry[];
}

export type EigrpConfig = {
  as_number: number;
  networks: string[];         // wildcard notation handled in template
  passive_interfaces?: string[];
  no_auto_summary?: boolean;
  redistribute?: RedistributeEntry[];
};

export type BgpNeighbor = {
  ip: string;
  remote_as: number;
  description?: string;
  update_source?: string;
  next_hop_self?: boolean;
};

export interface BgpConfig {
  as_number: number;
  router_id?: string;
  neighbors: BgpNeighbor[];
  networks?: string[];        // e.g. ["10.0.0.0 mask 255.255.255.0"]
  redistribute?: RedistributeEntry[];
}

export type RedistributeEntry = {
  protocol: "ospf" | "eigrp" | "bgp" | "static" | "connected" | "rip";
  metric?: number;
  subnets?: boolean;
  route_map?: string;
};

export type RoutingProtocol =
  | { protocol: "ospf";  ospf: OspfConfig }
  | { protocol: "eigrp"; eigrp: EigrpConfig }
  | { protocol: "bgp";   bgp: BgpConfig }
  | { protocol: "static"; routes: StaticRoute[] };

export type StaticRoute = {
  prefix: string;   // e.g. "0.0.0.0/0"
  next_hop: string;
  description?: string;
  ad?: number;      // administrative distance
};

// ----- INTERFACES -----

export type InterfaceType = "routed" | "access" | "trunk" | "loopback";

export interface InterfaceDef {
  name: string;
  description?: string;
  ip?: string;               // CIDR, may contain variable refs
  secondary_ips?: string[];
  type?: InterfaceType;
  vlan?: string;             // access vlan (variable ref ok)
  native_vlan?: string;
  allowed_vlans?: string[];  // for trunks; "all" or list
  ospf_area?: string | number;
  ospf_cost?: number;
  ospf_priority?: number;
  ospf_auth?: "none" | "simple" | "md5";
  ospf_auth_key?: string;
  eigrp_bandwidth?: number;
  eigrp_delay?: number;
  shutdown?: boolean;
  connected_to?: string;
  channel_group?: number;
  channel_group_mode?: "active" | "passive" | "desirable" | "auto" | "on";
  hsrp?: HsrpConfig;
  helper_addresses?: string[];
}

export interface HsrpConfig {
  group: number;
  ip: string;
  priority?: number;
  preempt?: boolean;
  version?: 1 | 2;
}

// ----- PORT CHANNELS -----

export interface PortChannelDef {
  name: string;               // e.g. "Po1"
  protocol?: "LACP" | "PAgP" | "static";
  members: string[];          // interface names
  type?: "trunk" | "access";
  native_vlan?: string;
  allowed_vlans?: string[];
  connected_to?: string;
}

// ----- SERVICES -----

export interface DhcpPoolDef {
  pool_name: string;
  network: string;            // e.g. "172.30.W.0/24" or "172.30.W.0 255.255.255.0"
  default_router?: string;
  dns_server?: string;
  lease_days?: number;
  excluded_addresses?: string[];  // ranges excluded from pool
}

export interface DhcpConfig {
  pools: DhcpPoolDef[];
}

export interface NtpConfig {
  server?: string;
  master?: boolean;
  master_stratum?: number;
}

export interface SshConfig {
  domain_name: string;
  version?: 1 | 2;
  key_bits?: number;          // 1024 | 2048 | 4096
  local_users?: { username: string; privilege?: number; secret: string }[];
}

export interface SpanningTreeConfig {
  mode?: "pvst" | "rapid-pvst" | "mst";
  root_primary?: string[];    // vlan ids
  root_secondary?: string[];
  portfast_default?: boolean;
  bpduguard_default?: boolean;
}

// ----- DEVICE -----

export type DeviceRole = "router" | "l3_switch" | "l2_switch" | "firewall";

export interface DeviceConfig {
  hostname?: string;          // explicit override; defaults to device key
  role?: DeviceRole;
  platform?: string;          // e.g. "cisco_ios", "cisco_nxos"
  interfaces?: InterfaceDef[];
  port_channels?: PortChannelDef[];
  svis?: SviDef[];            // L3 switch VLAN interfaces
  routing?: RoutingProtocol[];
  services?: string[];        // legacy human-readable list
  dhcp?: DhcpConfig;
  ntp?: NtpConfig;
  ssh?: SshConfig;
  spanning_tree?: SpanningTreeConfig;
  enable_secret?: string;
  banner?: string;
  vtp?: { mode: "server" | "client" | "transparent"; domain?: string; version?: 1 | 2 | 3 };
  vlans_db?: string[];        // vlan ids this device should configure in vlan db
}

// ----- TOPOLOGY ROOT -----

export interface TopologyDef {
  topology_name: string;
  variables?: VariableMap;

  vlans?: VlanDef[];

  /** Global routing (protocol blocks that apply to all capable devices) */
  routing?: {
    protocol: string;         // kept for backwards compat
    areas?: OspfArea[];       // OSPF shorthand
  };

  devices: {
    routers?: Record<string, DeviceConfig>;
    layer3_switches?: Record<string, DeviceConfig>;
    layer2_switches?: Record<string, DeviceConfig>;
    firewalls?: Record<string, DeviceConfig>;
    endpoints?: Record<string, unknown>;
  };
}
