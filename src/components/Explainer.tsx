"use client";

import { useState, useMemo } from "react";
import { DOC_SECTIONS, DOC_CATEGORIES, type DocSection } from "@/lib/netauto/docs";

interface ExplainerProps {
  onClose: () => void;
  onLoadExample?: (yaml: string) => void;
}

export default function Explainer({ onClose, onLoadExample }: ExplainerProps) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | "all">("all");
  const [activeSection, setActiveSection] = useState<string | null>(
    DOC_SECTIONS[0]?.id ?? null
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DOC_SECTIONS.filter((s) => {
      if (activeCategory !== "all" && s.category !== activeCategory) return false;
      if (!q) return true;
      const hay = (
        s.title +
        " " +
        s.summary +
        " " +
        (s.longDescription ?? "") +
        " " +
        s.fields.map((f) => f.name + " " + f.description).join(" ") +
        " " +
        s.yamlExample
      ).toLowerCase();
      return hay.includes(q);
    });
  }, [query, activeCategory]);

  const selected = useMemo(
    () => filtered.find((s) => s.id === activeSection) ?? filtered[0] ?? null,
    [filtered, activeSection]
  );

  return (
    <div
      className="fixed inset-0 z-50 flex"
      style={{ background: "rgba(0,0,0,0.7)", fontFamily: "sans-serif" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="m-auto flex flex-col"
        style={{
          width: "min(1400px, 95vw)",
          height: "90vh",
          background: "#0d1117",
          border: "1px solid #30363d",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-3"
          style={{ borderBottom: "1px solid #30363d", background: "#161b22", flexShrink: 0 }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#58a6ff" strokeWidth="2" />
            <path d="M12 8v4M12 16h.01" stroke="#58a6ff" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <h2 className="font-bold text-base" style={{ color: "#e6edf3" }}>
            NetAutoGen Reference
          </h2>
          <span
            className="text-xs px-2 py-0.5 rounded"
            style={{ background: "#1a3a5c", color: "#58a6ff" }}
          >
            YAML Schema Explorer
          </span>

          {/* Search */}
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search fields, protocols, examples..."
            className="ml-4 flex-1 max-w-md px-3 py-1.5 text-sm rounded"
            style={{
              background: "#0d1117",
              border: "1px solid #30363d",
              color: "#e6edf3",
              outline: "none",
            }}
          />

          <button
            onClick={onClose}
            className="ml-auto px-3 py-1.5 text-xs rounded cursor-pointer transition-all"
            style={{
              background: "#21262d",
              border: "1px solid #30363d",
              color: "#8b949e",
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.color = "#f85149";
              (e.target as HTMLElement).style.borderColor = "#f85149";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.color = "#8b949e";
              (e.target as HTMLElement).style.borderColor = "#30363d";
            }}
          >
            Close (Esc)
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* ── Sidebar: categories + sections ── */}
          <div
            className="flex flex-col overflow-hidden"
            style={{
              width: 280,
              flexShrink: 0,
              borderRight: "1px solid #30363d",
              background: "#161b22",
            }}
          >
            {/* Category filter */}
            <div className="px-3 py-2" style={{ borderBottom: "1px solid #30363d" }}>
              <button
                onClick={() => setActiveCategory("all")}
                className="text-xs px-2 py-1 mr-1 mb-1 rounded cursor-pointer"
                style={{
                  background: activeCategory === "all" ? "#1f6feb" : "#21262d",
                  color: activeCategory === "all" ? "#ffffff" : "#8b949e",
                  border: "1px solid #30363d",
                }}
              >
                All
              </button>
              {DOC_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className="text-xs px-2 py-1 mr-1 mb-1 rounded cursor-pointer"
                  style={{
                    background: activeCategory === cat.id ? cat.color : "#21262d",
                    color: activeCategory === cat.id ? "#0d1117" : cat.color,
                    border: `1px solid ${cat.color}`,
                    fontWeight: activeCategory === cat.id ? 600 : 400,
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Section list */}
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="text-xs p-4" style={{ color: "#8b949e" }}>
                  No matches.
                </div>
              ) : (
                filtered.map((sec) => (
                  <button
                    key={sec.id}
                    onClick={() => setActiveSection(sec.id)}
                    className="w-full text-left px-3 py-2 cursor-pointer transition-colors block"
                    style={{
                      background: selected?.id === sec.id ? "#0d1117" : "transparent",
                      borderLeft: `3px solid ${
                        selected?.id === sec.id ? sec.color : "transparent"
                      }`,
                      borderBottom: "1px solid #21262d",
                    }}
                  >
                    <div
                      className="text-sm font-semibold"
                      style={{
                        color: selected?.id === sec.id ? sec.color : "#e6edf3",
                      }}
                    >
                      {sec.title}
                    </div>
                    <div className="text-xs mt-0.5 line-clamp-2" style={{ color: "#8b949e" }}>
                      {sec.summary}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* ── Main: section detail ── */}
          <div className="flex-1 overflow-y-auto p-6" style={{ background: "#0d1117" }}>
            {selected ? (
              <SectionDetail section={selected} onLoadExample={onLoadExample} />
            ) : (
              <div style={{ color: "#8b949e" }}>Select a section.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Section detail view
// ------------------------------------------------------------------

function SectionDetail({
  section,
  onLoadExample,
}: {
  section: DocSection;
  onLoadExample?: (yaml: string) => void;
}) {
  return (
    <div>
      {/* Title */}
      <div className="flex items-center gap-3 mb-3">
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: section.color,
            flexShrink: 0,
          }}
        />
        <h1 className="text-2xl font-bold" style={{ color: "#e6edf3" }}>
          {section.title}
        </h1>
        <span
          className="text-xs px-2 py-0.5 rounded uppercase tracking-wide"
          style={{
            background: section.color + "22",
            color: section.color,
            border: `1px solid ${section.color}`,
          }}
        >
          {DOC_CATEGORIES.find((c) => c.id === section.category)?.label ?? section.category}
        </span>
      </div>

      {/* Summary */}
      <p className="text-sm mb-3" style={{ color: "#c9d1d9" }}>
        {section.summary}
      </p>

      {section.longDescription && (
        <p
          className="text-sm mb-6 p-3 rounded leading-relaxed"
          style={{ background: "#161b22", border: "1px solid #30363d", color: "#8b949e" }}
        >
          {section.longDescription}
        </p>
      )}

      {/* Fields table */}
      {section.fields.length > 0 && (
        <>
          <h3 className="text-sm font-semibold mt-6 mb-2" style={{ color: section.color }}>
            Fields
          </h3>
          <div
            className="rounded overflow-hidden mb-6"
            style={{ border: "1px solid #30363d" }}
          >
            <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#161b22" }}>
                  <th
                    className="text-left px-3 py-2 font-semibold"
                    style={{ color: "#8b949e", borderBottom: "1px solid #30363d", width: 180 }}
                  >
                    Field
                  </th>
                  <th
                    className="text-left px-3 py-2 font-semibold"
                    style={{ color: "#8b949e", borderBottom: "1px solid #30363d", width: 160 }}
                  >
                    Type
                  </th>
                  <th
                    className="text-left px-3 py-2 font-semibold"
                    style={{ color: "#8b949e", borderBottom: "1px solid #30363d" }}
                  >
                    Description
                  </th>
                </tr>
              </thead>
              <tbody>
                {section.fields.map((f, i) => (
                  <tr
                    key={f.name}
                    style={{
                      background: i % 2 === 0 ? "transparent" : "#0a0e14",
                      borderBottom: "1px solid #21262d",
                    }}
                  >
                    <td className="px-3 py-2 align-top">
                      <code
                        className="font-mono"
                        style={{ color: section.color, fontSize: "0.75rem" }}
                      >
                        {f.name}
                      </code>
                      {f.required && (
                        <span
                          className="ml-2 text-[10px] px-1.5 py-0.5 rounded"
                          style={{
                            background: "#f85149" + "22",
                            color: "#f85149",
                            border: "1px solid #f85149",
                          }}
                        >
                          required
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <code
                        className="font-mono text-xs"
                        style={{ color: "#a5f3fc" }}
                      >
                        {f.type}
                      </code>
                      {f.default !== undefined && (
                        <div className="text-[10px] mt-0.5" style={{ color: "#8b949e" }}>
                          default: <code>{f.default}</code>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top" style={{ color: "#c9d1d9" }}>
                      {f.description}
                      {f.values && f.values.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {f.values.map((v) => (
                            <code
                              key={v}
                              className="text-[10px] px-1.5 py-0.5 rounded"
                              style={{
                                background: "#21262d",
                                color: "#79c0ff",
                                border: "1px solid #30363d",
                              }}
                            >
                              {v}
                            </code>
                          ))}
                        </div>
                      )}
                      {f.example && (
                        <div className="mt-1">
                          <code
                            className="text-[10px]"
                            style={{ color: "#a5f3fc" }}
                          >
                            e.g. {f.example}
                          </code>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* YAML example */}
      <h3 className="text-sm font-semibold mb-2" style={{ color: section.color }}>
        YAML example
      </h3>
      <div className="flex gap-2 mb-6">
        <pre
          className="flex-1 rounded p-3 text-xs overflow-x-auto"
          style={{
            background: "#161b22",
            border: "1px solid #30363d",
            color: "#e6edf3",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          {section.yamlExample}
        </pre>
        <div className="flex flex-col gap-1">
          <button
            onClick={() => navigator.clipboard.writeText(section.yamlExample)}
            className="text-[10px] px-2 py-1 rounded cursor-pointer whitespace-nowrap"
            style={{
              background: "#21262d",
              color: "#8b949e",
              border: "1px solid #30363d",
            }}
          >
            Copy
          </button>
        </div>
      </div>

      {/* IOS output */}
      {section.iosOutput && (
        <>
          <h3 className="text-sm font-semibold mb-2" style={{ color: "#3fb950" }}>
            Generated IOS output
          </h3>
          <pre
            className="rounded p-3 text-xs overflow-x-auto mb-4"
            style={{
              background: "#0a0e14",
              border: "1px solid #30363d",
              color: "#c9d1d9",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            {section.iosOutput}
          </pre>
        </>
      )}

      {onLoadExample && section.yamlExample && (
        <div
          className="mt-6 p-3 rounded text-xs"
          style={{
            background: "#1a3a5c" + "22",
            border: "1px solid #58a6ff",
            color: "#8b949e",
          }}
        >
          <strong style={{ color: "#58a6ff" }}>Tip:</strong> This is a fragment, not a full
          topology. See the example picker buttons in the main toolbar for complete runnable
          YAML files.
        </div>
      )}
    </div>
  );
}
