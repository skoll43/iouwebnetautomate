// ============================================================
// Built-in example topologies
// ============================================================

export const EXAMPLE_MULTI_AREA_OSPF = `topology_name: "Multi-Area OSPF with L2/L3 Switching"

# Abstract placeholders - resolved to integers before rendering.
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

devices:
  routers:
    R4:
      interfaces:
        - name: "Loopback0"
          ip: "8.8.8.8/32"
          description: "Simulated DNS/Internet"
        - name: "S1/0"
          ip: "222.0.0.2/30"
          description: "Link to R1"
      routing:
        - protocol: "static"
          routes:
            - prefix: "0.0.0.0/0"
              next_hop: "222.0.0.1"
              description: "default-to-R1"

    R1:
      interfaces:
        - name: "S1/0"
          ip: "222.0.0.1/30"
          description: "Uplink to R4 (ISP)"
        - name: "E0/0"
          ip: "192.168.Z.1/30"
          description: "To R2 (Area Z)"
          ospf_area: "Z"
      routing:
        - protocol: "ospf"
          ospf:
            process_id: 1
            router_id: "1.1.1.1"
            areas: []
            default_route_originate: true
        - protocol: "static"
          routes:
            - prefix: "0.0.0.0/0"
              next_hop: "222.0.0.2"
              description: "default-via-R4"

    R2:
      interfaces:
        - name: "E0/0"
          ip: "192.168.Z.2/30"
          description: "To R1 (Area Z)"
          ospf_area: "Z"
        - name: "E0/1"
          ip: "192.168.0.1/30"
          description: "To R3 (Area 0)"
          ospf_area: 0
      routing:
        - protocol: "ospf"
          ospf:
            process_id: 1
            router_id: "2.2.2.2"
            areas: []

    R3:
      interfaces:
        - name: "E0/1"
          ip: "192.168.0.2/30"
          description: "To R2 (Area 0)"
          ospf_area: 0
        - name: "E0/0"
          ip: "192.168.Y.2/30"
          description: "To DLS1 (Area Y)"
          ospf_area: "Y"
      routing:
        - protocol: "ospf"
          ospf:
            process_id: 1
            router_id: "3.3.3.3"
            areas: []
      dhcp:
        pools:
          - pool_name: "POOL-VLAN-W"
            network: "172.30.W.0/24"
            default_router: "172.30.W.254"
            dns_server: "8.8.8.8"
            excluded_addresses:
              - "172.30.W.1 172.30.W.10"
              - "172.30.W.254"
          - pool_name: "POOL-VLAN-X"
            network: "172.30.X.0/24"
            default_router: "172.30.X.254"
            dns_server: "8.8.8.8"
            excluded_addresses:
              - "172.30.X.1 172.30.X.10"
              - "172.30.X.254"

  layer3_switches:
    DLS1:
      vtp:
        mode: "server"
        domain: "LABORATORIO"
        version: 2
      spanning_tree:
        mode: "rapid-pvst"
        root_primary: ["W", "X"]
        root_secondary: ["Y", "Z"]
      interfaces:
        - name: "E0/0"
          ip: "192.168.Y.1/30"
          description: "To R3 (Area Y)"
          ospf_area: "Y"
      port_channels:
        - name: "Po1"
          protocol: "PAgP"
          member_mode: "desirable"
          members: ["E0/1", "E0/2", "E0/3"]
          type: "trunk"
          native_vlan: "Z"
          allowed_vlans: ["W", "X", "Y", "Z"]
      # Interfaces facing ALS1 (distribution-to-access trunks)
      # ---- add more trunks here ----
      svis:
        - vlan_id: "W"
          description: "SVI for VLAN NOMBRE-ALUMNO"
          ip: "172.30.W.2/24"
          helper_addresses: ["192.168.Y.2"]
          ospf_area: "Y"
          hsrp:
            group: 19
            ip: "172.30.W.254"
            priority: 110
            preempt: true
        - vlan_id: "X"
          description: "SVI for VLAN APELLIDO-ALUMNO"
          ip: "172.30.X.2/24"
          helper_addresses: ["192.168.Y.2"]
          ospf_area: "Y"
          hsrp:
            group: 33
            ip: "172.30.X.254"
            priority: 110
            preempt: true
        - vlan_id: "Y"
          description: "SVI for VLAN ADMIN"
          ip: "172.30.Y.2/24"
          ospf_area: "Y"
          hsrp:
            group: 61
            ip: "172.30.Y.254"
            priority: 110
            preempt: true
      routing:
        - protocol: "ospf"
          ospf:
            process_id: 1
            router_id: "11.11.11.11"
            passive_interfaces: ["Vlan19", "Vlan33", "Vlan61"]
            areas: []

    DLS2:
      vtp:
        mode: "client"
        domain: "LABORATORIO"
        version: 2
      spanning_tree:
        mode: "rapid-pvst"
        root_secondary: ["W", "X"]
        root_primary: ["Y", "Z"]
      port_channels:
        - name: "Po1"
          protocol: "PAgP"
          member_mode: "desirable"
          members: ["E0/1", "E0/2", "E0/3"]
          type: "trunk"
          native_vlan: "Z"
          allowed_vlans: ["W", "X", "Y", "Z"]
      svis:
        - vlan_id: "W"
          description: "SVI for VLAN NOMBRE-ALUMNO (standby)"
          ip: "172.30.W.3/24"
          helper_addresses: ["192.168.Y.2"]
          ospf_area: "Y"
          hsrp:
            group: 19
            ip: "172.30.W.254"
            priority: 100
            preempt: true
        - vlan_id: "X"
          description: "SVI for VLAN APELLIDO-ALUMNO (standby)"
          ip: "172.30.X.3/24"
          helper_addresses: ["192.168.Y.2"]
          ospf_area: "Y"
          hsrp:
            group: 33
            ip: "172.30.X.254"
            priority: 100
            preempt: true
        - vlan_id: "Y"
          description: "SVI for VLAN ADMIN (standby)"
          ip: "172.30.Y.3/24"
          ospf_area: "Y"
          hsrp:
            group: 61
            ip: "172.30.Y.254"
            priority: 100
            preempt: true
      routing:
        - protocol: "ospf"
          ospf:
            process_id: 1
            router_id: "22.22.22.22"
            passive_interfaces: ["Vlan19", "Vlan33", "Vlan61"]
            areas: []

  layer2_switches:
    ALS1:
      vtp:
        mode: "client"
        domain: "LABORATORIO"
        version: 2
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
          description: "PC VLAN NOMBRE-ALUMNO"
        - name: "E0/3"
          type: "access"
          vlan: "X"
          description: "PC VLAN APELLIDO-ALUMNO"
      spanning_tree:
        mode: "rapid-pvst"
        portfast_default: false
        bpduguard_default: false
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
