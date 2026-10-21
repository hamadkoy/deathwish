"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/* ==============================
   Run requests (Reaper+ ask, Dreadlord approves)
   - RunRequestsButton: floating button above 📊 / ❤️ with a badge
   - Opens a centred window with every pending request
   - Approve copies the runs into `runs`; Decline keeps a record + reason
============================== */

export type RequestedRun = {
  title: string;
  day: string;
  time: string;
  run_date: string;
  week: number;
  notes: string;
  background_key: string;
  ilvl_required: number | null;
  exp_required: string | null;
  healer_limit: number;
  dps_limit: number;
};

export type RunRequest = {
  id: number;
  created_at: string;
  requested_by: string;
  requester_name: string | null;
  requester_avatar: string | null;
  requester_role: string | null;
  runs: RequestedRun[];
  signup_open_hours: number;
  status: "pending" | "approved" | "declined";
  decline_reason?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  approved_count?: number | null;
};

const THEME_LABEL: Record<string, { label: string; dot: string }> = {
  "mythic-red": { label: "Mythic Red", dot: "#ef4444" },
  "mythic-purple": { label: "Purple", dot: "#a855f7" },
  "hc-gold": { label: "HC Blue", dot: "#3b82f6" },
  void: { label: "Void", dot: "#60a5fa" },
  kithix: { label: "Kith'ix", dot: "#f97316" },
};

const DEFAULT_AVATAR = "https://cdn.discordapp.com/embed/avatars/0.png";

/* ==============================
   Floating button + window
============================== */
export function RunRequestsButton({
  isAdmin,
  canRequest,
  userId,
  hidden,
  onApproved,
}: {
  isAdmin: boolean;
  // Reaper / officer: sees their own requests and your answers instead
  canRequest?: boolean;
  userId?: string | null;
  hidden?: boolean;
  onApproved?: () => void | Promise<void>;
}) {
  if (hidden) return null;
  if (isAdmin) return <AdminRequestsButton onApproved={onApproved} />;
  if (canRequest && userId) return <MyRequestsButton userId={userId} />;
  return null;
}

function AdminRequestsButton({
  onApproved,
}: {
  onApproved?: () => void | Promise<void>;
}) {
  const [requests, setRequests] = useState<RunRequest[]>([]);
  const [open, setOpen] = useState(false);

  async function load() {
    const { data, error } = await supabase
      .from("run_requests")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (!error) setRequests((data as RunRequest[]) || []);
  }

  useEffect(() => {
    load();

    const channel = supabase
      .channel("run-requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "run_requests" },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const count = requests.length;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={count ? `${count} run request${count === 1 ? "" : "s"} waiting` : "Run requests"}
        style={{
          ...floatBtn,
          animation: count ? "rrPulse 2s ease-in-out infinite" : "none",
        }}
      >
        📝
        {count > 0 && <span style={badge}>{count}</span>}
      </button>

      <style>{`
        @keyframes rrPulse {
          0%, 100% { box-shadow: 0 0 18px rgba(250,204,21,.55); }
          50%      { box-shadow: 0 0 34px rgba(250,204,21,.95); }
        }
      `}</style>

      {open && (
        <RunRequestsWindow
          requests={requests}
          onClose={() => setOpen(false)}
          onChanged={async (approved) => {
            await load();
            if (approved) await onApproved?.();
          }}
        />
      )}
    </>
  );
}

/* ==============================
   The centred window
============================== */
function RunRequestsWindow({
  requests,
  onClose,
  onChanged,
}: {
  requests: RunRequest[];
  onClose: () => void;
  onChanged: (approved: boolean) => void | Promise<void>;
}) {
  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={head}>
          <div>
            <div style={headTitle}>📝 Run Requests</div>
            <div style={headSub}>
              {requests.length === 0
                ? "Nothing waiting for approval"
                : `${requests.length} request${requests.length === 1 ? "" : "s"} waiting for approval`}
            </div>
          </div>

          <button onClick={onClose} style={closeBtn} aria-label="Close">
            ✕
          </button>
        </div>

        <div style={body}>
          {requests.length === 0 ? (
            <div style={empty}>
              <div style={{ fontSize: 64 }}>✨</div>
              <b>All caught up</b>
              <span>New requests from Reapers and officers will show up here.</span>
            </div>
          ) : (
            requests.map((r) => (
              <RequestCard key={r.id} request={r} onChanged={onChanged} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ==============================
   One request (one batch of runs)
============================== */
function RequestCard({
  request,
  onChanged,
}: {
  request: RunRequest;
  onChanged: (approved: boolean) => void | Promise<void>;
}) {
  const runs = request.runs || [];
  const [included, setIncluded] = useState<boolean[]>(() => runs.map(() => true));
  const [busy, setBusy] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const chosen = runs.filter((_, i) => included[i]);
  const first = runs[0];
  const theme = THEME_LABEL[first?.background_key] || { label: first?.background_key || "—", dot: "#a855f7" };

  async function reviewer() {
    const { data } = await supabase.auth.getUser();
    const { data: p } = await supabase
      .from("profiles")
      .select("discord_name")
      .eq("user_id", data.user?.id || "")
      .single();
    return p?.discord_name || data.user?.user_metadata?.full_name || "Admin";
  }

  async function approve() {
    if (chosen.length === 0) {
      setError("Pick at least one run to approve, or decline the request.");
      return;
    }

    setBusy(true);
    setError("");

    // The signup countdown starts when you approve, not when they asked.
    const openAt =
      request.signup_open_hours > 0
        ? new Date(Date.now() + request.signup_open_hours * 3600 * 1000).toISOString()
        : null;

    // The person who asked for the run leads it, not the approver
    const rows = chosen.map((run) => ({
      ...run,
      signup_open_at: openAt,
      created_by: request.requested_by,
      created_by_name: request.requester_name,
      created_by_avatar: request.requester_avatar,
    }));

    const { error: insertError } = await supabase.from("runs").insert(rows);

    if (insertError) {
      setBusy(false);
      setError(insertError.message);
      return;
    }

    await supabase
      .from("run_requests")
      .update({
        status: "approved",
        reviewed_by: await reviewer(),
        reviewed_at: new Date().toISOString(),
        approved_count: rows.length,
      })
      .eq("id", request.id);

    setBusy(false);
    await onChanged(true);
  }

  async function decline() {
    setBusy(true);
    setError("");

    const { error: updError } = await supabase
      .from("run_requests")
      .update({
        status: "declined",
        decline_reason: reason.trim() || null,
        reviewed_by: await reviewer(),
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    setBusy(false);

    if (updError) {
      setError(updError.message);
      return;
    }

    await onChanged(false);
  }

  return (
    <div style={card}>
      {/* requester */}
      <div style={cardHead}>
        <img
          src={request.requester_avatar || DEFAULT_AVATAR}
          onError={(e) => (e.currentTarget.src = DEFAULT_AVATAR)}
          alt=""
          style={avatar}
        />

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={reqName}>
            {request.requester_name || "Unknown"}
            {request.requester_role && <span style={rolePill}>{request.requester_role}</span>}
          </div>
          <div style={reqMeta}>
            Requested {timeAgo(request.created_at)} •{" "}
            {new Date(request.created_at).toLocaleString("en-GB", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>

        <div style={countPill}>
          {runs.length} run{runs.length === 1 ? "" : "s"}
        </div>
      </div>

      {/* shared details */}
      {first && (
        <div style={infoGrid}>
          <Info label="Title" value={first.title} wide />
          <Info label="Required ilvl" value={first.ilvl_required ? `${first.ilvl_required}+` : "None"} />
          <Info label="Boss experience" value={first.exp_required ? `${first.exp_required} or better` : "None"} />
          <Info label="Spots" value={`2 Tanks • ${first.healer_limit} Healers • ${first.dps_limit} DPS`} />
          <Info
            label="Signups open"
            value={
              request.signup_open_hours > 0
                ? `${request.signup_open_hours}h after you approve`
                : "Immediately when approved"
            }
          />
          <Info
            label="Background"
            value={
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span style={{ ...dot, background: theme.dot, boxShadow: `0 0 10px ${theme.dot}` }} />
                {theme.label}
              </span>
            }
          />
          <Info label="Note" value={first.notes?.trim() || "—"} wide />
        </div>
      )}

      {/* the runs */}
      <div style={tableHead}>
        <span />
        <span>Week</span>
        <span>Day</span>
        <span>Date</span>
        <span>Time</span>
        <span>Run</span>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        {runs.map((run, i) => (
          <label
            key={i}
            style={{
              ...runRow,
              opacity: included[i] ? 1 : 0.4,
              textDecoration: included[i] ? "none" : "line-through",
            }}
          >
            <input
              type="checkbox"
              checked={included[i]}
              onChange={(e) =>
                setIncluded((prev) => prev.map((v, idx) => (idx === i ? e.target.checked : v)))
              }
              style={{ width: 22, height: 22, accentColor: "#a855f7", cursor: "pointer" }}
            />
            <span style={{ color: "#facc15", fontWeight: 900 }}>W{run.week}</span>
            <span>{run.day}</span>
            <span>{formatYmd(run.run_date)}</span>
            <span style={{ color: "#facc15", fontWeight: 900 }}>{run.time}</span>
            <span style={runTitle} title={run.title}>
              {run.title}
            </span>
          </label>
        ))}
      </div>

      {runs.length > 1 && (
        <div style={hint}>Untick any run you don&apos;t want — only the ticked ones are created.</div>
      )}

      {error && <div style={errorBox}>{error}</div>}

      {/* actions */}
      {declining ? (
        <div style={actions}>
          <input
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional) — e.g. time clashes with another run"
            style={reasonInput}
          />
          <button disabled={busy} onClick={() => setDeclining(false)} style={ghostBtn}>
            Back
          </button>
          <button disabled={busy} onClick={decline} style={declineBtn}>
            {busy ? "Declining…" : "Confirm decline"}
          </button>
        </div>
      ) : (
        <div style={actions}>
          <button disabled={busy} onClick={() => setDeclining(true)} style={declineBtn}>
            ❌ Decline
          </button>
          <button disabled={busy || chosen.length === 0} onClick={approve} style={approveBtn}>
            {busy
              ? "Approving…"
              : `✅ Approve ${chosen.length} run${chosen.length === 1 ? "" : "s"}`}
          </button>
        </div>
      )}
    </div>
  );
}

function Info({ label, value, wide }: { label: string; value: React.ReactNode; wide?: boolean }) {
  return (
    <div style={{ gridColumn: wide ? "1 / -1" : undefined }}>
      <div style={infoLabel}>{label}</div>
      <div style={infoValue}>{value}</div>
    </div>
  );
}

/* ==============================
   Requester view: "My run requests"
   Badge = answers (approved / declined) they haven't opened yet.
   "Seen" is remembered per browser.
============================== */
const SEEN_KEY = "runRequestsSeenAt";

function readSeen() {
  try {
    return Number(localStorage.getItem(SEEN_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeSeen(ms: number) {
  try {
    localStorage.setItem(SEEN_KEY, String(ms));
  } catch {
    /* private mode: badge just won't remember */
  }
}

function MyRequestsButton({ userId }: { userId: string }) {
  const [requests, setRequests] = useState<RunRequest[]>([]);
  const [open, setOpen] = useState(false);
  const [seenAt, setSeenAt] = useState(0);
  // answers newer than this stay highlighted while the window is open
  const [highlightSince, setHighlightSince] = useState(0);

  async function load() {
    const { data, error } = await supabase
      .from("run_requests")
      .select("*")
      .eq("requested_by", userId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (!error) setRequests((data as RunRequest[]) || []);
  }

  useEffect(() => {
    setSeenAt(readSeen());
    load();

    const channel = supabase
      .channel(`my-run-requests-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "run_requests",
          filter: `requested_by=eq.${userId}`,
        },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  if (requests.length === 0) return null; // nothing to show until they request

  const unseen = requests.filter(
    (r) => r.status !== "pending" && r.reviewed_at && new Date(r.reviewed_at).getTime() > seenAt
  );
  const pending = requests.filter((r) => r.status === "pending").length;
  const hasDecline = unseen.some((r) => r.status === "declined");

  function openWindow() {
    setHighlightSince(seenAt);
    setOpen(true);
    const now = Date.now();
    writeSeen(now);
    setSeenAt(now);
  }

  return (
    <>
      <button
        onClick={openWindow}
        title={
          unseen.length
            ? `${unseen.length} new answer${unseen.length === 1 ? "" : "s"} on your run requests`
            : pending
            ? `${pending} request${pending === 1 ? "" : "s"} waiting for approval`
            : "My run requests"
        }
        style={{
          ...floatBtn,
          animation: unseen.length ? "rrPulse 2s ease-in-out infinite" : "none",
        }}
      >
        📝
        {unseen.length > 0 && (
          <span style={{ ...badge, background: hasDecline ? "#ef4444" : "#22c55e" }}>
            {unseen.length}
          </span>
        )}
      </button>

      <style>{`
        @keyframes rrPulse {
          0%, 100% { box-shadow: 0 0 18px rgba(250,204,21,.55); }
          50%      { box-shadow: 0 0 34px rgba(250,204,21,.95); }
        }
      `}</style>

      {open && (
        <div style={overlay} onClick={() => setOpen(false)}>
          <div style={{ ...panel, width: "min(1200px, 96vw)" }} onClick={(e) => e.stopPropagation()}>
            <div style={head}>
              <div>
                <div style={headTitle}>📝 My Run Requests</div>
                <div style={headSub}>
                  {pending > 0
                    ? `${pending} waiting for a Dreadlord`
                    : "Your recent requests and their answers"}
                </div>
              </div>

              <button onClick={() => setOpen(false)} style={closeBtn} aria-label="Close">
                ✕
              </button>
            </div>

            <div style={body}>
              {requests.map((r) => (
                <MyRequestCard
                  key={r.id}
                  request={r}
                  isNew={
                    r.status !== "pending" &&
                    !!r.reviewed_at &&
                    new Date(r.reviewed_at).getTime() > highlightSince
                  }
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MyRequestCard({ request, isNew }: { request: RunRequest; isNew: boolean }) {
  const runs = request.runs || [];
  const first = runs[0];

  const status =
    request.status === "approved"
      ? { label: "✅ Approved", color: "#4ade80", border: "rgba(34,197,94,.6)", bg: "rgba(5,46,22,.55)" }
      : request.status === "declined"
      ? { label: "❌ Declined", color: "#fca5a5", border: "rgba(239,68,68,.6)", bg: "rgba(69,10,10,.55)" }
      : { label: "⏳ Waiting for approval", color: "#fde68a", border: "rgba(250,204,21,.55)", bg: "rgba(66,52,4,.45)" };

  return (
    <div
      style={{
        ...card,
        borderColor: isNew ? status.border : "rgba(168,85,247,.35)",
        boxShadow: isNew ? `0 0 22px ${status.border}` : card.boxShadow,
      }}
    >
      <div style={{ ...cardHead, marginBottom: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ ...reqName, fontSize: 24 }}>
            <span style={runTitle}>{first?.title || "Run request"}</span>
            {isNew && <span style={{ ...rolePill, color: "#fff", borderColor: "#fff" }}>NEW</span>}
          </div>
          <div style={reqMeta}>
            Sent {timeAgo(request.created_at)} • {runs.length} run{runs.length === 1 ? "" : "s"}
          </div>
        </div>

        <span
          style={{
            ...countPill,
            color: status.color,
            borderColor: status.border,
            background: status.bg,
          }}
        >
          {status.label}
        </span>
      </div>

      {request.status === "declined" && (
        <div style={reasonBox}>
          <div style={infoLabel}>Reason</div>
          <div style={{ ...infoValue, color: "#fecaca" }}>
            {request.decline_reason?.trim() || "No reason given."}
          </div>
        </div>
      )}

      {request.status === "approved" && (
        <div style={{ ...reasonBox, borderColor: "rgba(34,197,94,.4)", background: "rgba(5,46,22,.35)" }}>
          <div style={{ ...infoValue, color: "#bbf7d0" }}>
            {request.approved_count && request.approved_count < runs.length
              ? `${request.approved_count} of ${runs.length} runs were approved and are now on the sign-up page.`
              : "Your runs are now on the sign-up page."}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
        {runs.map((run, i) => (
          <div key={i} style={{ ...runRow, gridTemplateColumns: "70px 140px 150px 110px", cursor: "default" }}>
            <span style={{ color: "#facc15", fontWeight: 900 }}>W{run.week}</span>
            <span>{run.day}</span>
            <span>{formatYmd(run.run_date)}</span>
            <span style={{ color: "#facc15", fontWeight: 900 }}>{run.time}</span>
          </div>
        ))}
      </div>

      {request.status !== "pending" && request.reviewed_by && (
        <div style={{ ...hint, marginTop: 10 }}>
          {request.status === "approved" ? "Approved" : "Declined"} by {request.reviewed_by}
          {request.reviewed_at ? ` • ${timeAgo(request.reviewed_at)}` : ""}
        </div>
      )}
    </div>
  );
}

/* ==============================
   Helpers
============================== */
function formatYmd(ymd?: string) {
  if (!ymd) return "—";
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function timeAgo(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ==============================
   Styles
============================== */
const floatBtn: React.CSSProperties = {
  position: "fixed",
  left: 24,
  bottom: 255, // sits above 📊 (180) and ❤️
  width: 62,
  height: 62,
  borderRadius: "50%",
  border: "1px solid rgba(250,204,21,.75)",
  background: "linear-gradient(135deg,#78350f,#ca8a04)",
  color: "white",
  fontSize: 26,
  cursor: "pointer",
  zIndex: 999,
  boxShadow: "0 0 18px rgba(250,204,21,.55)",
};

const badge: React.CSSProperties = {
  position: "absolute",
  top: -4,
  right: -4,
  minWidth: 24,
  height: 24,
  padding: "0 6px",
  borderRadius: 999,
  background: "#ef4444",
  border: "2px solid #12001f",
  color: "#fff",
  fontSize: 13,
  fontWeight: 900,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,.72)",
  backdropFilter: "blur(8px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  zIndex: 999999,
};

const panel: React.CSSProperties = {
  width: "min(1500px, 96vw)",
  maxHeight: "92vh",
  display: "flex",
  flexDirection: "column",
  borderRadius: 26,
  border: "1px solid rgba(250,204,21,.45)",
  background:
    "radial-gradient(circle at 50% 0%, rgba(250,204,21,.10), transparent 50%), linear-gradient(180deg, rgba(14,6,26,.99), rgba(4,0,12,.99))",
  boxShadow: "0 0 60px rgba(250,204,21,.22), 0 0 40px rgba(168,85,247,.25)",
  overflow: "hidden",
  minHeight: "62vh",
};

const head: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "26px 34px",
  borderBottom: "1px solid rgba(250,204,21,.2)",
};

const headTitle: React.CSSProperties = {
  fontSize: 44,
  fontWeight: 900,
  color: "#fff7cc",
  fontFamily: "Georgia, serif",
  textShadow: "0 0 18px rgba(250,204,21,.45)",
};

const headSub: React.CSSProperties = {
  marginTop: 6,
  color: "#c4b5fd",
  fontWeight: 800,
  fontSize: 19,
};

const closeBtn: React.CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: 14,
  border: "1px solid rgba(239,68,68,.45)",
  background: "linear-gradient(180deg,#7f1d1d,#450a0a)",
  color: "#fff",
  fontSize: 22,
  fontWeight: 900,
  cursor: "pointer",
};

const body: React.CSSProperties = {
  padding: "26px 34px 32px",
  overflowY: "auto",
  display: "grid",
  gap: 24,
};

const empty: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 12,
  padding: "90px 0",
  color: "#a99cc6",
  fontSize: 19,
};

const card: React.CSSProperties = {
  padding: 28,
  borderRadius: 20,
  border: "1px solid rgba(168,85,247,.35)",
  background: "linear-gradient(180deg, rgba(40,14,70,.55), rgba(10,4,24,.75))",
  boxShadow: "inset 0 0 22px rgba(168,85,247,.08)",
};

const cardHead: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 18,
  marginBottom: 20,
};

const avatar: React.CSSProperties = {
  width: 68,
  height: 68,
  borderRadius: "50%",
  objectFit: "cover",
  border: "2px solid rgba(168,85,247,.8)",
  boxShadow: "0 0 14px rgba(168,85,247,.45)",
  flexShrink: 0,
};

const reqName: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  color: "#f5d0fe",
  fontSize: 26,
  fontWeight: 900,
};

const rolePill: React.CSSProperties = {
  padding: "4px 12px",
  borderRadius: 999,
  border: "1px solid rgba(250,204,21,.55)",
  color: "#fde68a",
  fontSize: 14,
  fontWeight: 900,
  letterSpacing: 1,
  textTransform: "uppercase",
};

const reqMeta: React.CSSProperties = {
  marginTop: 6,
  color: "#a99cc6",
  fontSize: 17,
  fontWeight: 700,
};

const countPill: React.CSSProperties = {
  padding: "10px 20px",
  borderRadius: 999,
  background: "rgba(250,204,21,.12)",
  border: "1px solid rgba(250,204,21,.5)",
  color: "#facc15",
  fontWeight: 900,
  fontSize: 19,
  whiteSpace: "nowrap",
};

const infoGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "18px 26px",
  padding: 22,
  marginBottom: 18,
  borderRadius: 14,
  background: "rgba(0,0,0,.3)",
  border: "1px solid rgba(168,85,247,.2)",
};

const infoLabel: React.CSSProperties = {
  color: "#9d8ec2",
  fontSize: 14,
  fontWeight: 900,
  letterSpacing: 1,
  textTransform: "uppercase",
  marginBottom: 6,
};

const infoValue: React.CSSProperties = {
  color: "#fff",
  fontSize: 20,
  fontWeight: 800,
  wordBreak: "break-word",
  whiteSpace: "pre-line",
};

const dot: React.CSSProperties = {
  width: 15,
  height: 15,
  borderRadius: "50%",
  display: "inline-block",
};

const tableHead: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "34px 70px 140px 150px 110px minmax(0, 1fr)",
  gap: 14,
  padding: "0 18px 8px",
  color: "#9d8ec2",
  fontSize: 14,
  fontWeight: 900,
  letterSpacing: 1,
  textTransform: "uppercase",
};

const runRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "34px 70px 140px 150px 110px minmax(0, 1fr)",
  gap: 14,
  alignItems: "center",
  padding: "14px 18px",
  borderRadius: 12,
  background: "rgba(255,255,255,.04)",
  border: "1px solid rgba(168,85,247,.18)",
  color: "#e9d5ff",
  fontSize: 19,
  fontWeight: 700,
  cursor: "pointer",
};

const runTitle: React.CSSProperties = {
  color: "#fff",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const hint: React.CSSProperties = {
  marginTop: 10,
  color: "#8b7bb0",
  fontSize: 15,
  fontWeight: 700,
};

const reasonBox: React.CSSProperties = {
  padding: "16px 18px",
  borderRadius: 11,
  border: "1px solid rgba(239,68,68,.45)",
  background: "rgba(70,0,0,.35)",
};

const errorBox: React.CSSProperties = {
  marginTop: 12,
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(239,68,68,.45)",
  background: "rgba(70,0,0,.35)",
  color: "#fecaca",
  fontWeight: 700,
  fontSize: 17,
};

const actions: React.CSSProperties = {
  display: "flex",
  gap: 14,
  justifyContent: "flex-end",
  alignItems: "center",
  marginTop: 22,
};

const reasonInput: React.CSSProperties = {
  flex: 1,
  height: 56,
  padding: "0 18px",
  borderRadius: 11,
  border: "1px solid rgba(239,68,68,.45)",
  background: "rgba(0,0,0,.5)",
  color: "#fff",
  fontSize: 18,
  fontWeight: 700,
  outline: "none",
};

const approveBtn: React.CSSProperties = {
  height: 56,
  padding: "0 34px",
  borderRadius: 11,
  border: "1px solid rgba(134,239,172,.6)",
  background: "linear-gradient(90deg,#15803d,#22c55e)",
  color: "#fff",
  fontSize: 19,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 0 18px rgba(34,197,94,.45)",
};

const declineBtn: React.CSSProperties = {
  height: 56,
  padding: "0 28px",
  borderRadius: 11,
  border: "1px solid rgba(239,68,68,.6)",
  background: "rgba(80,8,8,.7)",
  color: "#fecaca",
  fontSize: 19,
  fontWeight: 900,
  cursor: "pointer",
};

const ghostBtn: React.CSSProperties = {
  height: 56,
  padding: "0 24px",
  borderRadius: 11,
  border: "1px solid rgba(255,255,255,.2)",
  background: "rgba(255,255,255,.06)",
  color: "#fff",
  fontSize: 18,
  fontWeight: 900,
  cursor: "pointer",
};
