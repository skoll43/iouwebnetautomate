// ============================================================
// Built-in example topologies
// ============================================================

export const EXAMPLE_MULTI_AREA_OSPF = `topology_name: "Multi-Area OSPF with L2/L3 Switching"

variables:
  W: "19"
  X: "33"
  Y: "61"
  Z: "85"

vlans:
  - vlan_id: "19"
    name: "NOMBRE-ALUMNO"
    subnet: "172.30.19.0/24"
  - vlan_id: "33"
    name: "APELLIDO-ALUMNO"
    subnet: "172.30.33.0/24"
  - vlan_id: "61"
    name: "ADMIN"
    subnet: "172.30.61.0/24"
  - vlan_id: "85"
    name: "NATIVA"
    subnet: "172.30.85.0/24"

devices:
  routers:
    R4:
      interfaces:
        - name: "Loopback0"
          ip: "8.8.8.8/32"
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
          description: "Uplink to R4/ISP"
        - name: "E0/0"
          ip: "192.168.85.1/30"
          description: "To R2 (Area 85)"
          ospf_area: 85
      routing:
        - protocol: "ospf"
          ospf:
            process_id: 1
            router_id: "1.1.1.1"
            areas: []
            default_route_originate: true

    R2:
      interfaces:
        - name: "E0/0"
          ip: "192.168.85.2/30"
          description: "To R1 (Area 85)"
          ospf_area: 85
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
          ip: "192.168.61.2/30"
          description: "To DLS1 (Area 61)"
          ospf_area: 61
      routing:
        - protocol: "ospf"
          ospf:
            process_id: 1
            router_id: "3.3.3.3"
            areas: []
      dhcp:
        pools:
          - pool_name: "POOL-VLAN19"
            network: "172.30.19.0/24"
            default_router: "172.30.19.1"
            dns_server: "8.8.8.8"
            excluded_addresses:
              - "172.30.19.1 172.30.19.10"
          - pool_name: "POOL-VLAN33"
            network: "172.30.33.0/24"
            default_router: "172.30.33.1"
            dns_server: "8.8.8.8"
            excluded_addresses:
              - "172.30.33.1 172.30.33.10"

  layer3_switches:
    DLS1:
      vtp:
        mode: "server"
        domain: "LABORATORIO"
        version: 2
      spanning_tree:
        mode: "rapid-pvst"
        root_primary: ["19", "33"]
        root_secondary: ["61", "85"]
      interfaces:
        - name: "E0/0"
          ip: "192.168.61.1/30"
          description: "To R3 (Area 61)"
          ospf_area: 61
        - name: "E1/0"
          type: "trunk"
          description: "To ALS1"
      port_channels:
        - name: "Po1"
          protocol: "PAgP"
          members: ["E0/1", "E0/2", "E0/3"]
          type: "trunk"
      routing:
        - protocol: "ospf"
          ospf:
            process_id: 1
            router_id: "11.11.11.11"
            areas: []

    DLS2:
      vtp:
        mode: "client"
        domain: "LABORATORIO"
        version: 2
      spanning_tree:
        mode: "rapid-pvst"
        root_secondary: ["19", "33"]
        root_primary: ["61", "85"]
      interfaces:
        - name: "E1/1"
          type: "trunk"
          description: "To ALS1"
      port_channels:
        - name: "Po1"
          protocol: "PAgP"
          members: ["E0/1", "E0/2", "E0/3"]
          type: "trunk"

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
        - name: "E1/1"
          type: "trunk"
          description: "Trunk to DLS2"
        - name: "E0/2"
          type: "access"
          vlan: "19"
          description: "PC VLAN NOMBRE-ALUMNO"
        - name: "E0/3"
          type: "access"
          vlan: "33"
          description: "PC VLAN APELLIDO-ALUMNO"
      spanning_tree:
        mode: "rapid-pvst"
        portfast_default: true
        bpduguard_default: true
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
