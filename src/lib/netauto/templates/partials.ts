// ============================================================
// Jinja2/Nunjucks Partial Templates (reusable blocks)
// Nunjucks-compatible syntax (trimBlocks + lstripBlocks enabled)
// ============================================================

// ----- INTERFACES (L3 routed + L2 access/trunk) -----
export const INTERFACES_PARTIAL = `{% for iface in interfaces %}
!
interface {{ iface.name | expand_iface }}
{% if iface.description %} description {{ iface.description }}
{% endif %}{% if iface.type == "loopback" or (iface.name | lower).indexOf("lo") == 0 %} ip address {{ iface.ip | cidr_to_mask }}
 no shutdown
{% elif iface.type == "trunk" %} switchport trunk encapsulation dot1q
 switchport mode trunk
 switchport nonegotiate
{% if iface.native_vlan %} switchport trunk native vlan {{ iface.native_vlan }}
{% endif %}{% if iface.allowed_vlans %} switchport trunk allowed vlan {{ iface.allowed_vlans | join(",") }}
{% endif %} no shutdown
{% elif iface.type == "access" %} switchport mode access
 switchport access vlan {{ iface.vlan }}
 switchport nonegotiate
 spanning-tree portfast
 spanning-tree bpduguard enable
 no shutdown
{% else %}{% if role == "l3_switch" %} no switchport
{% endif %}{% if iface.ip %} ip address {{ iface.ip | cidr_to_mask }}
{% endif %}{% if iface.helper_addresses %}{% for helper in iface.helper_addresses %} ip helper-address {{ helper }}
{% endfor %}{% endif %}{% if iface.ospf_area is not undefined and iface.ospf_area !== null %} ip ospf 1 area {{ iface.ospf_area }}
{% if iface.ospf_cost %} ip ospf cost {{ iface.ospf_cost }}
{% endif %}{% if iface.ospf_priority is not undefined %} ip ospf priority {{ iface.ospf_priority }}
{% endif %}{% endif %}{% if iface.channel_group is not undefined %} channel-group {{ iface.channel_group }} mode {{ iface.channel_group_mode if iface.channel_group_mode else "desirable" }}
{% endif %}{% if iface.hsrp %} standby version {{ iface.hsrp.version if iface.hsrp.version else 2 }}
 standby {{ iface.hsrp.group }} ip {{ iface.hsrp.ip }}
{% if iface.hsrp.priority %} standby {{ iface.hsrp.group }} priority {{ iface.hsrp.priority }}
{% endif %}{% if iface.hsrp.preempt %} standby {{ iface.hsrp.group }} preempt
{% endif %}{% endif %}{% if iface.shutdown %} shutdown
{% else %} no shutdown
{% endif %}{% endif %}{% endfor %}`.trim();

// ----- SVI (L3 VLAN interfaces) -----
export const SVI_PARTIAL = `{% for svi in svis %}
!
interface Vlan{{ svi.vlan_id }}
{% if svi.description %} description {{ svi.description }}
{% endif %}{% if svi.ip %} ip address {{ svi.ip | cidr_to_mask }}
{% endif %}{% if svi.helper_addresses %}{% for helper in svi.helper_addresses %} ip helper-address {{ helper }}
{% endfor %}{% endif %}{% if svi.hsrp %} standby version {{ svi.hsrp.version if svi.hsrp.version else 2 }}
 standby {{ svi.hsrp.group }} ip {{ svi.hsrp.ip }}
{% if svi.hsrp.priority %} standby {{ svi.hsrp.group }} priority {{ svi.hsrp.priority }}
{% endif %}{% if svi.hsrp.preempt %} standby {{ svi.hsrp.group }} preempt
{% endif %}{% endif %}{% if svi.shutdown %} shutdown
{% else %} no shutdown
{% endif %}{% endfor %}`.trim();

// ----- PORT CHANNELS -----
// The logical Port-channel interface, then each member gets a switchport
// statement + channel-group with the correct PAgP/LACP mode.
export const PORT_CHANNELS_PARTIAL = `{% for pc in port_channels %}
!
interface {{ pc.name | expand_iface }}
 switchport
{% if pc.type == "trunk" %} switchport trunk encapsulation dot1q
 switchport mode trunk
 switchport nonegotiate
{% if pc.native_vlan %} switchport trunk native vlan {{ pc.native_vlan }}
{% endif %}{% if pc.allowed_vlans %} switchport trunk allowed vlan {{ pc.allowed_vlans | join(",") }}
{% endif %}{% elif pc.type == "access" %} switchport mode access
{% if pc.access_vlan %} switchport access vlan {{ pc.access_vlan }}
{% endif %}{% endif %} no shutdown
{% endfor %}{% for pc in port_channels %}{% set pcnum = pc.name | replace("Po","") %}{% set proto = (pc.protocol | upper) if pc.protocol else "PAGP" %}{% set defmode = "active" if proto == "LACP" else ("on" if proto == "STATIC" else "desirable") %}{% set chmode = pc.member_mode if pc.member_mode else defmode %}{% for member in pc.members %}
!
interface {{ member | expand_iface }}
 switchport
{% if pc.type == "trunk" %} switchport trunk encapsulation dot1q
 switchport mode trunk
{% if pc.native_vlan %} switchport trunk native vlan {{ pc.native_vlan }}
{% endif %}{% endif %} channel-group {{ pcnum }} mode {{ chmode }}
 no shutdown
{% endfor %}{% endfor %}`.trim();

// ----- OSPF -----
export const OSPF_PARTIAL = `{% for rp in routing %}{% if rp.protocol == "ospf" %}
!
router ospf {{ rp.ospf.process_id if rp.ospf.process_id else 1 }}
{% if rp.ospf.router_id %} router-id {{ rp.ospf.router_id }}
{% endif %}{% for area in rp.ospf.areas %}{% for net in area.networks %} network {{ net | network_addr }} {{ net | wildcard }} area {{ area.area_id }}
{% endfor %}{% endfor %}{% for on in ospf_networks %} network {{ on.network }} {{ on.wildcard }} area {{ on.area }}
{% endfor %}{% if rp.ospf.passive_interfaces %}{% for pi in rp.ospf.passive_interfaces %} passive-interface {{ pi | expand_iface }}
{% endfor %}{% endif %}{% if rp.ospf.default_route_originate %} default-information originate always
{% endif %}{% if rp.ospf.redistribute %}{% for rd in rp.ospf.redistribute %} redistribute {{ rd.protocol }}{% if rd.subnets %} subnets{% endif %}{% if rd.metric %} metric {{ rd.metric }}{% endif %}{% if rd.route_map %} route-map {{ rd.route_map }}{% endif %}
{% endfor %}{% endif %}{% endif %}{% endfor %}{% if (not routing or routing.length == 0) and ospf_networks.length > 0 %}
!
router ospf 1
{% for on in ospf_networks %} network {{ on.network }} {{ on.wildcard }} area {{ on.area }}
{% endfor %}{% endif %}`.trim();

// ----- EIGRP -----
export const EIGRP_PARTIAL = `{% for rp in routing %}{% if rp.protocol == "eigrp" %}
!
router eigrp {{ rp.eigrp.as_number }}
{% for net in rp.eigrp.networks %} network {{ net | network_addr }} {{ net | wildcard }}
{% endfor %}{% if rp.eigrp.passive_interfaces %}{% for pi in rp.eigrp.passive_interfaces %} passive-interface {{ pi | expand_iface }}
{% endfor %}{% endif %}{% if rp.eigrp.no_auto_summary %} no auto-summary
{% endif %}{% if rp.eigrp.redistribute %}{% for rd in rp.eigrp.redistribute %} redistribute {{ rd.protocol }}{% if rd.metric %} metric {{ rd.metric }}{% endif %}
{% endfor %}{% endif %}{% endif %}{% endfor %}`.trim();

// ----- BGP -----
export const BGP_PARTIAL = `{% for rp in routing %}{% if rp.protocol == "bgp" %}
!
router bgp {{ rp.bgp.as_number }}
{% if rp.bgp.router_id %} bgp router-id {{ rp.bgp.router_id }}
{% endif %}{% for nbr in rp.bgp.neighbors %} neighbor {{ nbr.ip }} remote-as {{ nbr.remote_as }}
{% if nbr.description %} neighbor {{ nbr.ip }} description {{ nbr.description }}
{% endif %}{% if nbr.update_source %} neighbor {{ nbr.ip }} update-source {{ nbr.update_source }}
{% endif %}{% if nbr.next_hop_self %} neighbor {{ nbr.ip }} next-hop-self
{% endif %}{% endfor %}{% if rp.bgp.networks %}{% for net in rp.bgp.networks %} network {{ net }}
{% endfor %}{% endif %}{% if rp.bgp.redistribute %}{% for rd in rp.bgp.redistribute %} redistribute {{ rd.protocol }}{% if rd.metric %} metric {{ rd.metric }}{% endif %}
{% endfor %}{% endif %}{% endif %}{% endfor %}`.trim();

// ----- STATIC ROUTES -----
export const STATIC_ROUTES_PARTIAL = `{% for rp in routing %}{% if rp.protocol == "static" %}{% for route in rp.routes %}ip route {{ route.prefix | cidr_to_mask }} {{ route.next_hop }}{% if route.ad %} {{ route.ad }}{% endif %}{% if route.description %} name {{ route.description }}{% endif %}

{% endfor %}{% endif %}{% endfor %}`.trim();

// ----- DHCP -----
export const DHCP_PARTIAL = `{% if dhcp %}{% for pool in dhcp.pools %}{% if pool.excluded_addresses %}{% for excl in pool.excluded_addresses %}ip dhcp excluded-address {{ excl }}
{% endfor %}{% endif %}{% endfor %}{% for pool in dhcp.pools %}
!
ip dhcp pool {{ pool.pool_name }}
 network {{ pool.network | cidr_to_mask }}
{% if pool.default_router %} default-router {{ pool.default_router }}
{% endif %}{% if pool.dns_server %} dns-server {{ pool.dns_server }}
{% endif %}{% if pool.domain %} domain-name {{ pool.domain }}
{% endif %}{% if pool.lease_days %} lease {{ pool.lease_days }}
{% endif %}{% endfor %}{% endif %}`.trim();

// ----- SPANNING TREE -----
// Supports PVST / Rapid-PVST (per-VLAN root priorities) and MST
// (region name + revision + instance-to-VLAN mappings + per-instance
// root role / explicit priority / optional timers).
export const STP_PARTIAL = `{% if spanning_tree %}{% set stp_mode = spanning_tree.mode if spanning_tree.mode else "rapid-pvst" %}
spanning-tree mode {{ stp_mode }}
{% if spanning_tree.extend_system_id !== false %}spanning-tree extend system-id
{% endif %}{% if stp_mode == "mst" and spanning_tree.mst %}!
spanning-tree mst configuration
 name {{ spanning_tree.mst.region_name }}
 revision {{ spanning_tree.mst.revision }}
{% for inst in spanning_tree.mst.instances %}{% if inst.instance_id != 0 %} instance {{ inst.instance_id }} vlan {{ inst.vlans | join(",") }}
{% endif %}{% endfor %}exit
{% if spanning_tree.mst.max_hops %}spanning-tree mst max-hops {{ spanning_tree.mst.max_hops }}
{% endif %}{% if spanning_tree.mst.hello_time %}spanning-tree mst hello-time {{ spanning_tree.mst.hello_time }}
{% endif %}{% if spanning_tree.mst.forward_time %}spanning-tree mst forward-time {{ spanning_tree.mst.forward_time }}
{% endif %}{% if spanning_tree.mst.max_age %}spanning-tree mst max-age {{ spanning_tree.mst.max_age }}
{% endif %}{% for inst in spanning_tree.mst.instances %}{% if inst.root %}spanning-tree mst {{ inst.instance_id }} root {{ inst.root }}
{% endif %}{% if inst.priority is not undefined %}spanning-tree mst {{ inst.instance_id }} priority {{ inst.priority }}
{% endif %}{% if inst.hello_time %}spanning-tree mst {{ inst.instance_id }} hello-time {{ inst.hello_time }}
{% endif %}{% if inst.forward_time %}spanning-tree mst {{ inst.instance_id }} forward-time {{ inst.forward_time }}
{% endif %}{% if inst.max_age %}spanning-tree mst {{ inst.instance_id }} max-age {{ inst.max_age }}
{% endif %}{% endfor %}{% else %}{% if spanning_tree.root_primary %}{% for vl in spanning_tree.root_primary %}spanning-tree vlan {{ vl }} root primary
{% endfor %}{% endif %}{% if spanning_tree.root_secondary %}{% for vl in spanning_tree.root_secondary %}spanning-tree vlan {{ vl }} root secondary
{% endfor %}{% endif %}{% if spanning_tree.vlan_priorities %}{% for vp in spanning_tree.vlan_priorities %}spanning-tree vlan {{ vp.vlan }} priority {{ vp.priority }}
{% endfor %}{% endif %}{% endif %}{% if spanning_tree.portfast_default %}spanning-tree portfast default
{% endif %}{% if spanning_tree.bpduguard_default %}spanning-tree portfast bpduguard default
{% endif %}{% endif %}`.trim();

// ----- VTP -----
export const VTP_PARTIAL = `{% if vtp %}
vtp mode {{ vtp.mode }}
{% if vtp.domain %}vtp domain {{ vtp.domain }}
{% endif %}{% if vtp.version %}vtp version {{ vtp.version }}
{% endif %}{% endif %}`.trim();

// ----- SSH -----
export const SSH_PARTIAL = `{% if ssh %}
!
ip domain-name {{ ssh.domain_name }}
crypto key generate rsa modulus {{ ssh.key_bits if ssh.key_bits else 2048 }}
ip ssh version {{ ssh.version if ssh.version else 2 }}
{% if ssh.local_users %}{% for user in ssh.local_users %}username {{ user.username }} privilege {{ user.privilege if user.privilege else 15 }} secret {{ user.secret }}
{% endfor %}{% endif %}line vty 0 4
 login local
 transport input ssh
{% endif %}`.trim();

// ----- NTP -----
export const NTP_PARTIAL = `{% if ntp %}{% if ntp.master %}
ntp master {{ ntp.master_stratum if ntp.master_stratum else 3 }}
{% endif %}{% if ntp.server %}ntp server {{ ntp.server }}
{% endif %}{% endif %}`.trim();

// ----- VLAN DB -----
export const VLAN_DB_PARTIAL = `{% for vlan in vlans %}
vlan {{ vlan.id }}
 name {{ vlan.name }}
{% endfor %}`.trim();

// ----- ENDPOINTS (documentation only) -----
// Rendered as a comment block listing every endpoint attached to
// this device.  Pre-rendered in engine.ts (as `endpoints_comment`)
// to bypass Nunjucks' trimBlocks quirk that collapses multi-line
// loop output in pure-comment sections.
export const ENDPOINTS_PARTIAL = `{{ endpoints_comment }}`.trim();
