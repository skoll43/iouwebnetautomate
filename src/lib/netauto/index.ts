// ============================================================
// NetAutoGen – Public API
// ============================================================

export { normalizeTopology } from "./normalizer";
export { renderDevice } from "./engine";
export type { NormalizedDevice } from "./normalizer";
export type { RenderResult } from "./engine";
export type {
  TopologyDef,
  DeviceConfig,
  InterfaceDef,
  VariableMap,
} from "./types";

import yaml from "js-yaml";
import { normalizeTopology } from "./normalizer";
import { renderDevice, RenderResult } from "./engine";
import { TopologyDef } from "./types";

/**
 * Parse a YAML string and render all device configs.
 * Returns one RenderResult per device.
 */
export function renderTopology(yamlSource: string): RenderResult[] {
  const raw = yaml.load(yamlSource) as TopologyDef;
  const devices = normalizeTopology(raw);
  return devices.map(renderDevice);
}
