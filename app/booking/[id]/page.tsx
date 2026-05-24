"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";


type Buyer = {
  id: number;
  slot: number;
  clientName: string;
  clientServer: string;
  raiderIo: string;
  wowClass: string;
  raids: string;
  depositMethod: string;
  pot: string;
  deposit: string;
  owes: string;
  paidFull: boolean;
  collectedBy: string;
  discordUser?: string;
  discordId?: string;
  inGroup: boolean;
  note: string;
  ignored?: boolean;
};

type FormState = {
  clientName: string;
  clientServer: string;
  raiderIo: string;
  wowClass: string;
  depositMethod: string;
  pot: string;
  deposit: string;
  owes: string;
  paidFull: string;
  raids: string[];
  publicNote: string;
  privateNote: string;
};

const emptyForm: FormState = {
  clientName: "",
  clientServer: "",
  raiderIo: "",
  wowClass: "",
  depositMethod: "Select method",
  pot: "",
  deposit: "",
  owes: "",
  paidFull: "No",
  raids: [],
  publicNote: "",
  privateNote: "",
};

export default function BookingDetailsPage() {
    const params = useParams();
const runId = String(params.id);
const [discordUser, setDiscordUser] = useState("");
const [discordId, setDiscordId] = useState("");
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [slotModalOpen, setSlotModalOpen] = useState(false);
const [slotInput, setSlotInput] = useState("4");
const [loaded, setLoaded] = useState(false);
const [settingsLoaded, setSettingsLoaded] = useState(false);
const [form, setForm] = useState<FormState>(emptyForm);
const [editingId, setEditingId] = useState<number | null>(null);
const [locked, setLocked] = useState(true);
const [buyerSlotLimit, setBuyerSlotLimit] = useState(4);
const [classLoading, setClassLoading] = useState(false);
const [announcementText, setAnnouncementText] = useState(
  "VIP - One of each Armor & Tier!"
);
const [deleteTarget, setDeleteTarget] = useState<Buyer | null>(null);
const [noticeText, setNoticeText] = useState<string | null>(null);
useEffect(() => {
  async function loadUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    setDiscordId(user.id);

    setDiscordUser(
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.user_metadata?.preferred_username ||
      "Unknown"
    );
  }

  loadUser();
}, []);

useEffect(() => {
  const saved = localStorage.getItem(`booking-buyers-${runId}`);

  if (saved) {
    setBuyers(JSON.parse(saved));
  }

  setLoaded(true);
}, [runId]);

useEffect(() => {
  const savedSlots = localStorage.getItem(`booking-slots-${runId}`);
  const savedLocked = localStorage.getItem(`booking-locked-${runId}`);

  if (savedSlots) {
    setBuyerSlotLimit(Number(savedSlots));
    setSlotInput(savedSlots);
  }

  if (savedLocked) {
    setLocked(savedLocked === "true");
  }

  setSettingsLoaded(true);
}, [runId]);

useEffect(() => {
  if (!settingsLoaded) return;

  localStorage.setItem(
    `booking-slots-${runId}`,
    String(buyerSlotLimit)
  );

  window.dispatchEvent(new Event("bookingUpdated"));
}, [buyerSlotLimit, runId, settingsLoaded]);

useEffect(() => {
  if (!settingsLoaded) return;

  localStorage.setItem(
    `booking-locked-${runId}`,
    String(locked)
  );

  window.dispatchEvent(new Event("bookingUpdated"));
}, [locked, runId, settingsLoaded]);

useEffect(() => {
  if (!loaded) return;

  localStorage.setItem(
    `booking-buyers-${runId}`,
    JSON.stringify(buyers)
  );

  window.dispatchEvent(new Event("bookingUpdated"));
}, [buyers, runId, loaded]);

  const activeBuyers = buyers.filter((b) => !b.ignored);

useEffect(() => {
  const name = form.clientName.trim();
  const realm = form.clientServer.trim();

  if (!name || !realm) {
    updateForm("wowClass", "");
    return;
  }

  const timer = setTimeout(async () => {
    try {
      setClassLoading(true);

      const res = await fetch(
        `https://raider.io/api/v1/characters/profile?region=eu&realm=${realm}&name=${name}&fields=gear`
      );

      const data = await res.json();

      if (data?.class) {
        updateForm("wowClass", data.class);
      }
    } catch (err) {
      console.error("Failed to fetch Raider.IO class", err);
    } finally {
      setClassLoading(false);
    }
  }, 700);

  return () => clearTimeout(timer);
}, [form.clientName, form.clientServer]);
  const armorBooked = useMemo(() => {
    return {
      cloth: activeBuyers.filter((b) =>
        ["Priest", "Mage", "Warlock"].includes(b.wowClass)
      ).length,
      leather: activeBuyers.filter((b) =>
        ["Demon Hunter", "Rogue", "Druid", "Monk"].includes(b.wowClass)
      ).length,
      mail: activeBuyers.filter((b) =>
        ["Hunter", "Shaman", "Evoker"].includes(b.wowClass)
      ).length,
      plate: activeBuyers.filter((b) =>
        ["Paladin", "Warrior", "Death Knight"].includes(b.wowClass)
      ).length,
    };
  }, [activeBuyers]);

  function updateForm(key: keyof FormState, value: string | string[]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleRaid(raid: string) {
    setForm((prev) => ({
      ...prev,
      raids: prev.raids.includes(raid)
        ? prev.raids.filter((r) => r !== raid)
        : [...prev.raids, raid],
    }));
  }

function handleAddOrUpdateBuyer() {
  if (!form.clientName.trim()) {
    setNoticeText("Client name is required.");
    return;
  }

  if (!form.clientServer.trim()) {
    setNoticeText("Client server is required.");
    return;
  }

  if (!form.wowClass.trim()) {
    setNoticeText("Class not found. Check client name and server.");
    return;
  }

  if (form.depositMethod === "Select method") {
    setNoticeText("Select deposit method.");
    return;
  }

    if (editingId) {
      setBuyers((prev) =>
        prev.map((b) =>
          b.id === editingId
            ? {
                ...b,
                clientName: form.clientName,
                clientServer: form.clientServer,
                raiderIo: form.raiderIo || b.raiderIo,
                wowClass: form.wowClass,
                depositMethod: form.depositMethod,
                pot: form.pot || "0k",
                deposit: form.deposit || "0k",
                owes: form.owes || "0k",
                paidFull: form.paidFull === "Yes",
                raids: form.raids.length ? form.raids.join(", ") : "-",
                note: form.privateNote || form.publicNote || "-",
              }
            : b
        )
      );

      setEditingId(null);
      setForm(emptyForm);
      return;
    }

    if (activeBuyers.length >= buyerSlotLimit) {
      alert("This run is full.");
      return;
    }

    const newBuyer: Buyer = {
      id: Date.now(),
      slot: buyers.length + 1,
      clientName: form.clientName,
      clientServer: form.clientServer,
      raiderIo: form.raiderIo || "#",
      wowClass: form.wowClass,
      raids: form.raids.length ? form.raids.join(", ") : "-",
      depositMethod: form.depositMethod,
      pot: form.pot || "0k",
      deposit: form.deposit || "0k",
      owes: form.owes || "0k",
      paidFull: form.paidFull === "Yes",
discordId: discordId,
discordUser: discordUser,
collectedBy: discordUser,
      inGroup: false,
      note: form.privateNote || form.publicNote || "-",
    };

    setBuyers((prev) => [...prev, newBuyer]);
    setForm(emptyForm);
  }

  function editBuyer(buyer: Buyer) {
    setEditingId(buyer.id);
    setForm({
      clientName: buyer.clientName,
      clientServer: buyer.clientServer,
      raiderIo: buyer.raiderIo,
      wowClass: buyer.wowClass,
      depositMethod: buyer.depositMethod,
      pot: buyer.pot,
      deposit: buyer.deposit,
      owes: buyer.owes,
      paidFull: buyer.paidFull ? "Yes" : "No",
      raids: buyer.raids === "-" ? [] : buyer.raids.split(",").map((r) => r.trim()),
      publicNote: "",
      privateNote: buyer.note === "-" ? "" : buyer.note,
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }
function deleteBuyer(id: number) {
  setBuyers((prev) =>
    prev
      .filter((b) => b.id !== id)
      .map((b, index) => ({ ...b, slot: index + 1 }))
  );
}

  function ignoreBuyer(id: number) {
    setBuyers((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ignored: !b.ignored } : b))
    );
  }

function changeSlots() {
  setSlotInput(String(buyerSlotLimit));
  setSlotModalOpen(true);
}

function saveSlots() {
  const parsed = Number(slotInput);

  if (Number.isNaN(parsed) || parsed < 1) {
    setNoticeText("Enter a valid slot number.");
    return;
  }

  setBuyerSlotLimit(parsed);
  setSlotModalOpen(false);
}

  function changeAnnouncement() {
    const text = prompt("Raid announcement:", announcementText);
    if (!text) return;
    setAnnouncementText(text);
  }
function togglePaid(id: number) {
  setBuyers((prev) =>
    prev.map((b) =>
      b.id === id ? { ...b, paidFull: !b.paidFull } : b
    )
  );
}

function toggleCollectedDeposit(id: number) {
  setBuyers((prev) =>
    prev.map((b) =>
      b.id === id ? { ...b, inGroup: !b.inGroup } : b
    )
  );
}
  return (
    <div style={page}>
      <Link href="/booking" style={backBtn}>
        ← Back to Booking
      </Link>

      <div style={header}>
        <h1 style={pageTitle}>Raid Bookings</h1>
        <div style={titleLine} />
      </div>

      <div style={marketNotice}>
        <span style={blue}>ℹ</span> Our listed prices are based on{" "}
        <span style={gold}>64%</span> of market value.
        <br />
       <span style={green}>Only People in the team can book</span> 
      </div>

      <div style={topGrid}>
        <section style={card}>
          <h2 style={cardTitle}>ⓘ Raid Info</h2>

          <img src="/bg.png" alt="Raid" style={raidImage} />

          <h3 style={raidTitle}>Heroic All 3 Raids - 15/05 @ 12:00</h3>

          <Info label="Raid ID" value="6a20a8a00e3e2128dc67587 ⧉" />
          <Info label="Difficulty" value="Heroic" red />
          <Info label="Run Type" value="Raid" />
          <Info label="Group Type" value="9/9" />
          <Info label="Loot Type" value="💎 VIP 💎" />
          <Info
            label="Booked Buyers"
            value={`${activeBuyers.length} / ${buyerSlotLimit}`}
            red={activeBuyers.length >= buyerSlotLimit}
            purple={activeBuyers.length < buyerSlotLimit}
          />
          <Info label="Leader" value="Koyjin" purple />
          <Info label="Gold Collector" value="Koyjin" purple />
          <Info
            label="Status"
            value={locked ? "Locked" : "Active"}
            red={locked}
            purple={!locked}
          />

          <div style={divider} />

          <Info label="Actual Pot" value="3730k" />
          <Info label="Collected by you" value="790k" />
        </section>

        <section style={card}>
          <h2 style={cardTitle}>{editingId ? "✎ Edit Buyer" : "👤 Add Buyer"}</h2>

          <div style={formGrid}>
            <Input
              label="Client Name *"
              placeholder="Enter client name"
              value={form.clientName}
              onChange={(v) => updateForm("clientName", v)}
            />

            <Input
              label="Client Server *"
              placeholder="Enter client server"
              value={form.clientServer}
              onChange={(v) => updateForm("clientServer", v)}
            />

<div>
  <label style={label}>Class</label>

  <div
    style={{
      ...input,
      display: "flex",
      alignItems: "center",

      color:
        form.wowClass === "Paladin"
          ? "#ff7bc3"
          : form.wowClass === "Hunter"
          ? "#8fff00"
          : form.wowClass === "Priest"
          ? "#ffffff"
          : form.wowClass === "Demon Hunter"
          ? "#a335ee"
          : form.wowClass === "Warrior"
          ? "#c79c6e"
          : form.wowClass === "Mage"
          ? "#69ccf0"
          : form.wowClass === "Rogue"
          ? "#fff569"
          : form.wowClass === "Warlock"
          ? "#9482c9"
          : form.wowClass === "Druid"
          ? "#ff7d0a"
          : form.wowClass === "Shaman"
          ? "#0070de"
          : form.wowClass === "Death Knight"
          ? "#c41f3b"
          : form.wowClass === "Monk"
          ? "#00ff96"
          : form.wowClass === "Evoker"
          ? "#33937f"
          : "#9ca3af",

      fontWeight: 900,
      background: "rgba(91,33,182,0.15)",
      border: "1px solid rgba(168,85,247,0.35)",

      textShadow:
        form.wowClass === "Paladin"
          ? "0 0 12px #ff7bc3"
          : form.wowClass === "Hunter"
          ? "0 0 12px #8fff00"
          : form.wowClass === "Priest"
          ? "0 0 12px #ffffff"
          : form.wowClass === "Demon Hunter"
          ? "0 0 12px #a335ee"
          : "0 0 12px rgba(255,255,255,0.25)",
    }}
  >
    {classLoading
      ? "Searching Raider.IO..."
      : form.wowClass || "Type client name and server"}
  </div>
</div>

            <Select
              label="Deposit Method *"
              value={form.depositMethod}
              onChange={(v) => updateForm("depositMethod", v)}
              options={["Select method", "Trade", "Balance deduction"]}
            />

     <Input
  label="Pot *"
  placeholder="0"
  value={form.pot}
  onChange={(v) => {
    updateForm("pot", v);

    const pot = Number(v) || 0;

    const deposit = Math.floor(pot * 0.3);
    const owes = Math.floor(pot * 0.7);

    updateForm("deposit", String(deposit));
    updateForm("owes", String(owes));
  }}
/>

<Input
  label="Deposit *"
  placeholder="0"
  value={form.deposit}
  onChange={(v) => {
    updateForm("deposit", v);

    const pot = Number(form.pot) || 0;
    const deposit = Number(v) || 0;

    const owes = pot - deposit;

    updateForm("owes", String(owes > 0 ? owes : 0));
  }}
/>

            <Input
              label="Owes *"
              placeholder="0"
              value={form.owes}
              onChange={(v) => updateForm("owes", v)}
            />

            <Select
              label="Paid Full *"
              value={form.paidFull}
              onChange={(v) => updateForm("paidFull", v)}
              options={["No", "Yes"]}
            />

            <div style={{ gridColumn: "1 / span 2" }}>
              <label style={label}>Raids *</label>

              <div style={checkWrap}>
                {["Voidspire", "Dreamrift", "Quel'Danas"].map((raid) => (
                  <label key={raid}>
                    <input
                      type="checkbox"
                      checked={form.raids.includes(raid)}
                      onChange={() => toggleRaid(raid)}
                    />{" "}
                    {raid}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ gridColumn: "1 / span 2" }}>
              <input
                style={input}
                placeholder="Public Note (Warning: everyone can see this!)"
                value={form.publicNote}
                onChange={(e) => updateForm("publicNote", e.target.value)}
              />
            </div>

            <div style={{ gridColumn: "1 / span 2" }}>
              <input
                style={input}
                placeholder="Private Note"
                value={form.privateNote}
                onChange={(e) => updateForm("privateNote", e.target.value)}
              />
            </div>
          </div>

          <button
            style={addBuyerBtn}
            onMouseEnter={(e) => glow(e, "purple")}
            onMouseLeave={(e) => unGlow(e, addBuyerBtn.boxShadow as string)}
            onClick={handleAddOrUpdateBuyer}
          >
            {editingId ? "✓ Save Changes" : "＋ Add Buyer"}
          </button>

          {editingId && (
            <button
              style={cancelBtn}
              onMouseEnter={(e) => glow(e, "red")}
              onMouseLeave={(e) => unGlow(e, cancelBtn.boxShadow as string)}
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
              }}
            >
              Cancel Edit
            </button>
          )}
        </section>

        <section style={card}>
          <h2 style={cardTitle}>⚔ Raid Tools</h2>

          <button
            style={toolBtn}
            onMouseEnter={(e) => glow(e, "purple")}
            onMouseLeave={(e) => unGlow(e, toolBtn.boxShadow as string)}
            onClick={() => setLocked((prev) => !prev)}
          >
            {locked ? "🔓 Unlock Raid" : "🔒 Lock Raid"}
          </button>

          <button
            style={toolBtn}
            onMouseEnter={(e) => glow(e, "purple")}
            onMouseLeave={(e) => unGlow(e, toolBtn.boxShadow as string)}
            onClick={changeSlots}
          >
            👥 Change Slots
          </button>

          <button
            style={toolBtn}
            onMouseEnter={(e) => glow(e, "purple")}
            onMouseLeave={(e) => unGlow(e, toolBtn.boxShadow as string)}
            onClick={changeAnnouncement}
          >
            📣 Announcement
          </button>
        </section>
      </div>

      <div style={announcement}>
        📣 Raid Announcement: <span style={gold}>VIP</span> - {announcementText}
      </div>

<div
  style={{
    display: "flex",
    justifyContent: "center",
    margin: "0 auto 16px",
  }}
>
<div style={armorBookedBox}>
  Armor Booked: <span style={green}>Cloth: {armorBooked.cloth}</span> /{" "}
  <span style={blue}>Leather: {armorBooked.leather}</span> /{" "}
  <span style={green}>Mail: {armorBooked.mail}</span> /{" "}
  <span style={purpleText}>Plate: {armorBooked.plate}</span>
</div>
</div>

<section style={tableCard}>
        <div style={tableToolbar}>⌕ &nbsp;&nbsp;▦ &nbsp;&nbsp;☰</div>

        <div style={tableHead}>
          <div>Slot</div>
          <div>Client Name</div>
          <div>Client Server</div>
          <div>Raider.IO</div>
          <div>Class</div>
          <div>Raids</div>
          <div>Deposit Method</div>
          <div>Pot</div>
          <div>Deposit</div>
          <div>Owes</div>
          <div>Paid</div>
          <div>Collector</div>
          <div>Collected Deposit</div>
          <div>Note</div>
          <div>Actions</div>
        </div>

        {buyers.map((buyer) => (
          <div
            key={buyer.id}
            style={{
              ...tableRow,
              opacity: buyer.ignored ? 0.35 : 1,
              textDecoration: buyer.ignored ? "line-through" : "none",
            }}
          >
            <div>{buyer.slot}</div>
            <div>{buyer.clientName}</div>
            <div style={green}>{buyer.clientServer}</div>

            <div>
              <a href={buyer.raiderIo} target="_blank" rel="noreferrer" style={ioLink}>
                IO Link ↗
              </a>
            </div>

            <div>
              <span style={classBadge(buyer.wowClass)}>{buyer.wowClass}</span>
            </div>

            <div>{buyer.raids}</div>

            <div style={buyer.depositMethod === "Trade" ? blue : gold}>
              {buyer.depositMethod}
            </div>

            <div>{buyer.pot}</div>
            <div>{buyer.deposit}</div>
            <div>{buyer.owes}</div>

<button
  style={buyer.paidFull ? tickBtn : xBtn}
  onClick={() => togglePaid(buyer.id)}
>
  {buyer.paidFull ? "✓" : "×"}
</button>

<div
  style={{
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
  }}
>
  <a
    href={`discord://-/users/${buyer.discordId}`}
    target="_blank"
    rel="noopener noreferrer"
    style={{
      color: "#8b5cf6",
      fontWeight: 900,
      textDecoration: "none",
      display: "flex",
      alignItems: "center",
      gap: "6px",
      textShadow: "0 0 10px rgba(168,85,247,0.7)",
      fontSize: 11,
    }}
  >
    @{buyer.discordUser || "discord"}
    <span style={{ color: "#a855f7", fontSize: 12 }}>⤴</span>
  </a>
</div>

<button
  style={buyer.inGroup ? tickBtn : xBtn}
  disabled={buyer.discordUser !== discordUser}
  onClick={() => toggleCollectedDeposit(buyer.id)}
  title={
    buyer.discordUser === discordUser
      ? "Toggle collected deposit"
      : "Only the collector can change this"
  }
>
  {buyer.inGroup ? "✓" : "×"}
</button>

            <div>{buyer.note}</div>

            <div style={actionWrap}>
              <button
                title="Edit client"
                style={editAction}
                onMouseEnter={(e) => glow(e, "blue")}
                onMouseLeave={(e) => unGlow(e, editAction.boxShadow as string)}
                onClick={() => editBuyer(buyer)}
              >
                ✎
              </button>

              <button
                title="Ignore client"
                style={ignoreAction}
                onMouseEnter={(e) => glow(e, "gold")}
                onMouseLeave={(e) => unGlow(e, ignoreAction.boxShadow as string)}
                onClick={() => ignoreBuyer(buyer.id)}
              >
                ⊘
              </button>

              <button
                title="Delete client"
                style={deleteAction}
                onMouseEnter={(e) => glow(e, "red")}
                onMouseLeave={(e) => unGlow(e, deleteAction.boxShadow as string)}
                onClick={() => setDeleteTarget(buyer)}
              >
                🗑
              </button>
            </div>
          </div>
        ))}

        <div style={tableFooter}>
          Showing 1 to {buyers.length} of {buyers.length} entries
        </div>
      </section>
      {deleteTarget && (
  <div style={modalOverlay}>
    <div style={deleteModal}>
      <div style={skullIcon}>☠</div>

      <h2 style={modalTitle}>Delete Client</h2>

      <p style={modalText}>
        This action <span style={redText}>cannot be undone</span>. This will
        permanently delete this client from the booking.
      </p>

      <div style={clientPreview}>
        <div style={avatarCircle}>👤</div>

        <div>
          <div style={clientNameBig}>{deleteTarget.clientName}</div>

          <div style={clientMeta}>
            <div>
              <span style={metaLabel}>CLASS</span>
              <b style={green}>{deleteTarget.wowClass}</b>
            </div>

            <div>
              <span style={metaLabel}>SERVER</span>
              <b>{deleteTarget.clientServer}</b>
            </div>

            <div>
              <span style={metaLabel}>RAIDER.IO</span>
              <a href={deleteTarget.raiderIo} target="_blank" style={ioLink}>
                IO Link ↗
              </a>
            </div>
          </div>
        </div>
      </div>

      <div style={warningBox}>
        <b style={redText}>⚠ Warning: This will permanently delete:</b>

        <div style={warningGrid}>
          <span>• Client profile</span>
          <span>• Booking history</span>
          <span>• Private notes</span>
          <span>• Payments & deposits</span>
        </div>
      </div>

      <div style={modalActions}>
<button
  style={cancelModalBtn}
  onMouseEnter={(e) => glow(e, "purple")}
  onMouseLeave={(e) => unGlow(e, cancelModalBtn.boxShadow as string)}
  onClick={() => setDeleteTarget(null)}
>
  ✕ Cancel
</button>

<button
  style={deleteModalBtn}
  onMouseEnter={(e) => glow(e, "red")}
  onMouseLeave={(e) => unGlow(e, deleteModalBtn.boxShadow as string)}
  onClick={() => {
    deleteBuyer(deleteTarget.id);
    setDeleteTarget(null);
  }}
>
  🗑 Delete Client
</button>
      </div>
    </div>
  </div>
)}

{noticeText && (
  <div style={modalOverlay}>
    <div style={deleteModal}>
      <div style={skullIcon}>☠</div>

      <h2 style={modalTitle}>Missing Information</h2>

      <p style={modalText}>{noticeText}</p>

      <div style={modalActions}>
        <button
          style={cancelModalBtn}
          onClick={() => setNoticeText(null)}
        >
          OK
        </button>
      </div>
    </div>
  </div>
)}
{slotModalOpen && (
  <div style={modalOverlay}>
    <div style={deleteModal}>
      <div style={skullIcon}>👥</div>

      <h2 style={modalTitle}>Change Buyer Slots</h2>

      <p style={modalText}>Enter total buyer slots for this run.</p>

      <input
        style={{
          ...input,
          width: 260,
          height: 46,
          textAlign: "center",
          fontSize: 22,
          fontWeight: 900,
          margin: "10px auto",
        }}
        value={slotInput}
        onChange={(e) => setSlotInput(e.target.value)}
      />

      <div style={modalActions}>
        <button style={cancelModalBtn} onClick={() => setSlotModalOpen(false)}>
          ✕ Cancel
        </button>

        <button style={deleteModalBtn} onClick={saveSlots}>
          ✓ Save Slots
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
}

function glow(
  e: React.MouseEvent<HTMLButtonElement>,
  color: "purple" | "red" | "blue" | "gold"
) {
  const shadows = {
    purple: "0 0 26px rgba(217,70,239,0.75)",
    red: "0 0 24px rgba(239,68,68,0.75)",
    blue: "0 0 24px rgba(59,130,246,0.75)",
    gold: "0 0 24px rgba(245,158,11,0.75)",
  };

  e.currentTarget.style.transform = "translateY(-2px) scale(1.04)";
  e.currentTarget.style.boxShadow = shadows[color];
}

function unGlow(e: React.MouseEvent<HTMLButtonElement>, shadow: string) {
  e.currentTarget.style.transform = "translateY(0) scale(1)";
  e.currentTarget.style.boxShadow = shadow;
}

function Info({
  label,
  value,
  red,
  purple,
}: {
  label: string;
  value: string;
  red?: boolean;
  purple?: boolean;
}) {
  return (
    <div style={infoLine}>
      <span style={infoLabel}>{label}:</span>
      <span style={red ? redText : purple ? purpleText : infoValue}>{value}</span>
    </div>
  );
}

function Input({
  label: labelText,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label style={label}>{labelText}</label>
      <input
        style={input}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}



function Select({
  label: labelText,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    
    <div>
      <label style={label}>{labelText}</label>

      <select
        style={input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
      
    </div>
    
  );
}

function classBadge(name: string): React.CSSProperties {
  const bg =
    name === "Demon Hunter"
      ? "#7c3aed"
      : name === "Hunter"
      ? "#84cc16"
      : name === "Paladin"
      ? "#ec4899"
      : name === "Priest"
      ? "#f8fafc"
      : name === "Mage"
      ? "#38bdf8"
      : name === "Warlock"
      ? "#7e22ce"
      : name === "Druid"
      ? "#f97316"
      : name === "Monk"
      ? "#10b981"
      : name === "Shaman"
      ? "#2563eb"
      : name === "Evoker"
      ? "#22c55e"
      : name === "Warrior"
      ? "#a16207"
      : name === "Death Knight"
      ? "#dc2626"
      : "#9333ea";

  return {
    display: "inline-block",
    width: 110,
    padding: "6px 8px",
    borderRadius: 7,
    background: bg,
    color: name === "Priest" || name === "Hunter" ? "#111827" : "white",
    fontWeight: 900,
    textAlign: "center",
    fontSize: 12,
  };
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  color: "white",
  padding: "18px 24px 28px",
  background:
    "linear-gradient(rgba(2,6,16,0.58), rgba(0,0,0,0.84)), url('/bg.png') center top / cover no-repeat fixed",
};

const backBtn: React.CSSProperties = {
  display: "inline-block",
  color: "#f5d0fe",
  textDecoration: "none",
  border: "1px solid rgba(168,85,247,0.45)",
  background: "rgba(0,0,0,0.38)",
  padding: "8px 14px",
  borderRadius: 8,
  fontWeight: 900,
  marginBottom: 8,
};

const header: React.CSSProperties = {
  textAlign: "center",
};

const pageTitle: React.CSSProperties = {
  fontSize: 46,
  fontWeight: 900,
  margin: 0,
};

const titleLine: React.CSSProperties = {
  width: 180,
  height: 2,
  margin: "8px auto 10px",
  background:
    "linear-gradient(90deg, transparent, #d946ef, transparent)",
};

const marketNotice: React.CSSProperties = {
  width: "fit-content",
  maxWidth: 700,
  margin: "0 auto 18px",
  padding: "10px 20px",
  textAlign: "center",
  borderRadius: 12,
  background: "rgba(7,10,24,0.92)",
  border: "1px solid rgba(168,85,247,0.45)",
  fontSize: 14,
  lineHeight: 1.5,
};

const topGrid: React.CSSProperties = {
    maxWidth: 1850,
  margin: "0 auto",
  display: "grid",
  gridTemplateColumns: "430px 1fr 320px",
  gap: 14,
};

const card: React.CSSProperties = {
  background:
    "linear-gradient(180deg, rgba(8,13,26,0.93), rgba(4,8,18,0.93))",
  border: "1px solid rgba(168,85,247,0.42)",
  borderRadius: 15,
  padding: 16,
};

const cardTitle: React.CSSProperties = {
  margin: "0 0 14px",
   fontSize: 26,
  fontWeight: 900,
  color: "#f5d0fe",
};

const raidImage: React.CSSProperties = {
  width: "100%",
  height: 78,
  objectFit: "cover",
  borderRadius: 9,
  marginBottom: 10,
};

const raidTitle: React.CSSProperties = {
  textAlign: "center",
  fontSize: 30,
  fontWeight: 900,
  margin: "8px 0 12px",
};

const infoLine: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
    fontSize: 15,
  marginBottom: 6,
};

const infoLabel: React.CSSProperties = {
  textAlign: "right",
  fontWeight: 900,
};

const infoValue: React.CSSProperties = {
  textAlign: "left",
  fontWeight: 800,
};

const divider: React.CSSProperties = {
  height: 1,
  background:
    "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)",
  margin: "12px 0",
};

const formGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "10px 14px",
};

const label: React.CSSProperties = {
  display: "block",
  color: "#d8b4fe",
  fontSize: 15,
  fontWeight: 900,
  marginBottom: 5,
};

const input: React.CSSProperties = {
  width: "100%",
  height: 48,
  fontSize: 16,
fontWeight: 700,
  borderRadius: 7,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(0,0,0,0.38)",
  color: "white",
  padding: "0 10px",
  outline: "none",
};

const checkWrap: React.CSSProperties = {
  display: "flex",
  gap: 18,
  fontSize: 12,
};

const addBuyerBtn: React.CSSProperties = {
  display: "block",
  width: 380,
  height: 60,
  fontSize: 18,
  margin: "16px auto 0",
  border: 0,
  borderRadius: 8,
  background: "linear-gradient(90deg,#6d28d9,#c026d3)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
  transition: "all 0.18s ease",
  boxShadow: "0 0 14px rgba(168,85,247,0.28)",
};

const cancelBtn: React.CSSProperties = {
  display: "block",
  width: 220,
  height: 36,
  margin: "10px auto 0",
  border: 0,
  borderRadius: 8,
  background: "linear-gradient(90deg,#7f1d1d,#dc2626)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
  transition: "all 0.18s ease",
  boxShadow: "0 0 12px rgba(239,68,68,0.24)",
};

const toolBtn: React.CSSProperties = {
  width: "100%",
  height: 62,
  marginBottom: 12,
  fontSize: 17,
  border: 0,
  borderRadius: 8,
  background: "linear-gradient(90deg,#6d28d9,#9333ea)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
  transition: "all 0.18s ease",
  boxShadow: "0 0 14px rgba(168,85,247,0.25)",
};

const announcement: React.CSSProperties = {
  maxWidth: 630,
  margin: "14px auto 8px",
  padding: "10px 16px",
  textAlign: "center",
  borderRadius: 9,
  background: "rgba(30,15,45,0.88)",
  border: "1px solid rgba(168,85,247,0.45)",
  fontSize: 18,
};

const armorBookedBox: React.CSSProperties = {
  width: "fit-content",
  minWidth: 430,
  margin: "0 auto 16px",
  padding: "8px 14px",
  textAlign: "center",
  borderRadius: 8,
  background: "rgba(0,0,0,0.36)",
  border: "1px solid rgba(168,85,247,0.35)",
  fontSize: 17,
  fontWeight: 900,
};

const tableCard: React.CSSProperties = {
  maxWidth: 1600,
  margin: "0 auto",
  borderRadius: 14,
  overflow: "hidden",
  background:
    "linear-gradient(180deg, rgba(8,13,26,0.95), rgba(4,8,18,0.93))",
  border: "1px solid rgba(168,85,247,0.42)",
};

const tableToolbar: React.CSSProperties = {
  height: 34,
  textAlign: "right",
  padding: "8px 16px",
  color: "#c084fc",
};

const tableHead: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "55px 110px 120px 100px 120px 220px 120px 60px 70px 60px 70px 100px 70px 90px 90px",
  background: "#020617",
  padding: "12px 0",
  fontSize: 15,
  fontWeight: 900,
  textAlign: "center",
};

const tableRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "55px 110px 120px 100px 120px 220px 120px 60px 70px 60px 70px 100px 70px 90px 90px",
  alignItems: "center",
  minHeight: 82,
  fontSize: 15,
  textAlign: "center",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
};

const actionWrap: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: 6,
};

const editAction: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 6,
  border: "1px solid rgba(59,130,246,0.4)",
  background: "rgba(59,130,246,0.14)",
  color: "#60a5fa",
  cursor: "pointer",
  transition: "all 0.18s ease",
  boxShadow: "0 0 8px rgba(59,130,246,0.16)",
};

const ignoreAction: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 6,
  border: "1px solid rgba(245,158,11,0.4)",
  background: "rgba(245,158,11,0.14)",
  color: "#f59e0b",
  cursor: "pointer",
  transition: "all 0.18s ease",
  boxShadow: "0 0 8px rgba(245,158,11,0.16)",
};

const deleteAction: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 6,
  border: "1px solid rgba(239,68,68,0.4)",
  background: "rgba(239,68,68,0.14)",
  color: "#ef4444",
  cursor: "pointer",
  transition: "all 0.18s ease",
  boxShadow: "0 0 8px rgba(239,68,68,0.16)",
};

const tableFooter: React.CSSProperties = {
  textAlign: "center",
  padding: "12px",
  color: "#9ca3af",
  fontSize: 12,
};

const green: React.CSSProperties = {
  color: "#22c55e",
  fontWeight: 900,
};

const blue: React.CSSProperties = {
  color: "#38bdf8",
  fontWeight: 900,
};

const gold: React.CSSProperties = {
  color: "#facc15",
  fontWeight: 900,
};

const redText: React.CSSProperties = {
  color: "#ef4444",
  fontWeight: 900,
};

const purpleText: React.CSSProperties = {
  color: "#c084fc",
  fontWeight: 900,
};

const ioLink: React.CSSProperties = {
  color: "#38bdf8",
  textDecoration: "none",
  fontWeight: 900,
};

const greenBig: React.CSSProperties = {
  color: "#22c55e",
  fontWeight: 900,
  fontSize: 18,
};

const redBig: React.CSSProperties = {
  color: "#ef4444",
  fontWeight: 900,
  fontSize: 18,
};
const modalOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  background: "rgba(0,0,0,0.78)",
  backdropFilter: "blur(6px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const deleteModal: React.CSSProperties = {
  width: 760,
  borderRadius: 22,
  padding: 34,
  background:
    "linear-gradient(180deg, rgba(15,10,35,0.98), rgba(5,8,18,0.98))",
  border: "1px solid rgba(168,85,247,0.65)",
  boxShadow: "0 0 60px rgba(168,85,247,0.35)",
  textAlign: "center",
};

const skullIcon: React.CSSProperties = {
  fontSize: 58,
  color: "#c084fc",
  textShadow: "0 0 26px rgba(168,85,247,0.9)",
};

const modalTitle: React.CSSProperties = {
  fontSize: 42,
  fontWeight: 900,
  margin: "8px 0 12px",
};

const modalText: React.CSSProperties = {
  fontSize: 18,
  lineHeight: 1.6,
  color: "#d1d5db",
};

const clientPreview: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 22,
  margin: "26px 0",
  padding: 22,
  borderRadius: 16,
  background: "rgba(0,0,0,0.3)",
  border: "1px solid rgba(168,85,247,0.35)",
  textAlign: "left",
};

const avatarCircle: React.CSSProperties = {
  width: 82,
  height: 82,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 38,
  background: "rgba(88,28,135,0.65)",
  border: "1px solid rgba(168,85,247,0.7)",
};

const clientNameBig: React.CSSProperties = {
  fontSize: 30,
  fontWeight: 900,
  marginBottom: 14,
};

const clientMeta: React.CSSProperties = {
  display: "flex",
  gap: 34,
  alignItems: "center",
};

const metaLabel: React.CSSProperties = {
  display: "block",
  color: "#a78bfa",
  fontSize: 12,
  fontWeight: 900,
  marginBottom: 5,
};

const warningBox: React.CSSProperties = {
  padding: 20,
  borderRadius: 16,
  border: "1px solid rgba(244,63,94,0.75)",
  background: "rgba(127,29,29,0.16)",
  textAlign: "left",
};

const warningGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  marginTop: 14,
  color: "#d1d5db",
};

const modalActions: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: 24,
  marginTop: 28,
};

const cancelModalBtn: React.CSSProperties = {
  width: 210,
  height: 54,
  borderRadius: 12,
  border: "1px solid rgba(168,85,247,0.6)",
  background: "rgba(0,0,0,0.35)",
  color: "white",
  fontWeight: 900,
  fontSize: 17,
  cursor: "pointer",
  transition: "all 0.18s ease",
  boxShadow: "0 0 14px rgba(168,85,247,0.22)",
};

const deleteModalBtn: React.CSSProperties = {
  width: 260,
  height: 54,
  borderRadius: 12,
  border: "1px solid rgba(244,63,94,0.9)",
  background: "linear-gradient(90deg,#9f1239,#e11d48)",
  color: "white",
  fontWeight: 900,
  fontSize: 17,
  cursor: "pointer",
  transition: "all 0.18s ease",
  boxShadow: "0 0 24px rgba(244,63,94,0.45)",
};
const tickBtn: React.CSSProperties = {
  border: 0,
  background: "transparent",
  color: "#22c55e",
  fontWeight: 900,
  fontSize: 20,
  cursor: "pointer",
};

const xBtn: React.CSSProperties = {
  border: 0,
  background: "transparent",
  color: "#ef4444",
  fontWeight: 900,
  fontSize: 20,
  cursor: "pointer",
};