// ─────────────────────────────────────────────────────────────
// App.jsx – Chore Quests
// Organized into:
//   1. Imports
//   2. Helper functions
//   3. Constants & seed data
//   4. App component (state → derived values → handlers → JSX)
// ─────────────────────────────────────────────────────────────

import "./App.css";
import { useState, useEffect } from "react";

// ─────────────────────────────────────────────────────────────
// SECTION 1 – HELPER FUNCTIONS
// Pure utility functions used throughout the app.
// ─────────────────────────────────────────────────────────────

/**
 * Returns today's date as an ISO string (YYYY-MM-DD).
 * Avoids toISOString() which converts to UTC and can shift dates
 * depending on the user's local timezone.
 */
function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Converts an ISO date string (YYYY-MM-DD) to MM/DD/YYYY for
 * display in the UI. Storage always stays ISO so sorting works.
 */
function formatDisplayDate(isoDate) {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-");
  return `${month}/${day}/${year}`;
}

/**
 * Returns year, 0-based month index, and total days in the
 * current calendar month. Used by getCurrentMonthDays().
 */
function getCurrentMonthInfo() {
  const d = new Date();
  const year = d.getFullYear();
  const monthIndex = d.getMonth(); // 0 = January, 11 = December
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  return { year, monthIndex, daysInMonth };
}

/**
 * Builds an array of day objects for the current month.
 * Each object: { iso: "YYYY-MM-DD", day: 1–31 }
 * Used by the Calendar view to render each grid cell.
 */
function getCurrentMonthDays() {
  const { year, monthIndex, daysInMonth } = getCurrentMonthInfo();
  const month = String(monthIndex + 1).padStart(2, "0");
  const days = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = String(day).padStart(2, "0");
    days.push({ iso: `${year}-${month}-${dayStr}`, day });
  }
  return days;
}

/**
 * Computes the current completion streak in days.
 * A day counts only if it has at least one chore and ALL are done.
 * Walks backwards from today, stopping at the first incomplete day.
 */
function calculateStreak(chores) {
  const todayIso = getTodayDateString();

  // Group all chores into a map keyed by ISO date string
  const byDate = chores.reduce((acc, chore) => {
    if (!chore.date) return acc;
    if (!acc[chore.date]) acc[chore.date] = [];
    acc[chore.date].push(chore);
    return acc;
  }, {});

  let streak = 0;
  let current = new Date(todayIso);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, "0");
    const day = String(current.getDate()).padStart(2, "0");
    const dateKey = `${year}-${month}-${day}`;

    const dayChores = byDate[dateKey];
    if (!dayChores || dayChores.length === 0) break;
    if (!dayChores.every((c) => c.completed)) break;

    streak += 1;
    current.setDate(current.getDate() - 1); // step back one day
  }

  return streak;
}

// ─────────────────────────────────────────────────────────────
// SECTION 2 – CONSTANTS & SEED DATA
// App-wide constants and default state used on first launch.
// ─────────────────────────────────────────────────────────────

// localStorage key – bump the version string to wipe saved data
const STORAGE_KEY = "chore-quests-state-v2";

// PIN required to unlock the Parent tab
const PARENT_PIN = "0928";

// Weekday labels for the calendar header row
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Default kid profile used on first launch
const initialKid = {
  id: 1,
  name: "Alex",
  avatarColor: "#4F46E5",
  points: 40,
};

// Default chores used on first launch
// Fields: id, title, dueTime, points, completed, date, icon
const initialChores = [
  {
    id: 1,
    title: "Make bed",
    dueTime: "8:30 AM",
    points: 5,
    completed: false,
    date: "2026-03-27",
    icon: "🛏️",
  },
  {
    id: 2,
    title: "Feed the dog",
    dueTime: "8:45 AM",
    points: 10,
    completed: false,
    date: "2026-03-27",
    icon: "🐶",
  },
  {
    id: 3,
    title: "Homework",
    dueTime: "6:00 PM",
    points: 20,
    completed: false,
    date: "2026-03-27",
    icon: "📚",
  },
];

// Default rewards used on first launch
// Fields: id, title, description, costPoints, type
const initialRewards = [
  {
    id: 1,
    title: "30 min screen time",
    description: "Extra 30 minutes of game or TV time.",
    costPoints: 30,
    type: "privilege",
  },
  {
    id: 2,
    title: "Choose dessert",
    description: "You pick dessert for family night.",
    costPoints: 20,
    type: "fun",
  },
  {
    id: 3,
    title: "$5 allowance",
    description: "Five dollars added to your allowance.",
    costPoints: 50,
    type: "money",
  },
  {
    id: 4,
    title: "New game savings",
    description: "Put points toward a new game goal.",
    costPoints: 100,
    type: "money",
  },
];

// ─────────────────────────────────────────────────────────────
// SECTION 3 – APP COMPONENT
// ─────────────────────────────────────────────────────────────

function App() {

  // ── NAVIGATION ───────────────────────────────────────────
  // Controls which tab is currently visible.
  // Possible values: "today" | "calendar" | "rewards" | "parent"
  const [view, setView] = useState("today");

  // ── DATE ─────────────────────────────────────────────────
  // today      – the real current date; never changes mid-session.
  // currentDate – the date the app is "focused on"; defaults to
  //               today but can be changed by clicking a calendar cell.
  const today = getTodayDateString();
  const [currentDate, setCurrentDate] = useState(today);

  // ── PARENT FORM ───────────────────────────────────────────
  // Controlled inputs for the Add / Edit chore form in Parent view.
  const [newChoreTitle, setNewChoreTitle] = useState("");
  const [newChoreDueTime, setNewChoreDueTime] = useState("");
  const [newChorePoints, setNewChorePoints] = useState(10);
  const [newChoreDate, setNewChoreDate] = useState(today);

  // ── EDIT MODE ─────────────────────────────────────────────
  // Non-null = form is editing this chore ID.
  // Null     = form is in "add new chore" mode.
  const [editingChoreId, setEditingChoreId] = useState(null);

  // ── PIN GATE ──────────────────────────────────────────────
  // parentUnlocked – whether the Parent tab content is visible.
  // pinInput       – controlled value of the PIN input field.
  // pinError       – error message shown after a wrong attempt.
  const [parentUnlocked, setParentUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");

  // ── PERSISTED STATE ───────────────────────────────────────
  // All three are loaded lazily from localStorage on first render.
  // Falls back to seed data if nothing has been saved yet.

  const [kid, setKid] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return initialKid;
      const parsed = JSON.parse(raw);
      return parsed.kid || initialKid;
    } catch {
      return initialKid;
    }
  });

  const [chores, setChores] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return initialChores;
      const parsed = JSON.parse(raw);
      return parsed.chores || initialChores;
    } catch {
      return initialChores;
    }
  });

  const [rewards, setRewards] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return initialRewards;
      const parsed = JSON.parse(raw);
      return parsed.rewards || initialRewards;
    } catch {
      return initialRewards;
    }
  });

  // ── DERIVED VALUES ────────────────────────────────────────
  // Computed fresh on every render from current state.
  // No useState needed for these.

  // Real streak count from consecutive fully-completed days
  const streakDays = calculateStreak(chores);

  // Chores filtered to the currently focused date
  const todaysChores = chores.filter((c) => c.date === currentDate);
  const completedCount = todaysChores.filter((c) => c.completed).length;
  const totalCount = todaysChores.length;

  // Per-date totals used by the Calendar view cells
  const choresByDate = chores.reduce((acc, chore) => {
    const key = chore.date;
    if (!key) return acc;
    if (!acc[key]) acc[key] = { total: 0, completed: 0 };
    acc[key].total += 1;
    if (chore.completed) acc[key].completed += 1;
    return acc;
  }, {});

  // ── PERSISTENCE EFFECT ────────────────────────────────────
  // Writes kid, chores, and rewards to localStorage after every
  // state change that affects any of the three.
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ kid, chores, rewards })
      );
    } catch (err) {
      console.error("Failed to save state:", err);
    }
  }, [kid, chores, rewards]);

  // ── HANDLERS ──────────────────────────────────────────────

  /**
   * Mark a chore as complete and award its points to the kid.
   * Uses functional state updates to avoid stale closure issues.
   * Guards against double-awarding if the chore is already done.
   */
  function handleCompleteChore(choreId) {
    setChores((prev) =>
      prev.map((chore) =>
        chore.id === choreId ? { ...chore, completed: true } : chore
      )
    );
    setKid((prevKid) => {
      const chore = chores.find((c) => c.id === choreId);
      if (!chore || chore.completed) return prevKid;
      return { ...prevKid, points: prevKid.points + chore.points };
    });
  }

  /**
   * Deduct a reward's cost from the kid's points.
   * Blocks the action if the kid cannot afford it.
   * Stamps the reward with a lastRedeemedAt ISO timestamp.
   */
  function handleRedeemReward(rewardId) {
    const reward = rewards.find((r) => r.id === rewardId);
    if (!reward) return;
    if (kid.points < reward.costPoints) {
      alert("Not enough points yet!");
      return;
    }
    setKid((prev) => ({ ...prev, points: prev.points - reward.costPoints }));
    setRewards((prev) =>
      prev.map((r) =>
        r.id === rewardId
          ? { ...r, lastRedeemedAt: new Date().toISOString() }
          : r
      )
    );
  }

  /**
   * Load a chore's current values into the Parent form.
   * Sets editingChoreId so form submit knows to update vs. add.
   */
  function handleEditChore(choreId) {
    const chore = chores.find((c) => c.id === choreId);
    if (!chore) return;
    setEditingChoreId(chore.id);
    setNewChoreTitle(chore.title);
    setNewChoreDueTime(chore.dueTime === "Any time" ? "" : chore.dueTime);
    setNewChorePoints(chore.points);
    setNewChoreDate(chore.date);
  }

  /**
   * Exit edit mode and reset the Parent form back to "add" state.
   */
  function handleCancelEdit() {
    setEditingChoreId(null);
    setNewChoreTitle("");
    setNewChoreDueTime("");
    setNewChorePoints(10);
    setNewChoreDate(today);
  }

  /**
   * Add a new chore or save edits to an existing one.
   * Checks editingChoreId to decide which path to take.
   * Resets the form and exits edit mode when done.
   */
  function handleAddChore(e) {
    e.preventDefault();
    if (!newChoreTitle.trim()) {
      alert("Please enter a title for the chore.");
      return;
    }
    const points = Number(newChorePoints) || 0;

    if (editingChoreId != null) {
      // Update the existing chore in place
      setChores((prev) =>
        prev.map((chore) =>
          chore.id === editingChoreId
            ? {
                ...chore,
                title: newChoreTitle.trim(),
                dueTime: newChoreDueTime.trim() || "Any time",
                points,
                date: newChoreDate || today,
              }
            : chore
        )
      );
    } else {
      // Append a brand new chore
      setChores((prev) => [
        ...prev,
        {
          id: Date.now(),
          title: newChoreTitle.trim(),
          dueTime: newChoreDueTime.trim() || "Any time",
          points,
          completed: false,
          date: newChoreDate || today,
        },
      ]);
    }

    // Reset form and exit edit mode
    setNewChoreTitle("");
    setNewChoreDueTime("");
    setNewChorePoints(10);
    setNewChoreDate(today);
    setEditingChoreId(null);
  }

  /**
   * Delete a chore after a confirmation prompt.
   * Uses window.confirm – if browser blocks it, refresh the tab.
   */
  function handleDeleteChore(choreId) {
    if (!window.confirm("Delete this chore?")) return;
    setChores((prev) => prev.filter((chore) => chore.id !== choreId));
  }

  /**
   * Validate the PIN entry and unlock the Parent tab if correct.
   * Clears the input and shows an error message on a wrong attempt.
   */
  function handlePinSubmit(e) {
    e.preventDefault();
    if (pinInput === PARENT_PIN) {
      setParentUnlocked(true);
      setPinInput("");
      setPinError("");
    } else {
      setPinError("Incorrect PIN. Try again.");
      setPinInput("");
    }
  }

  /**
   * Lock the Parent tab and clear all PIN-related state.
   * Called when the parent clicks the Lock button.
   */
  function handleLockParent() {
    setParentUnlocked(false);
    setPinInput("");
    setPinError("");
  }

  // ─────────────────────────────────────────────────────────
  // JSX – RENDER
  // ─────────────────────────────────────────────────────────

  return (
    <div className="app">

      {/* ── HEADER ──────────────────────────────────────────
          Always visible. Shows avatar, greeting, daily chore
          summary for the currently focused date, streak count,
          and total points.
      ────────────────────────────────────────────────────── */}
      <header className="header">
        <div className="avatar" style={{ backgroundColor: kid.avatarColor }}>
          {kid.name.charAt(0)}
        </div>
        <div className="header-text">
          <div className="greeting">Hi, {kid.name}</div>
          <div className="summary">
            {completedCount} of {totalCount} chores for{" "}
            {formatDisplayDate(currentDate)}
          </div>
          <div className="streak">
            Streak: {streakDays} day{streakDays === 1 ? "" : "s"} in a row
          </div>
        </div>
        <div className="points">
          <div className="points-label">Points</div>
          <div className="points-value">{kid.points}</div>
        </div>
      </header>

      {/* ── MAIN CONTENT ────────────────────────────────────
          Renders one of four views depending on active tab.
      ────────────────────────────────────────────────────── */}
      <main className="main">

        {/* ── TODAY VIEW ────────────────────────────────────
            Shows chores filtered to currentDate only.
            currentDate defaults to today but can be changed
            by clicking a day in the Calendar view.
        ────────────────────────────────────────────────── */}
        {view === "today" && (
          <>
            <h2>Today&apos;s chores</h2>

            {/* Empty state message when no chores exist for this date */}
            {todaysChores.length === 0 && (
              <p style={{ fontSize: 13, color: "#9ca3af" }}>
                No chores scheduled for {formatDisplayDate(currentDate)}.
              </p>
            )}

            <div className="chore-list">
              {todaysChores.map((chore) => (
                <div
                  key={chore.id}
                  className={`chore-card ${chore.completed ? "completed" : ""}`}
                >
                  <div className="chore-info">
                    {/* Optional emoji icon before the title */}
                    <div className="chore-title">
                      {chore.icon && (
                        <span style={{ marginRight: 6 }}>{chore.icon}</span>
                      )}
                      {chore.title}
                    </div>
                    <div className="chore-meta">
                      {formatDisplayDate(chore.date)} • {chore.dueTime} •{" "}
                      {chore.points} pts
                    </div>
                  </div>
                  <div className="chore-action">
                    {chore.completed ? (
                      /* Already done – disabled button */
                      <button className="btn done" disabled>
                        ✓ Done
                      </button>
                    ) : (
                      /* Mark as done and award points */
                      <button
                        className="btn primary"
                        onClick={() => handleCompleteChore(chore.id)}
                      >
                        Mark done
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── CALENDAR VIEW ─────────────────────────────────
            Shows the current month as a 7-column grid.
            Each cell displays done/total chores for that day.
            Today is outlined in purple.
            Fully completed days are highlighted green.
            Clicking any cell sets currentDate and opens Today.
        ────────────────────────────────────────────────── */}
        {view === "calendar" && (
          <>
            <h2>Calendar – This month</h2>
            <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8 }}>
              Tap a day to view its chores. Green = all done.
            </p>

            {/* Weekday header row: Sun Mon Tue Wed Thu Fri Sat */}
            <div className="calendar-weekdays">
              {WEEKDAYS.map((label) => (
                <div key={label} className="calendar-weekday">
                  {label}
                </div>
              ))}
            </div>

            {/* Day cells – one per day in the current month */}
            <div className="calendar-grid">
              {getCurrentMonthDays().map((day) => {
                const stats = choresByDate[day.iso];
                const total = stats?.total || 0;
                const done = stats?.completed || 0;
                const isToday = day.iso === today;
                const allDone = total > 0 && done === total;
                return (
                  <div
                    key={day.iso}
                    className={`calendar-cell ${
                      isToday ? "calendar-cell-today" : ""
                    } ${allDone ? "calendar-cell-all-done" : ""}`}
                    onClick={() => {
                      setCurrentDate(day.iso);
                      setView("today");
                    }}
                  >
                    <div className="calendar-day-number">{day.day}</div>
                    {total > 0 ? (
                      <div className="calendar-day-stats">
                        {done}/{total}
                      </div>
                    ) : (
                      <div className="calendar-day-stats calendar-day-empty">
                        –
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Selected day summary panel below the grid */}
            <div
              style={{
                marginTop: 12,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #1f2937",
                background: "#020617",
                fontSize: 12,
                color: "#e5e7eb",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                {formatDisplayDate(currentDate)} summary
              </div>
              {(() => {
                const stats = choresByDate[currentDate];
                if (!stats || stats.total === 0) {
                  return <div>No chores scheduled for this day.</div>;
                }
                return (
                  <>
                    <div>
                      Chores: {stats.completed} of {stats.total} completed
                    </div>
                    <div style={{ marginTop: 4, color: "#9ca3af" }}>
                      Tap the day cell above to view and complete chores.
                    </div>
                  </>
                );
              })()}
            </div>
          </>
        )}

        {/* ── REWARDS VIEW ──────────────────────────────────
            Lists all available rewards.
            Redeem button is disabled when the kid cannot afford it.
            Deducts points and stamps a timestamp on redemption.
        ────────────────────────────────────────────────── */}
        {view === "rewards" && (
          <>
            <h2>Rewards</h2>
            <div className="reward-list">
              {rewards.map((reward) => {
                const canAfford = kid.points >= reward.costPoints;
                return (
                  <div key={reward.id} className="chore-card">
                    <div className="chore-info">
                      <div className="chore-title">
                        {reward.title}
                        <span className="reward-pill">
                          {reward.type === "money" ? "Money" : "Fun"}
                        </span>
                      </div>
                      <div className="chore-meta">{reward.description}</div>
                      <div className="reward-meta">
                        Cost: {reward.costPoints} pts
                      </div>
                    </div>
                    <div className="chore-action">
                      <button
                        className="btn primary"
                        disabled={!canAfford}
                        onClick={() => handleRedeemReward(reward.id)}
                      >
                        {canAfford ? "Redeem" : "Need more"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
                {/* ── PARENT VIEW ───────────────────────────────────
            Locked behind a PIN gate.
            Shows a lock screen when parentUnlocked is false.
            Shows full chore management controls when unlocked.
            Includes a Lock button to re-secure the view.
        ────────────────────────────────────────────────── */}
        {view === "parent" && (
          <>
            {!parentUnlocked ? (

              /* ── PIN ENTRY SCREEN ─────────────────────────
                 Centered lock icon, title, and PIN input form.
                 Wrong PIN shows an error message below input.
              ────────────────────────────────────────────── */
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  marginTop: 48,
                  gap: 12,
                }}
              >
                <div style={{ fontSize: 32 }}>🔒</div>
                <h2 style={{ margin: 0 }}>Parent Area</h2>
                <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>
                  Enter your PIN to continue.
                </p>
                <form
                  onSubmit={handlePinSubmit}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 8,
                  }}
                >
                  <input
                    type="password"
                    placeholder="Enter PIN"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #1f2937",
                      background: "#020617",
                      color: "#e5e7eb",
                      fontSize: 16,
                      textAlign: "center",
                      width: 140,
                    }}
                  />
                  {/* Error message shown on wrong PIN attempt */}
                  {pinError && (
                    <div style={{ color: "#f87171", fontSize: 12 }}>
                      {pinError}
                    </div>
                  )}
                  <button className="btn primary" type="submit">
                    Unlock
                  </button>
                </form>
              </div>

            ) : (

              /* ── UNLOCKED PARENT CONTROLS ─────────────────
                 Full chore management: view all chores across
                 all dates, edit or delete any chore, and add
                 new chores for any past or future date.
              ────────────────────────────────────────────── */
              <>
                {/* Header row with title and Lock button */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 4,
                  }}
                >
                  <h2 style={{ margin: 0 }}>Parent – Controls</h2>
                  {/* Lock button re-secures the Parent tab */}
                  <button
                    className="btn"
                    style={{
                      fontSize: 10,
                      background: "#111827",
                      color: "#9ca3af",
                    }}
                    onClick={handleLockParent}
                  >
                    🔒 Lock
                  </button>
                </div>

                {/* Subtitle changes based on add vs edit mode */}
                <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8 }}>
                  {editingChoreId != null
                    ? "Editing an existing chore."
                    : "Add new chores for any date."}
                </p>

                {/* ── ALL CHORES LIST ──────────────────────
                    Shows every chore regardless of date.
                    Each row has Edit and Delete action buttons.
                ──────────────────────────────────────────── */}
                <div className="chore-list">
                  {chores.map((chore) => (
                    <div key={chore.id} className="chore-card">
                      <div className="chore-info">
                        <div className="chore-title">
                          {chore.icon && (
                            <span style={{ marginRight: 6 }}>
                              {chore.icon}
                            </span>
                          )}
                          {chore.title}
                        </div>
                        <div className="chore-meta">
                          {formatDisplayDate(chore.date)} • {chore.dueTime} •{" "}
                          {chore.points} pts
                        </div>
                      </div>
                      <div className="chore-action">
                        {/* Edit: prefills form with this chore's values */}
                        <button
                          className="btn"
                          style={{
                            fontSize: 10,
                            marginRight: 6,
                            background: "#4b5563",
                            color: "white",
                          }}
                          onClick={() => handleEditChore(chore.id)}
                        >
                          Edit
                        </button>
                        {/* Delete: confirms then removes the chore */}
                        <button
                          className="btn"
                          style={{
                            fontSize: 10,
                            background: "#111827",
                            color: "#f87171",
                          }}
                          onClick={() => handleDeleteChore(chore.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* ── ADD / EDIT CHORE FORM ────────────────
                    Shared form for both adding and editing.
                    Title changes based on editingChoreId.
                    Cancel button only appears in edit mode.
                ──────────────────────────────────────────── */}
                <form className="parent-form" onSubmit={handleAddChore}>
                  <h3 style={{ fontSize: 14, marginTop: 0 }}>
                    {editingChoreId != null ? "Edit chore" : "Add a new chore"}
                  </h3>

                  <div className="parent-form-row">
                    <label>Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Clean desk"
                      value={newChoreTitle}
                      onChange={(e) => setNewChoreTitle(e.target.value)}
                    />
                  </div>

                  <div className="parent-form-row">
                    <label>Due time</label>
                    <input
                      type="text"
                      placeholder="e.g. 4:00 PM"
                      value={newChoreDueTime}
                      onChange={(e) => setNewChoreDueTime(e.target.value)}
                    />
                  </div>

                  <div className="parent-form-row">
                    <label>Date</label>
                    <input
                      type="date"
                      value={newChoreDate}
                      onChange={(e) => setNewChoreDate(e.target.value)}
                    />
                  </div>

                  <div className="parent-form-row">
                    <label>Points</label>
                    <input
                      type="number"
                      placeholder="10"
                      value={newChorePoints}
                      onChange={(e) => setNewChorePoints(e.target.value)}
                    />
                  </div>

                  {/* Submit and optional Cancel buttons */}
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button
                      className="btn primary parent-submit"
                      type="submit"
                    >
                      {editingChoreId != null ? "Update Chore" : "Add Chore"}
                    </button>
                    {/* Cancel only shown when editing an existing chore */}
                    {editingChoreId != null && (
                      <button
                        type="button"
                        className="btn"
                        style={{ background: "#6b7280" }}
                        onClick={handleCancelEdit}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </>
            )}
          </>
        )}

      </main>

      {/* ── BOTTOM NAV ────────────────────────────────────────
          Four tabs: Today / Calendar / Rewards / Parent.
          Active tab is highlighted with nav-btn-active class.
      ────────────────────────────────────────────────────── */}
      <nav className="nav">
        <button
          className={`nav-btn ${view === "today" ? "nav-btn-active" : ""}`}
          onClick={() => setView("today")}
        >
          Today
        </button>
        <button
          className={`nav-btn ${view === "calendar" ? "nav-btn-active" : ""}`}
          onClick={() => setView("calendar")}
        >
          Calendar
        </button>
        <button
          className={`nav-btn ${view === "rewards" ? "nav-btn-active" : ""}`}
          onClick={() => setView("rewards")}
        >
          Rewards
        </button>
        <button
          className={`nav-btn ${view === "parent" ? "nav-btn-active" : ""}`}
          onClick={() => setView("parent")}
        >
          Parent
        </button>
      </nav>

    </div>
  );
}

export default App;