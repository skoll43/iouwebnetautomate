// ============================================================
// Built-in example topologies
// ============================================================

// ------------------------------------------------------------
// Declarative top-level style — mirrors the original abstract
// topology spec.  Interfaces carry ospf_area tags; the global
// `routing:` block is auto-applied to every OSPF-capable device.
// ------------------------------------------------------------
export const EXAMPLE_MULTI_AREA_OSPF = `topology_name: "Multi-Area OSPF with L2/L3 Switching"

variables:
  W: "19"
  X: "33"
  Y: "61"
  Z: "85"

vlans:
  - vlan_id: "W"
    name: "NOMBRE-ALUMNO"
    subnet: "172.30.W.0/24"
  - vlan_id: "X"
    name: "APELLIDO-ALUMNO"
    subnet: "172.30.X.0/24"
  - vlan_id: "Y"
    name: "ADMIN"
    subnet: "172.30.Y.0/24"
  - vlan_id: "Z"
    name: "NATIVA"
    subnet: "172.30.Z.0/24"

routing:
  protocol: "OSPF"
  process_id: 1
  auto_router_id: true
  areas:
    - area_id: 0
      networks:
        - "192.168.0.0/30"
    - area_id: "Y"
      networks:
        - "192.168.Y.0/30"
    - area_id: "Z"
      networks:
        - "192.168.Z.0/30"

devices:
  routers:
    R4:
      interfaces:
        - name: "Loopback0"
          ip: "8.8.8.8/32"
        - name: "S1/0"
          ip: "222.0.0.2/30"
          connected_to: "R1:S1/0"

    R1:
      interfaces:
        - name: "S1/0"
          ip: "222.0.0.1/30"
          connected_to: "R4:S1/0"
        - name: "E0/0"
          ip: "192.168.Z.1/30"
          connected_to: "R2:E0/0"
          ospf_area: "Z"

    R2:
      interfaces:
        - name: "E0/0"
          ip: "192.168.Z.2/30"
          connected_to: "R1:E0/0"
          ospf_area: "Z"
        - name: "E0/1"
          ip: "192.168.0.1/30"
          connected_to: "R3:E0/1"
          ospf_area: 0

    R3:
      services:
        - "DHCP Server"
      interfaces:
        - name: "E0/1"
          ip: "192.168.0.2/30"
          connected_to: "R2:E0/1"
          ospf_area: 0
        - name: "E0/0"
          ip: "192.168.Y.2/30"
          connected_to: "DLS1:E0/0"
          ospf_area: "Y"
      dhcp:
        pools:
          - pool_name: "POOL-VLAN-W"
            network: "172.30.W.0/24"
            default_router: "172.30.W.1"
            dns_server: "8.8.8.8"
          - pool_name: "POOL-VLAN-X"
            network: "172.30.X.0/24"
            default_router: "172.30.X.1"
            dns_server: "8.8.8.8"

  layer3_switches:
    DLS1:
      interfaces:
        - name: "E0/0"
          ip: "192.168.Y.1/30"
          connected_to: "R3:E0/0"
          ospf_area: "Y"
        - name: "E1/0"
          type: "trunk"
          connected_to: "ALS1:E1/0"
          native_vlan: "Z"
          allowed_vlans: ["W", "X", "Y", "Z"]
      port_channels:
        - name: "Po1"
          protocol: "PAgP"
          members: ["E0/1", "E0/2", "E0/3"]
          connected_to: "DLS2:Po1"
          type: "trunk"
          native_vlan: "Z"
          allowed_vlans: ["W", "X", "Y", "Z"]

    DLS2:
      interfaces:
        - name: "E1/1"
          type: "trunk"
          connected_to: "ALS1:E1/1"
          native_vlan: "Z"
          allowed_vlans: ["W", "X", "Y", "Z"]
      port_channels:
        - name: "Po1"
          protocol: "PAgP"
          members: ["E0/1", "E0/2", "E0/3"]
          connected_to: "DLS1:Po1"
          type: "trunk"
          native_vlan: "Z"
          allowed_vlans: ["W", "X", "Y", "Z"]

  layer2_switches:
    ALS1:
      interfaces:
        - name: "E1/0"
          type: "trunk"
          connected_to: "DLS1:E1/0"
          native_vlan: "Z"
          allowed_vlans: ["W", "X", "Y", "Z"]
        - name: "E1/1"
          type: "trunk"
          connected_to: "DLS2:E1/1"
          native_vlan: "Z"
          allowed_vlans: ["W", "X", "Y", "Z"]
        - name: "E0/2"
          type: "access"
          vlan: "W"
          connected_to: "PC-VLAN-W"
        - name: "E0/3"
          type: "access"
          vlan: "X"
          connected_to: "PC-VLAN-X"

  endpoints:
    PC-VLAN-W:
      vlan: "W"
      ip_assignment: "DHCP"
      connected_to: "ALS1:E0/2"
    PC-VLAN-X:
      vlan: "X"
      ip_assignment: "DHCP"
      connected_to: "ALS1:E0/3"
`;

export const EXAMPLE_EIGRP_BGP = `topology_name: "EIGRP Core + iBGP Route Reflector"

variables:
  AS: "65001"

devices:
  routers:
    RR1:
      interfaces:
        - name: "Loopback0"
          ip: "10.0.0.1/32"
          description: "Router-ID loopback"
        - name: "E0/0"
          ip: "10.1.0.1/30"
          description: "To R2"
        - name: "E0/1"
          ip: "10.1.0.5/30"
          description: "To R3"
      routing:
        - protocol: "eigrp"
          eigrp:
            as_number: 100
            networks:
              - "10.0.0.1/32"
              - "10.1.0.0/30"
              - "10.1.0.4/30"
            no_auto_summary: true
        - protocol: "bgp"
          bgp:
            as_number: 65001
            router_id: "10.0.0.1"
            neighbors:
              - ip: "10.0.0.2"
                remote_as: 65001
                update_source: "Loopback0"
                next_hop_self: true
              - ip: "10.0.0.3"
                remote_as: 65001
                update_source: "Loopback0"
                next_hop_self: true
            redistribute:
              - protocol: "eigrp"
                metric: 100

    R2:
      interfaces:
        - name: "Loopback0"
          ip: "10.0.0.2/32"
        - name: "E0/0"
          ip: "10.1.0.2/30"
          description: "To RR1"
      routing:
        - protocol: "eigrp"
          eigrp:
            as_number: 100
            networks:
              - "10.0.0.2/32"
              - "10.1.0.0/30"
            no_auto_summary: true
        - protocol: "bgp"
          bgp:
            as_number: 65001
            router_id: "10.0.0.2"
            neighbors:
              - ip: "10.0.0.1"
                remote_as: 65001
                update_source: "Loopback0"

    R3:
      interfaces:
        - name: "Loopback0"
          ip: "10.0.0.3/32"
        - name: "E0/1"
          ip: "10.1.0.6/30"
          description: "To RR1"
      routing:
        - protocol: "eigrp"
          eigrp:
            as_number: 100
            networks:
              - "10.0.0.3/32"
              - "10.1.0.4/30"
            no_auto_summary: true
        - protocol: "bgp"
          bgp:
            as_number: 65001
            router_id: "10.0.0.3"
            neighbors:
              - ip: "10.0.0.1"
                remote_as: 65001
                update_source: "Loopback0"
`;

// ============================================================
// MST (Multiple Spanning Tree) example
// Two MST instances:
//   - MST 1  → data VLANs (W, X)  → DLS1 root
//   - MST 2  → mgmt VLANs (Y, Z)  → DLS2 root
// ============================================================
export const EXAMPLE_MST = `topology_name: "MST (Multiple Spanning Tree) Campus Core"

variables:
  W: "19"
  X: "33"
  Y: "61"
  Z: "85"

vlans:
  - vlan_id: "W"
    name: "DATA-A"
    subnet: "172.30.W.0/24"
  - vlan_id: "X"
    name: "DATA-B"
    subnet: "172.30.X.0/24"
  - vlan_id: "Y"
    name: "ADMIN"
    subnet: "172.30.Y.0/24"
  - vlan_id: "Z"
    name: "NATIVA"
    subnet: "172.30.Z.0/24"

devices:
  layer3_switches:
    DLS1:
      vtp:
        mode: "server"
        domain: "LABORATORIO"
        version: 2
      spanning_tree:
        mode: "mst"
        extend_system_id: true
        mst:
          region_name: "CAMPUS"
          revision: 1
          max_hops: 20
          instances:
            # IST (instance 0) is implicit and carries all unmapped VLANs.
            # MST 1: data VLANs — DLS1 is root
            - instance_id: 1
              vlans: ["W", "X"]
              root: "primary"
            # MST 2: mgmt VLANs — DLS1 is backup root
            - instance_id: 2
              vlans: ["Y", "Z"]
              root: "secondary"
      port_channels:
        - name: "Po1"
          protocol: "LACP"
          member_mode: "active"
          members: ["E0/1", "E0/2"]
          type: "trunk"
          native_vlan: "Z"
          allowed_vlans: ["W", "X", "Y", "Z"]
      svis:
        - vlan_id: "W"
          ip: "172.30.W.2/24"
          hsrp: { group: 19, ip: "172.30.W.254", priority: 110, preempt: true }
        - vlan_id: "X"
          ip: "172.30.X.2/24"
          hsrp: { group: 33, ip: "172.30.X.254", priority: 110, preempt: true }
        - vlan_id: "Y"
          ip: "172.30.Y.2/24"
          hsrp: { group: 61, ip: "172.30.Y.254", priority: 100, preempt: true }

    DLS2:
      vtp:
        mode: "server"
        domain: "LABORATORIO"
        version: 2
      spanning_tree:
        mode: "mst"
        extend_system_id: true
        mst:
          region_name: "CAMPUS"
          revision: 1
          max_hops: 20
          instances:
            # Symmetric mapping — MUST match DLS1 exactly for MST to converge
            - instance_id: 1
              vlans: ["W", "X"]
              root: "secondary"
            - instance_id: 2
              vlans: ["Y", "Z"]
              root: "primary"
      port_channels:
        - name: "Po1"
          protocol: "LACP"
          member_mode: "active"
          members: ["E0/1", "E0/2"]
          type: "trunk"
          native_vlan: "Z"
          allowed_vlans: ["W", "X", "Y", "Z"]
      svis:
        - vlan_id: "W"
          ip: "172.30.W.3/24"
          hsrp: { group: 19, ip: "172.30.W.254", priority: 100, preempt: true }
        - vlan_id: "X"
          ip: "172.30.X.3/24"
          hsrp: { group: 33, ip: "172.30.X.254", priority: 100, preempt: true }
        - vlan_id: "Y"
          ip: "172.30.Y.3/24"
          hsrp: { group: 61, ip: "172.30.Y.254", priority: 110, preempt: true }

  layer2_switches:
    ALS1:
      vtp:
        mode: "client"
        domain: "LABORATORIO"
        version: 2
      spanning_tree:
        mode: "mst"
        extend_system_id: true
        # Access switch MUST share the same region config to join the region.
        mst:
          region_name: "CAMPUS"
          revision: 1
          instances:
            - instance_id: 1
              vlans: ["W", "X"]
            - instance_id: 2
              vlans: ["Y", "Z"]
      interfaces:
        - name: "E1/0"
          type: "trunk"
          description: "Trunk to DLS1"
          native_vlan: "Z"
          allowed_vlans: ["W", "X", "Y", "Z"]
        - name: "E1/1"
          type: "trunk"
          description: "Trunk to DLS2"
          native_vlan: "Z"
          allowed_vlans: ["W", "X", "Y", "Z"]
        - name: "E0/2"
          type: "access"
          vlan: "W"
          description: "Host VLAN W"
        - name: "E0/3"
          type: "access"
          vlan: "X"
          description: "Host VLAN X"
`;

