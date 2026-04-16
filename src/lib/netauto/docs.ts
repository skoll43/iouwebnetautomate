// ============================================================
// Reference documentation for the YAML topology schema
// Consumed by the in-app Explainer component
// ============================================================

export interface DocField {
  name: string;
  type: string;
  required?: boolean;
  description: string;
  /** Example value rendered inside code blocks */
  example?: string;
  /** Allowed literal values (for enums) */
  values?: string[];
  default?: string;
}

export interface DocSection {
  id: string;
  title: string;
  category:
    | "structure"
    | "routing"
    | "switching"
    | "services"
    | "security"
    | "firstHop";
  color: string;        // accent color for the header chip
  summary: string;      // one-liner
  longDescription?: string;
  fields: DocField[];
  yamlExample: string;
  iosOutput?: string;
}

export const DOC_SECTIONS: DocSection[] = [
  // ============================================================
  // STRUCTURE
  // ============================================================
  {
    id: "topology",
    title: "Topology root",
    category: "structure",
    color: "#58a6ff",
    summary: "Top-level fields every YAML file must provide.",
    longDescription:
      "The topology root contains the declarative variable map, VLAN list, global routing protocol, and device groupings. Everything below resolves variables top-down before template rendering.",
    fields: [
      { name: "topology_name", type: "string", required: true, description: "Human label for the lab; shown in generated header comments." },
      { name: "variables", type: "map<string,string>", description: "Abstract placeholders (e.g. W, X, Y, Z) replaced everywhere as whole-word tokens before rendering. Typical per-student IDs." },
      { name: "vlans", type: "VlanDef[]", description: "Global VLAN registry. L3 switches configure every entry, L2 switches only the ones referenced on access ports." },
      { name: "routing", type: "GlobalRouting", description: "Declarative top-level routing; automatically synthesized into per-device blocks." },
      { name: "devices.routers", type: "map<hostname,DeviceConfig>", description: "Routers (run OSPF/EIGRP/BGP/static)." },
      { name: "devices.layer3_switches", type: "map<hostname,DeviceConfig>", description: "L3 switches (VTP server, SVIs, routing, port-channels)." },
      { name: "devices.layer2_switches", type: "map<hostname,DeviceConfig>", description: "Access switches (VTP client/transparent, access + trunk ports)." },
      { name: "devices.firewalls", type: "map<hostname,DeviceConfig>", description: "Firewall devices (stub template)." },
      { name: "devices.endpoints", type: "map<name,EndpointDef>", description: "Non-configurable hosts/PCs. Rendered as documentation comment block on connected switch." },
    ],
    yamlExample: `topology_name: "Campus Lab"
variables:
  W: "19"
  X: "33"
vlans:
  - vlan_id: "W"
    name: "DATA"
    subnet: "172.30.W.0/24"
routing:
  protocol: "OSPF"
  process_id: 1
  auto_router_id: true
devices:
  routers: { R1: {...} }
  layer3_switches: { DLS1: {...} }
  layer2_switches: { ALS1: {...} }`,
  },

  {
    id: "variables",
    title: "Variable interpolation",
    category: "structure",
    color: "#3fb950",
    summary: "Abstract placeholders resolved to concrete values before render.",
    longDescription:
      "Every string leaf in the YAML is walked and each variable key (matched as a whole-word token) is replaced. You can use variables inside IPs, VLAN ids, subnet masks, descriptions, even connected_to strings.",
    fields: [
      { name: "<key>", type: "string", description: "Any identifier. Typical convention: single uppercase letter per student identifier digit.", example: '"19"' },
    ],
    yamlExample: `variables:
  W: "19"
  X: "33"
  Y: "61"
  Z: "85"

# Later references:
ip: "172.30.W.1/24"       # -> 172.30.19.1/24
ospf_area: "Y"            # -> 61
allowed_vlans: ["W", "X"] # -> ["19", "33"]`,
  },

  // ============================================================
  // ROUTING
  // ============================================================
  {
    id: "global-routing",
    title: "Global routing block",
    category: "routing",
    color: "#58a6ff",
    summary: "Declarative top-level routing — auto-applied to every OSPF-capable device.",
    longDescription:
      "Declare the routing protocol once at the top level. Every router and L3 switch that has at least one interface or SVI tagged with ospf_area (for OSPF) or falls inside the declared networks (for EIGRP) gets a synthesized routing block injected automatically.",
    fields: [
      { name: "protocol", type: "string", required: true, values: ["OSPF", "EIGRP", "BGP"], description: "Global protocol. Case-insensitive." },
      { name: "process_id", type: "number", default: "1", description: "OSPF process id." },
      { name: "auto_router_id", type: "boolean", default: "false", description: "If true, derives a role-scoped unique router-id from the hostname (R1→1.1.1.1, DLS1→10.1.1.1, FW1→172.16.1.1)." },
      { name: "areas", type: "OspfArea[]", description: "OSPF areas to declare. Each area's networks list contributes `network X wildcard Y area N` lines on devices participating in that area." },
      { name: "as_number", type: "number", description: "EIGRP AS (when protocol=EIGRP)." },
      { name: "networks", type: "string[]", description: "EIGRP networks in CIDR (auto-converted to wildcard)." },
    ],
    yamlExample: `routing:
  protocol: "OSPF"
  process_id: 1
  auto_router_id: true
  areas:
    - area_id: 0
      networks: ["192.168.0.0/30"]
    - area_id: "Y"
      networks: ["192.168.Y.0/30"]`,
    iosOutput: `router ospf 1
 router-id 1.1.1.1
 network 192.168.85.0 0.0.0.3 area 85
 network 192.168.0.0 0.0.0.3 area 0`,
  },

  {
    id: "ospf",
    title: "OSPF (per-device)",
    category: "routing",
    color: "#58a6ff",
    summary: "Per-device OSPF block — overrides the global declarative hierarchy.",
    longDescription:
      "Declared inside a device's routing: [] array. The engine automatically adds network statements for every interface/SVI tagged with ospf_area.",
    fields: [
      { name: "process_id", type: "number", default: "1", description: "OSPF process id." },
      { name: "router_id", type: "string (IP)", description: "Explicit router-id override." },
      { name: "areas", type: "OspfArea[]", description: "Explicit area definitions (area_id + networks[])." },
      { name: "passive_interfaces", type: "string[]", description: "Interfaces where OSPF hellos are suppressed (e.g. SVIs facing hosts)." },
      { name: "default_route_originate", type: "boolean", description: "Adds `default-information originate always`." },
      { name: "redistribute", type: "RedistributeEntry[]", description: "Redistribute from other protocols with optional metric / subnets / route-map." },
    ],
    yamlExample: `routing:
  - protocol: "ospf"
    ospf:
      process_id: 1
      router_id: "1.1.1.1"
      areas: []
      default_route_originate: true
      passive_interfaces: ["Vlan19", "Vlan33"]
      redistribute:
        - protocol: "eigrp"
          subnets: true
          metric: 100`,
  },

  {
    id: "eigrp",
    title: "EIGRP",
    category: "routing",
    color: "#3fb950",
    summary: "EIGRP AS with wildcard-derived networks.",
    longDescription:
      "CIDR networks are automatically converted to wildcard-mask form. `no_auto_summary` is a recommended default for modern networks.",
    fields: [
      { name: "as_number", type: "number", required: true, description: "EIGRP autonomous system number." },
      { name: "networks", type: "string[]", description: "CIDR networks to advertise; each generates a `network A.A.A.A wildcard W.W.W.W` line." },
      { name: "passive_interfaces", type: "string[]", description: "Suppress EIGRP hellos on these interfaces." },
      { name: "no_auto_summary", type: "boolean", description: "Disable classful auto-summarization." },
      { name: "redistribute", type: "RedistributeEntry[]", description: "Pull routes from ospf/bgp/static/connected with optional metric." },
    ],
    yamlExample: `routing:
  - protocol: "eigrp"
    eigrp:
      as_number: 100
      networks:
        - "10.0.0.0/8"
        - "192.168.1.0/24"
      no_auto_summary: true
      redistribute:
        - protocol: "static"
          metric: 10000 100 255 1 1500`,
  },

  {
    id: "bgp",
    title: "BGP",
    category: "routing",
    color: "#bc8cff",
    summary: "iBGP / eBGP with neighbors, networks, and redistribution.",
    fields: [
      { name: "as_number", type: "number", required: true, description: "Local AS number." },
      { name: "router_id", type: "string (IP)", description: "Explicit BGP router-id." },
      { name: "neighbors", type: "BgpNeighbor[]", description: "Peer list with remote_as, optional description, update_source, next_hop_self." },
      { name: "networks", type: "string[]", description: "Explicit `network X.X.X.X mask A.A.A.A` advertisements." },
      { name: "redistribute", type: "RedistributeEntry[]", description: "Inject routes from another protocol." },
    ],
    yamlExample: `routing:
  - protocol: "bgp"
    bgp:
      as_number: 65001
      router_id: "10.0.0.1"
      neighbors:
        - ip: "10.0.0.2"
          remote_as: 65001
          update_source: "Loopback0"
          next_hop_self: true
      redistribute:
        - protocol: "eigrp"
          metric: 100`,
  },

  {
    id: "static",
    title: "Static routes",
    category: "routing",
    color: "#d29922",
    summary: "Default routes, backup paths, recursive lookups.",
    fields: [
      { name: "prefix", type: "string (CIDR)", required: true, description: "Destination network, e.g. '0.0.0.0/0' for default." },
      { name: "next_hop", type: "string (IP)", required: true, description: "Next-hop IP address or exit interface." },
      { name: "ad", type: "number", description: "Administrative distance (1-255). Useful for floating static as backup." },
      { name: "description", type: "string", description: "Attached to `name` field on IOS 15.x+." },
    ],
    yamlExample: `routing:
  - protocol: "static"
    routes:
      - prefix: "0.0.0.0/0"
        next_hop: "222.0.0.2"
        description: "default-to-ISP"
      - prefix: "10.0.0.0/8"
        next_hop: "10.1.0.254"
        ad: 200
        description: "backup-to-core"`,
  },

  // ============================================================
  // SWITCHING
  // ============================================================
  {
    id: "vlans",
    title: "VLANs",
    category: "switching",
    color: "#7ee787",
    summary: "Global VLAN registry.",
    longDescription: "Declared once at the topology root and referenced by vlan id elsewhere. Variables (W, X, Y, Z) are valid inside vlan_id — resolved before VLAN DB rendering.",
    fields: [
      { name: "vlan_id", type: "string", required: true, description: "VLAN ID 1-4094. May reference a variable (e.g. 'W')." },
      { name: "name", type: "string", required: true, description: "VLAN name (spaces replaced with underscores on IOS)." },
      { name: "subnet", type: "string (CIDR)", description: "Informational — not rendered but used for downstream SVI/DHCP generation." },
      { name: "gateway", type: "string (IP)", description: "Optional default-gateway for the subnet (feeds DHCP pools)." },
    ],
    yamlExample: `vlans:
  - vlan_id: "W"
    name: "NOMBRE-ALUMNO"
    subnet: "172.30.W.0/24"
    gateway: "172.30.W.254"
  - vlan_id: "85"
    name: "NATIVA"
    subnet: "172.30.85.0/24"`,
    iosOutput: `vlan 19
 name NOMBRE-ALUMNO
vlan 85
 name NATIVA`,
  },

  {
    id: "interfaces",
    title: "Interfaces",
    category: "switching",
    color: "#d2a8ff",
    summary: "Routed, loopback, access, and trunk interface types.",
    longDescription:
      "The `type` field selects the rendering path. Without type, the engine infers: L3 routed on routers, or falls through to switchport mode on switches based on other fields.",
    fields: [
      { name: "name", type: "string", required: true, description: "Interface short name (E0/0, S1/0, Lo0, Po1). Auto-expanded to Ethernet0/0, Serial1/0, etc." },
      { name: "description", type: "string", description: "Auto-filled from connected_to when omitted (e.g. 'To R1:E0/0')." },
      { name: "ip", type: "string (CIDR)", description: "IPv4 address with prefix length. Converted to `ip address A.A.A.A M.M.M.M`." },
      { name: "type", type: "enum", values: ["loopback", "trunk", "access", "routed"], description: "Rendering mode selector." },
      { name: "vlan", type: "string", description: "For type=access: the access VLAN id." },
      { name: "native_vlan", type: "string", description: "For type=trunk: native VLAN (defaults to 1 if omitted)." },
      { name: "allowed_vlans", type: "string[]", description: "For type=trunk: allowed VLAN list (comma-joined)." },
      { name: "ospf_area", type: "string|number", description: "Triggers OSPF auto-synthesis. Interface joins this area via ip ospf <pid> area <id>." },
      { name: "ospf_cost", type: "number", description: "Per-interface OSPF cost." },
      { name: "ospf_priority", type: "number", description: "DR election priority (0 = never DR)." },
      { name: "hsrp", type: "HsrpConfig", description: "First-hop redundancy (see HSRP section)." },
      { name: "helper_addresses", type: "string[]", description: "DHCP relay targets." },
      { name: "connected_to", type: "string", description: "Peer `HOST:IFACE`. Auto-fills description and is used by endpoint resolver." },
      { name: "channel_group", type: "number", description: "Bundle into port-channel N (physical interface only)." },
      { name: "channel_group_mode", type: "enum", values: ["active", "passive", "desirable", "auto", "on"], description: "LACP (active/passive) or PAgP (desirable/auto) or static (on)." },
      { name: "shutdown", type: "boolean", description: "Admin-down the interface." },
    ],
    yamlExample: `interfaces:
  - name: "Loopback0"
    ip: "1.1.1.1/32"
  - name: "E0/0"
    ip: "192.168.85.1/30"
    connected_to: "R2:E0/0"
    ospf_area: "Z"
    ospf_cost: 10
  - name: "E1/0"
    type: "trunk"
    native_vlan: "Z"
    allowed_vlans: ["W", "X", "Y", "Z"]
  - name: "E0/3"
    type: "access"
    vlan: "W"`,
  },

  {
    id: "port-channels",
    title: "Port-channels (EtherChannel)",
    category: "switching",
    color: "#a5f3fc",
    summary: "LACP, PAgP, and static bundles. Emits logical Po interface + member ports.",
    longDescription:
      "Specify the logical Po and its members once. The engine generates the logical interface AND applies `switchport` + `channel-group <n> mode <mode>` on every member automatically.",
    fields: [
      { name: "name", type: "string", required: true, description: "Port-channel interface (Po1, Po2, …)." },
      { name: "protocol", type: "enum", values: ["PAgP", "LACP", "static"], default: "PAgP", description: "Selects mode derivation: LACP→active, PAgP→desirable, static→on." },
      { name: "member_mode", type: "string", description: "Override auto-derived mode (e.g. force 'auto' for asymmetric PAgP)." },
      { name: "members", type: "string[]", required: true, description: "Physical member interface names." },
      { name: "type", type: "enum", values: ["trunk", "access"], description: "L2 mode of the bundle." },
      { name: "native_vlan", type: "string", description: "Trunk native VLAN." },
      { name: "allowed_vlans", type: "string[]", description: "Allowed VLAN list." },
      { name: "connected_to", type: "string", description: "Peer Po reference ('DLS2:Po1') — informational." },
    ],
    yamlExample: `port_channels:
  - name: "Po1"
    protocol: "LACP"
    members: ["E0/1", "E0/2", "E0/3"]
    type: "trunk"
    native_vlan: "Z"
    allowed_vlans: ["W", "X", "Y", "Z"]
    connected_to: "DLS2:Po1"`,
    iosOutput: `interface Port-channel1
 switchport trunk encapsulation dot1q
 switchport mode trunk
 switchport nonegotiate
 switchport trunk native vlan 85
!
interface Ethernet0/1
 switchport
 channel-group 1 mode active
 no shutdown`,
  },

  {
    id: "svis",
    title: "SVIs (VLAN interfaces)",
    category: "switching",
    color: "#d2a8ff",
    summary: "L3 VLAN interfaces on distribution switches.",
    longDescription:
      "Only rendered on l3_switches. Combine with HSRP for first-hop redundancy and ospf_area to advertise the user subnet into OSPF.",
    fields: [
      { name: "vlan_id", type: "string", required: true, description: "VLAN id this SVI represents." },
      { name: "ip", type: "string (CIDR)", description: "L3 address for the SVI." },
      { name: "description", type: "string", description: "Interface description." },
      { name: "helper_addresses", type: "string[]", description: "DHCP relay targets (for DHCP server on another L3 device)." },
      { name: "hsrp", type: "HsrpConfig", description: "Hot Standby group definition." },
      { name: "ospf_area", type: "string|number", description: "Advertise this SVI's subnet into OSPF area N." },
      { name: "shutdown", type: "boolean", description: "Keep SVI admin-down." },
    ],
    yamlExample: `svis:
  - vlan_id: "W"
    ip: "172.30.W.2/24"
    description: "SVI for DATA VLAN"
    helper_addresses: ["192.168.Y.2"]
    ospf_area: "Y"
    hsrp:
      group: 19
      ip: "172.30.W.254"
      priority: 110
      preempt: true`,
  },

  {
    id: "stp-pvst",
    title: "Spanning Tree — PVST / Rapid-PVST",
    category: "switching",
    color: "#39c5cf",
    summary: "Per-VLAN root roles and explicit priorities.",
    fields: [
      { name: "mode", type: "enum", values: ["pvst", "rapid-pvst", "mst"], default: "rapid-pvst", description: "STP flavor." },
      { name: "root_primary", type: "string[]", description: "VLAN ids where THIS switch is root (priority 24576)." },
      { name: "root_secondary", type: "string[]", description: "VLAN ids where this switch is backup root (priority 28672)." },
      { name: "vlan_priorities", type: "{vlan, priority}[]", description: "Explicit per-VLAN priority overrides (must be multiples of 4096)." },
      { name: "portfast_default", type: "boolean", description: "Global portfast for access ports." },
      { name: "bpduguard_default", type: "boolean", description: "Global bpduguard — shuts ports receiving unexpected BPDUs." },
      { name: "extend_system_id", type: "boolean", default: "true", description: "802.1t extended system ID (recommended always true)." },
    ],
    yamlExample: `spanning_tree:
  mode: "rapid-pvst"
  root_primary: ["W", "X"]
  root_secondary: ["Y", "Z"]
  portfast_default: true
  bpduguard_default: true`,
  },

  {
    id: "stp-mst",
    title: "Spanning Tree — MST",
    category: "switching",
    color: "#79c0ff",
    summary: "Multiple Spanning Tree: region config, instances, per-instance roots.",
    longDescription:
      "MST groups VLANs into instances to reduce STP overhead. ALL switches in a region MUST declare identical region_name, revision, and instance-to-VLAN mappings. Instance 0 (IST) is implicit.",
    fields: [
      { name: "mode", type: "literal", values: ["mst"], required: true, description: "Must be exactly 'mst'." },
      { name: "mst.region_name", type: "string", required: true, description: "Region identifier. Must match on every switch in the region." },
      { name: "mst.revision", type: "number", required: true, description: "Revision counter. Must match on every switch in the region." },
      { name: "mst.instances", type: "MstInstance[]", required: true, description: "Instance-to-VLAN mappings and per-instance role/priority." },
      { name: "mst.instances[].instance_id", type: "number", required: true, description: "1-4094. Instance 0 (IST) is implicit." },
      { name: "mst.instances[].vlans", type: "string[]", required: true, description: "VLANs mapped to this instance." },
      { name: "mst.instances[].root", type: "enum", values: ["primary", "secondary"], description: "Optional per-instance root role." },
      { name: "mst.instances[].priority", type: "number", description: "Explicit priority override (multiple of 4096)." },
      { name: "mst.max_hops", type: "number", default: "20", description: "MST diameter." },
    ],
    yamlExample: `spanning_tree:
  mode: "mst"
  mst:
    region_name: "CAMPUS"
    revision: 1
    max_hops: 20
    instances:
      - instance_id: 1
        vlans: ["W", "X"]     # data VLANs
        root: "primary"
      - instance_id: 2
        vlans: ["Y", "Z"]     # mgmt VLANs
        root: "secondary"`,
    iosOutput: `spanning-tree mode mst
spanning-tree extend system-id
!
spanning-tree mst configuration
 name CAMPUS
 revision 1
 instance 1 vlan 19,33
 instance 2 vlan 61,85
exit
spanning-tree mst max-hops 20
spanning-tree mst 1 root primary
spanning-tree mst 2 root secondary`,
  },

  {
    id: "vtp",
    title: "VTP",
    category: "switching",
    color: "#7ee787",
    summary: "VLAN Trunking Protocol mode and domain.",
    fields: [
      { name: "mode", type: "enum", required: true, values: ["server", "client", "transparent"], description: "VTP role." },
      { name: "domain", type: "string", description: "VTP domain name (must match across all switches in the domain)." },
      { name: "version", type: "number", values: ["1", "2", "3"], default: "1", description: "VTP version." },
    ],
    yamlExample: `vtp:
  mode: "server"
  domain: "LABORATORIO"
  version: 2`,
  },

  // ============================================================
  // FIRST-HOP REDUNDANCY
  // ============================================================
  {
    id: "hsrp",
    title: "HSRP",
    category: "firstHop",
    color: "#f85149",
    summary: "First-hop redundancy on SVIs or routed interfaces.",
    longDescription:
      "Attach an hsrp block to an SVI or interface definition. Both the active and standby switches share a virtual IP that hosts use as their default gateway.",
    fields: [
      { name: "group", type: "number", required: true, description: "HSRP group ID (0-255 for v1, 0-4095 for v2)." },
      { name: "ip", type: "string (IP)", required: true, description: "Virtual IP shared between active+standby." },
      { name: "priority", type: "number", default: "100", description: "Higher wins election (active has higher priority)." },
      { name: "preempt", type: "boolean", description: "Allow higher-priority device to take over when it comes back online." },
      { name: "version", type: "number", values: ["1", "2"], default: "2", description: "HSRPv2 supports larger group IDs + IPv6." },
    ],
    yamlExample: `# On DLS1 (active):
hsrp:
  group: 19
  ip: "172.30.19.254"
  priority: 110
  preempt: true

# On DLS2 (standby):
hsrp:
  group: 19
  ip: "172.30.19.254"
  priority: 100
  preempt: true`,
  },

  // ============================================================
  // SERVICES
  // ============================================================
  {
    id: "dhcp",
    title: "DHCP Server",
    category: "services",
    color: "#ff7b72",
    summary: "IOS DHCP server pools with excluded address ranges.",
    fields: [
      { name: "pools", type: "DhcpPoolDef[]", required: true, description: "One pool per subnet being served." },
      { name: "pools[].pool_name", type: "string", required: true, description: "Pool identifier (appears in 'ip dhcp pool <name>')." },
      { name: "pools[].network", type: "string (CIDR)", required: true, description: "Subnet to serve." },
      { name: "pools[].default_router", type: "string (IP)", description: "Gateway advertised to clients." },
      { name: "pools[].dns_server", type: "string (IP)", description: "DNS server advertised." },
      { name: "pools[].lease_days", type: "number", description: "Lease duration in days." },
      { name: "pools[].excluded_addresses", type: "string[]", description: "IPs or ranges to exclude ('172.30.19.1 172.30.19.10')." },
    ],
    yamlExample: `dhcp:
  pools:
    - pool_name: "POOL-VLAN-W"
      network: "172.30.W.0/24"
      default_router: "172.30.W.254"
      dns_server: "8.8.8.8"
      lease_days: 1
      excluded_addresses:
        - "172.30.W.1 172.30.W.10"
        - "172.30.W.254"`,
  },

  {
    id: "ntp",
    title: "NTP",
    category: "services",
    color: "#d29922",
    summary: "Time sync (server or master mode).",
    fields: [
      { name: "server", type: "string (IP or hostname)", description: "Upstream NTP source." },
      { name: "master", type: "boolean", description: "Act as NTP master (stratum source)." },
      { name: "master_stratum", type: "number", default: "3", description: "Stratum level when acting as master." },
    ],
    yamlExample: `ntp:
  master: true
  master_stratum: 3
# or
ntp:
  server: "pool.ntp.org"`,
  },

  // ============================================================
  // SECURITY
  // ============================================================
  {
    id: "ssh",
    title: "SSH / AAA",
    category: "security",
    color: "#f0883e",
    summary: "SSH-only management access with local users.",
    fields: [
      { name: "domain_name", type: "string", required: true, description: "Used as suffix for RSA key generation." },
      { name: "version", type: "number", values: ["1", "2"], default: "2", description: "SSH protocol version." },
      { name: "key_bits", type: "number", values: ["1024", "2048", "4096"], default: "2048", description: "RSA modulus size." },
      { name: "local_users", type: "{username, privilege, secret}[]", description: "Local user accounts." },
    ],
    yamlExample: `ssh:
  domain_name: "lab.local"
  version: 2
  key_bits: 2048
  local_users:
    - username: "admin"
      privilege: 15
      secret: "cisco123"`,
  },
];

// ------------------------------------------------------------------
// Category metadata (used by the UI to group and style sections)
// ------------------------------------------------------------------

export const DOC_CATEGORIES = [
  { id: "structure", label: "Structure", color: "#58a6ff" },
  { id: "routing", label: "Routing", color: "#bc8cff" },
  { id: "switching", label: "Switching", color: "#7ee787" },
  { id: "firstHop", label: "First-Hop Redundancy", color: "#f85149" },
  { id: "services", label: "Services", color: "#ff7b72" },
  { id: "security", label: "Security", color: "#f0883e" },
] as const;
