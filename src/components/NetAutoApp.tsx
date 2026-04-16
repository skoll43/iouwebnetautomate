"use client";

import { useState, useCallback } from "react";
import { EXAMPLE_MULTI_AREA_OSPF, EXAMPLE_EIGRP_BGP } from "@/lib/netauto/examples";

type RenderResult = {
  device: string;
  role: string;
  config: string;
  error?: string;
};

const ROLE_COLORS: Record<string, string> = {
  router: "#58a6ff",
  l3_switch: "#3fb950",
  l2_switch: "#d29922",
  firewall: "#f85149",
};

const ROLE_LABELS: Record<string, string> = {
  router: "Router",
  l3_switch: "L3 Switch",
  l2_switch: "L2 Switch",
  firewall: "Firewall",
};

function highlightIosConfig(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const trimmed = line.trimStart();
      // Comments
      if (trimmed.startsWith("!")) {
        return `<span class="comment">${escHtml(line)}</span>`;
      }
      // Top-level sections
      if (/^(router |interface |vlan |ip dhcp |spanning-tree mode|vtp mode|hostname|banner|crypto key|ip ssh|line vty)/.test(trimmed)) {
        if (/^interface\s/.test(trimmed)) {
          return `<span class="interface">${escHtml(line)}</span>`;
        }
        if (/^hostname\s/.test(trimmed)) {
          return `<span class="hostname">${escHtml(line)}</span>`;
        }
        return `<span class="section">${escHtml(line)}</span>`;
      }
      // IP addresses
      let result = escHtml(line);
      result = result.replace(
        /(\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?:\/\d{1,2})?)/g,
        '<span class="ip-addr">$1</span>'
      );
      // Keywords
      result = result.replace(
        /\b(no|shutdown|area|network|passive-interface|default-information|neighbor|redistribute|route-map|eigrp|ospf|bgp|static|connected|subnets|always|summary|encapsulation|dot1q|access|trunk|portfast|bpduguard|preempt|priority|standby|channel-group|mode|desirable|active|on|root|primary|secondary|rapid-pvst|pvst|server|client|transparent|master|version|secret|privilege|login|local|transport|input|ssh|modulus|rsa|generate|excluded-address|pool|default-router|dns-server|lease)\b/g,
        '<span class="keyword">$1</span>'
      );
      return result;
    })
    .join("\n");
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const EXAMPLES = [
  { label: "Multi-Area OSPF + L2/L3 Switching", yaml: EXAMPLE_MULTI_AREA_OSPF },
  { label: "EIGRP Core + iBGP Route Reflector", yaml: EXAMPLE_EIGRP_BGP },
];

export default function NetAutoApp() {
  const [yamlInput, setYamlInput] = useState(EXAMPLE_MULTI_AREA_OSPF);
  const [results, setResults] = useState<RenderResult[]>([]);
  const [activeDevice, setActiveDevice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const handleRender = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yaml: yamlInput }),
      });
      const data = await res.json() as { results?: RenderResult[]; error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? "Unknown error");
        setResults([]);
      } else {
        setResults(data.results ?? []);
        if (data.results && data.results.length > 0) {
          setActiveDevice(data.results[0].device);
        }
      }
    } catch (e) {
      setError(String(e));
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [yamlInput]);

  const handleCopy = useCallback((device: string, config: string) => {
    navigator.clipboard.writeText(config).then(() => {
      setCopied(device);
      setTimeout(() => setCopied(null), 2000);
    });
  }, []);

  const handleDownloadAll = useCallback(() => {
    results.forEach((r) => {
      const blob = new Blob([r.config], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${r.device}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }, [results]);

  const activeResult = results.find((r) => r.device === activeDevice);

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      {/* ── Header ── */}
      <header
        style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}
        className="px-6 py-3 flex items-center gap-4"
      >
        <div className="flex items-center gap-3">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="6" fill="#1a3a5c" />
            <path d="M6 14h4M14 6v4M22 14h-4M14 22v-4" stroke="#58a6ff" strokeWidth="2" strokeLinecap="round" />
            <circle cx="14" cy="14" r="3" fill="#3fb950" />
            <circle cx="6" cy="14" r="2" fill="#58a6ff" />
            <circle cx="22" cy="14" r="2" fill="#58a6ff" />
            <circle cx="14" cy="6" r="2" fill="#d29922" />
            <circle cx="14" cy="22" r="2" fill="#d29922" />
          </svg>
          <div>
            <span className="text-lg font-bold" style={{ color: "#e6edf3", fontFamily: "sans-serif" }}>
              NetAutoGen
            </span>
            <span className="ml-2 text-xs px-2 py-0.5 rounded" style={{ background: "#1a3a5c", color: "#58a6ff" }}>
              Cisco IOS
            </span>
          </div>
        </div>
        <div className="ml-auto text-xs" style={{ color: "var(--text-secondary)", fontFamily: "sans-serif" }}>
          YAML Topology → Jinja2 → Device Configs
        </div>
      </header>

      {/* ── Main layout ── */}
      <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 53px)" }}>
        {/* ── Left panel: YAML editor ── */}
        <div
          className="flex flex-col"
          style={{
            width: "42%",
            borderRight: "1px solid var(--border)",
            background: "var(--bg-secondary)",
          }}
        >
          {/* Panel header */}
          <div
            className="flex items-center justify-between px-4 py-2"
            style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-tertiary)" }}
          >
            <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)", fontFamily: "sans-serif" }}>
              TOPOLOGY YAML
            </span>
            <div className="flex gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.label}
                  onClick={() => setYamlInput(ex.yaml)}
                  className="text-xs px-2 py-1 rounded cursor-pointer transition-colors"
                  style={{
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border)",
                    color: "var(--text-secondary)",
                    fontFamily: "sans-serif",
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLElement).style.color = "var(--accent-blue)";
                    (e.target as HTMLElement).style.borderColor = "var(--accent-blue)";
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.color = "var(--text-secondary)";
                    (e.target as HTMLElement).style.borderColor = "var(--border)";
                  }}
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>

          {/* Textarea */}
          <textarea
            className="flex-1 p-4 text-xs"
            style={{
              background: "var(--bg-secondary)",
              color: "#e6edf3",
              border: "none",
              borderBottom: "1px solid var(--border)",
              fontSize: "0.75rem",
              lineHeight: "1.6",
            }}
            value={yamlInput}
            onChange={(e) => setYamlInput(e.target.value)}
            spellCheck={false}
            placeholder="Paste your topology YAML here..."
          />

          {/* Schema legend */}
          <div
            className="px-4 py-2"
            style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-tertiary)" }}
          >
            <p className="text-xs mb-1" style={{ color: "var(--text-secondary)", fontFamily: "sans-serif" }}>
              Supported protocols:
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "OSPF", color: "#58a6ff" },
                { label: "EIGRP", color: "#3fb950" },
                { label: "BGP", color: "#bc8cff" },
                { label: "Static", color: "#d29922" },
                { label: "STP/RSTP", color: "#39c5cf" },
                { label: "HSRP", color: "#f85149" },
                { label: "DHCP", color: "#ff7b72" },
                { label: "PAgP/LACP", color: "#a5f3fc" },
                { label: "SSH/AAA", color: "#f0883e" },
              ].map(({ label, color }) => (
                <span
                  key={label}
                  className="text-xs px-2 py-0.5 rounded"
                  style={{ background: "var(--bg-secondary)", border: `1px solid ${color}`, color, fontFamily: "sans-serif" }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Render button */}
          <div className="px-4 py-3" style={{ background: "var(--bg-tertiary)" }}>
            <button
              onClick={handleRender}
              disabled={loading}
              className="w-full py-2 rounded font-semibold text-sm cursor-pointer transition-all"
              style={{
                background: loading ? "#1a3a5c" : "#1f6feb",
                color: loading ? "var(--text-secondary)" : "#ffffff",
                border: "none",
                fontFamily: "sans-serif",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Rendering..." : "Generate Configs"}
            </button>
            {error && (
              <div
                className="mt-2 p-2 rounded text-xs"
                style={{ background: "#2d1b1b", border: "1px solid var(--accent-red)", color: "var(--accent-red)", fontFamily: "sans-serif" }}
              >
                {error}
              </div>
            )}
          </div>
        </div>

        {/* ── Right panel: Rendered configs ── */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1" style={{ color: "var(--text-secondary)" }}>
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="mb-4 opacity-30">
                <rect x="8" y="16" width="48" height="36" rx="4" stroke="currentColor" strokeWidth="2" />
                <path d="M8 24h48" stroke="currentColor" strokeWidth="2" />
                <circle cx="16" cy="20" r="2" fill="currentColor" />
                <circle cx="22" cy="20" r="2" fill="currentColor" />
                <circle cx="28" cy="20" r="2" fill="currentColor" />
                <path d="M20 34h8M20 40h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <p className="text-sm" style={{ fontFamily: "sans-serif" }}>
                Edit the YAML topology and click <strong>Generate Configs</strong>
              </p>
              <p className="text-xs mt-1" style={{ fontFamily: "sans-serif" }}>
                One Cisco IOS config will be rendered per device
              </p>
            </div>
          ) : (
            <>
              {/* Device tab bar */}
              <div
                className="flex items-center gap-1 px-3 py-2 overflow-x-auto"
                style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-tertiary)", flexShrink: 0 }}
              >
                {results.map((r) => (
                  <button
                    key={r.device}
                    onClick={() => setActiveDevice(r.device)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs cursor-pointer transition-all whitespace-nowrap"
                    style={{
                      background: activeDevice === r.device ? "var(--bg-secondary)" : "transparent",
                      border: `1px solid ${activeDevice === r.device ? ROLE_COLORS[r.role] ?? "var(--border)" : "transparent"}`,
                      color: activeDevice === r.device ? ROLE_COLORS[r.role] ?? "var(--text-primary)" : "var(--text-secondary)",
                      fontFamily: "sans-serif",
                    }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: ROLE_COLORS[r.role] ?? "#888",
                        display: "inline-block",
                        flexShrink: 0,
                      }}
                    />
                    {r.device}
                    <span className="opacity-60 text-xs ml-1">
                      {ROLE_LABELS[r.role] ?? r.role}
                    </span>
                    {r.error && (
                      <span style={{ color: "var(--accent-red)", fontSize: "0.65rem" }}>ERR</span>
                    )}
                  </button>
                ))}

                {/* Download all */}
                <button
                  onClick={handleDownloadAll}
                  className="ml-auto px-3 py-1.5 rounded text-xs cursor-pointer whitespace-nowrap"
                  style={{
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border)",
                    color: "var(--text-secondary)",
                    fontFamily: "sans-serif",
                  }}
                >
                  Download All
                </button>
              </div>

              {/* Config viewer */}
              {activeResult && (
                <div className="flex flex-col flex-1 overflow-hidden">
                  {/* Config toolbar */}
                  <div
                    className="flex items-center justify-between px-4 py-1.5"
                    style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)", flexShrink: 0 }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: ROLE_COLORS[activeResult.role] ?? "#888",
                          display: "inline-block",
                        }}
                      />
                      <span className="text-xs font-semibold" style={{ color: ROLE_COLORS[activeResult.role], fontFamily: "sans-serif" }}>
                        {activeResult.device}
                      </span>
                      <span className="text-xs" style={{ color: "var(--text-secondary)", fontFamily: "sans-serif" }}>
                        {ROLE_LABELS[activeResult.role] ?? activeResult.role}
                      </span>
                      <span className="text-xs" style={{ color: "var(--text-secondary)", fontFamily: "sans-serif" }}>
                        &middot; {activeResult.config.split("\n").length} lines
                      </span>
                    </div>
                    <button
                      onClick={() => handleCopy(activeResult.device, activeResult.config)}
                      className="text-xs px-3 py-1 rounded cursor-pointer transition-all"
                      style={{
                        background: "var(--bg-tertiary)",
                        border: `1px solid ${copied === activeResult.device ? "var(--accent-green)" : "var(--border)"}`,
                        color: copied === activeResult.device ? "var(--accent-green)" : "var(--text-secondary)",
                        fontFamily: "sans-serif",
                      }}
                    >
                      {copied === activeResult.device ? "Copied!" : "Copy"}
                    </button>
                  </div>

                  {/* Config content */}
                  <div
                    className="flex-1 overflow-auto p-4"
                    style={{ background: "var(--bg-primary)" }}
                  >
                    {activeResult.error ? (
                      <div
                        className="p-3 rounded text-xs"
                        style={{ background: "#2d1b1b", border: "1px solid var(--accent-red)", color: "var(--accent-red)", fontFamily: "sans-serif" }}
                      >
                        Template render error: {activeResult.error}
                      </div>
                    ) : (
                      <code
                        className="ios-config block"
                        dangerouslySetInnerHTML={{ __html: highlightIosConfig(activeResult.config) }}
                      />
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Architecture info bar ── */}
      <footer
        className="px-6 py-2 text-xs flex items-center gap-4 flex-wrap"
        style={{
          background: "var(--bg-secondary)",
          borderTop: "1px solid var(--border)",
          color: "var(--text-secondary)",
          fontFamily: "sans-serif",
        }}
      >
        <span>
          <span style={{ color: "var(--accent-blue)" }}>YAML</span> topology schema
        </span>
        <span style={{ color: "var(--border)" }}>→</span>
        <span>
          <span style={{ color: "var(--accent-green)" }}>Variable resolver</span> (W/X/Y/Z interpolation)
        </span>
        <span style={{ color: "var(--border)" }}>→</span>
        <span>
          <span style={{ color: "#bc8cff" }}>Normalizer</span> (role detection, OSPF network derivation)
        </span>
        <span style={{ color: "var(--border)" }}>→</span>
        <span>
          <span style={{ color: "var(--accent-yellow)" }}>Nunjucks/Jinja2</span> per-role templates
        </span>
        <span style={{ color: "var(--border)" }}>→</span>
        <span>
          <span style={{ color: "#f0883e)" }}>Cisco IOS</span> device configs
        </span>
      </footer>
    </div>
  );
}
