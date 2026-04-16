// ============================================================
// Variable Resolver
// Replaces abstract variable keys (W, X, Y, Z) throughout the
// entire topology tree before template rendering.
// ============================================================

import { VariableMap } from "./types";

/**
 * Replace all occurrences of variable keys inside a string value.
 * Variable keys are matched as whole-word tokens.
 *
 * e.g. resolveString("192.168.Y.0/24", { Y: "61" }) → "192.168.61.0/24"
 */
export function resolveString(value: string, vars: VariableMap): string {
  let result = value;
  for (const [key, val] of Object.entries(vars)) {
    // Word boundary replacement – handles "W" inside IPs, VLAN ids, subnet masks
    result = result.replace(new RegExp(`\\b${key}\\b`, "g"), val);
  }
  return result;
}

/**
 * Deep-walk any JSON-serializable value and apply resolveString to every
 * string leaf.  Numbers, booleans and null are returned as-is.
 */
export function resolveVars<T>(node: T, vars: VariableMap): T {
  if (vars === undefined || Object.keys(vars).length === 0) return node;
  if (typeof node === "string") return resolveString(node, vars) as unknown as T;
  if (Array.isArray(node)) return node.map((item) => resolveVars(item, vars)) as unknown as T;
  if (node !== null && typeof node === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      result[k] = resolveVars(v, vars);
    }
    return result as T;
  }
  return node;
}

/**
 * Derive implicit VLAN ID values from the variables map so that VLAN
 * definitions referencing "W" / "X" etc. resolve to integer ids.
 */
export function buildVlanIdMap(vars: VariableMap): Record<string, number> {
  const map: Record<string, number> = {};
  for (const [k, v] of Object.entries(vars)) {
    const n = parseInt(v, 10);
    if (!isNaN(n)) map[k] = n;
  }
  return map;
}
