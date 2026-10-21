"use client";

import { useEffect, useRef, useState } from "react";
import SideNav from "./SideNav";

/* ==============================
   Collapsible navigation
   A round ☰ button; click it and your normal SideNav slides open.
   Closes on: clicking the button again, clicking outside, or Esc.
   Use it on any page instead of <SideNav active="..." />.
============================== */
export default function NavMenu({ active }: { active: string }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: "relative", zIndex: 1000 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
        title="Navigation"
        style={{
          ...toggleBtn,
          ...(open ? toggleBtnOpen : {}),
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.08)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        <span style={{ ...bar, ...(open ? { transform: "translateY(8px) rotate(45deg)" } : {}) }} />
        <span style={{ ...bar, ...(open ? { opacity: 0 } : {}) }} />
        <span style={{ ...bar, ...(open ? { transform: "translateY(-8px) rotate(-45deg)" } : {}) }} />
      </button>

      <div
        style={{
          ...panel,
          opacity: open ? 1 : 0,
          transform: open ? "translateY(0) scale(1)" : "translateY(-10px) scale(.96)",
          pointerEvents: open ? "auto" : "none",
        }}
        // close after picking a page
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a, button")) setOpen(false);
        }}
      >
        <SideNav active={active} />
      </div>
    </div>
  );
}

const toggleBtn: React.CSSProperties = {
  width: 62,
  height: 62,
  borderRadius: "50%",
  border: "1px solid rgba(168,85,247,.7)",
  background: "linear-gradient(135deg,#2e1065,#7e22ce)",
  boxShadow: "0 0 22px rgba(168,85,247,.6)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  cursor: "pointer",
  transition: "transform .18s ease, box-shadow .18s ease, background .18s ease",
};

const toggleBtnOpen: React.CSSProperties = {
  background: "linear-gradient(135deg,#7e22ce,#c026d3)",
  boxShadow: "0 0 30px rgba(217,70,239,.85)",
};

const bar: React.CSSProperties = {
  width: 24,
  height: 2.5,
  borderRadius: 2,
  background: "#fff",
  boxShadow: "0 0 6px rgba(255,255,255,.7)",
  transition: "transform .22s ease, opacity .18s ease",
};

const panel: React.CSSProperties = {
  position: "absolute",
  top: 74,
  left: 0,
  width: 260,
  transformOrigin: "top left",
  transition: "opacity .2s ease, transform .2s ease",
  filter: "drop-shadow(0 0 22px rgba(168,85,247,.45))",
};
