// BodyMap v5.0 — Loyalty Program · 5-Dimension Review · AI Insights
import { useState, useEffect, useCallback } from "react";

const C = {
  bg: "#F0EAD9",
  cardBg: "#FDFAF3",
  green: "#2A5741",
  sage: "#6B9E80",
  sagePale: "#D0E8D8",
  sageMid: "#A8CDBA",
  focus: "#3D8C55",
  avoid: "#B84A42",
  skin: "#E8D0B0",
  skinDark: "#C9A87A",
  neutral: "#C4B49A",
  text: "#1C3024",
  textMid: "#4A6154",
  textLight: "#7A9485",
  border: "#DDD5C0",
  white: "#FFFFFF",
  shadow: "rgba(42,87,65,0.10)",
  aiGold: "#B87840",
  aiGoldPale: "#F5EDD8",
  aiGoldBorder: "#D4B070",
  gold: "#D4AC4A",
  goldPale: "#FDF6DC",
};
const F = {
  display: "'Cormorant Garamond', Georgia, serif",
  body: "'Nunito', 'Helvetica Neue', sans-serif",
};
const SESSIONS_FOR_FREE = 10;
const PLABELS = ["", "Feather", "Light", "Medium", "Firm", "Deep"];
const PLICONS = ["", "🪶", "😌", "👌", "💪", "⚡"];
const GOAL_LABELS = {
  relax: "Relaxation",
  pain: "Pain Relief",
  athletic: "Athletic Recovery",
  stress: "Stress Relief",
  injury: "Injury Rehab",
};
const DEFAULT_PREFS = {
  pressure: 3,
  goal: "relax",
  tableTemp: "warm",
  roomTemp: "comfortable",
  music: "soft",
  lighting: "dim",
  conversation: "quiet",
  draping: "standard",
  oilPref: "none",
  medFlag: "none",
};

// Claude API
const SYSTEM = `You are a wellness session preference observer for BodyMap. Notice patterns in self-reported preferences only.
RULES: Never diagnose. Never use: diagnosis, condition, injury, treatment, syndrome, disorder, symptom, prognosis, risk.
Frame everything as preference patterns: "you tend to prefer", "your sessions show a pattern of".
End every response with: "✨ These are observations from your personal session preferences only — not medical advice."`;

async function callClaude(prompt) {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: SYSTEM,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const d = await res.json();
    return d.content?.[0]?.text || null;
  } catch {
    return null;
  }
}

// Region data
const FRONT_REGIONS = [
  {
    id: "f-head",
    label: "Head",
    type: "ellipse",
    cx: 100,
    cy: 44,
    rx: 27,
    ry: 31,
  },
  {
    id: "f-neck",
    label: "Neck",
    type: "rect",
    x: 90,
    y: 73,
    w: 20,
    h: 17,
    rx: 7,
  },
  {
    id: "f-l-shldr",
    label: "L. Shoulder",
    type: "ellipse",
    cx: 62,
    cy: 100,
    rx: 19,
    ry: 14,
  },
  {
    id: "f-r-shldr",
    label: "R. Shoulder",
    type: "ellipse",
    cx: 138,
    cy: 100,
    rx: 19,
    ry: 14,
  },
  {
    id: "f-l-chest",
    label: "L. Chest",
    type: "rect",
    x: 78,
    y: 91,
    w: 23,
    h: 29,
    rx: 5,
  },
  {
    id: "f-r-chest",
    label: "R. Chest",
    type: "rect",
    x: 99,
    y: 91,
    w: 23,
    h: 29,
    rx: 5,
  },
  {
    id: "f-abdomen",
    label: "Abdomen",
    type: "rect",
    x: 77,
    y: 119,
    w: 46,
    h: 33,
    rx: 6,
  },
  {
    id: "f-l-arm-u",
    label: "L. Upper Arm",
    type: "rect",
    x: 46,
    y: 110,
    w: 18,
    h: 46,
    rx: 9,
  },
  {
    id: "f-r-arm-u",
    label: "R. Upper Arm",
    type: "rect",
    x: 136,
    y: 110,
    w: 18,
    h: 46,
    rx: 9,
  },
  {
    id: "f-l-forearm",
    label: "L. Forearm",
    type: "rect",
    x: 40,
    y: 154,
    w: 16,
    h: 42,
    rx: 8,
  },
  {
    id: "f-r-forearm",
    label: "R. Forearm",
    type: "rect",
    x: 144,
    y: 154,
    w: 16,
    h: 42,
    rx: 8,
  },
  {
    id: "f-l-hand",
    label: "L. Hand",
    type: "ellipse",
    cx: 48,
    cy: 204,
    rx: 10,
    ry: 12,
  },
  {
    id: "f-r-hand",
    label: "R. Hand",
    type: "ellipse",
    cx: 152,
    cy: 204,
    rx: 10,
    ry: 12,
  },
  {
    id: "f-l-hip",
    label: "L. Hip",
    type: "rect",
    x: 76,
    y: 151,
    w: 24,
    h: 24,
    rx: 6,
  },
  {
    id: "f-r-hip",
    label: "R. Hip",
    type: "rect",
    x: 100,
    y: 151,
    w: 24,
    h: 24,
    rx: 6,
  },
  {
    id: "f-l-thigh",
    label: "L. Thigh",
    type: "rect",
    x: 76,
    y: 173,
    w: 23,
    h: 62,
    rx: 9,
  },
  {
    id: "f-r-thigh",
    label: "R. Thigh",
    type: "rect",
    x: 101,
    y: 173,
    w: 23,
    h: 62,
    rx: 9,
  },
  {
    id: "f-l-knee",
    label: "L. Knee",
    type: "ellipse",
    cx: 87,
    cy: 242,
    rx: 13,
    ry: 12,
  },
  {
    id: "f-r-knee",
    label: "R. Knee",
    type: "ellipse",
    cx: 113,
    cy: 242,
    rx: 13,
    ry: 12,
  },
  {
    id: "f-l-calf",
    label: "L. Calf",
    type: "rect",
    x: 76,
    y: 251,
    w: 21,
    h: 54,
    rx: 9,
  },
  {
    id: "f-r-calf",
    label: "R. Calf",
    type: "rect",
    x: 103,
    y: 251,
    w: 21,
    h: 54,
    rx: 9,
  },
  {
    id: "f-l-foot",
    label: "L. Foot",
    type: "ellipse",
    cx: 84,
    cy: 312,
    rx: 17,
    ry: 9,
  },
  {
    id: "f-r-foot",
    label: "R. Foot",
    type: "ellipse",
    cx: 116,
    cy: 312,
    rx: 17,
    ry: 9,
  },
];
const BACK_REGIONS = [
  {
    id: "b-head",
    label: "Head",
    type: "ellipse",
    cx: 100,
    cy: 44,
    rx: 27,
    ry: 31,
  },
  {
    id: "b-neck",
    label: "Neck",
    type: "rect",
    x: 90,
    y: 73,
    w: 20,
    h: 17,
    rx: 7,
  },
  {
    id: "b-l-shldr",
    label: "L. Shoulder",
    type: "ellipse",
    cx: 62,
    cy: 100,
    rx: 19,
    ry: 14,
  },
  {
    id: "b-r-shldr",
    label: "R. Shoulder",
    type: "ellipse",
    cx: 138,
    cy: 100,
    rx: 19,
    ry: 14,
  },
  {
    id: "b-upper-bk",
    label: "Upper Back",
    type: "rect",
    x: 77,
    y: 90,
    w: 46,
    h: 29,
    rx: 5,
  },
  {
    id: "b-mid-bk",
    label: "Mid Back",
    type: "rect",
    x: 77,
    y: 118,
    w: 46,
    h: 28,
    rx: 5,
  },
  {
    id: "b-lower-bk",
    label: "Lower Back",
    type: "rect",
    x: 77,
    y: 145,
    w: 46,
    h: 26,
    rx: 5,
  },
  {
    id: "b-l-arm-u",
    label: "L. Upper Arm",
    type: "rect",
    x: 46,
    y: 110,
    w: 18,
    h: 46,
    rx: 9,
  },
  {
    id: "b-r-arm-u",
    label: "R. Upper Arm",
    type: "rect",
    x: 136,
    y: 110,
    w: 18,
    h: 46,
    rx: 9,
  },
  {
    id: "b-l-forearm",
    label: "L. Forearm",
    type: "rect",
    x: 40,
    y: 154,
    w: 16,
    h: 42,
    rx: 8,
  },
  {
    id: "b-r-forearm",
    label: "R. Forearm",
    type: "rect",
    x: 144,
    y: 154,
    w: 16,
    h: 42,
    rx: 8,
  },
  {
    id: "b-l-hand",
    label: "L. Hand",
    type: "ellipse",
    cx: 48,
    cy: 204,
    rx: 10,
    ry: 12,
  },
  {
    id: "b-r-hand",
    label: "R. Hand",
    type: "ellipse",
    cx: 152,
    cy: 204,
    rx: 10,
    ry: 12,
  },
  {
    id: "b-l-glute",
    label: "L. Glute",
    type: "ellipse",
    cx: 89,
    cy: 184,
    rx: 17,
    ry: 16,
  },
  {
    id: "b-r-glute",
    label: "R. Glute",
    type: "ellipse",
    cx: 111,
    cy: 184,
    rx: 17,
    ry: 16,
  },
  {
    id: "b-l-hamstr",
    label: "L. Hamstring",
    type: "rect",
    x: 76,
    y: 197,
    w: 23,
    h: 53,
    rx: 9,
  },
  {
    id: "b-r-hamstr",
    label: "R. Hamstring",
    type: "rect",
    x: 101,
    y: 197,
    w: 23,
    h: 53,
    rx: 9,
  },
  {
    id: "b-l-knee",
    label: "L. Knee",
    type: "ellipse",
    cx: 87,
    cy: 257,
    rx: 13,
    ry: 12,
  },
  {
    id: "b-r-knee",
    label: "R. Knee",
    type: "ellipse",
    cx: 113,
    cy: 257,
    rx: 13,
    ry: 12,
  },
  {
    id: "b-l-calf",
    label: "L. Calf",
    type: "rect",
    x: 76,
    y: 266,
    w: 21,
    h: 52,
    rx: 9,
  },
  {
    id: "b-r-calf",
    label: "R. Calf",
    type: "rect",
    x: 103,
    y: 266,
    w: 21,
    h: 52,
    rx: 9,
  },
  {
    id: "b-l-foot",
    label: "L. Foot",
    type: "ellipse",
    cx: 84,
    cy: 325,
    rx: 17,
    ry: 9,
  },
  {
    id: "b-r-foot",
    label: "R. Foot",
    type: "ellipse",
    cx: 116,
    cy: 325,
    rx: 17,
    ry: 9,
  },
];
const ALL_REGIONS = [...FRONT_REGIONS, ...BACK_REGIONS];

function buildPattern(sessions) {
  if (!sessions.length) return null;
  const m = {};
  sessions.forEach((s) =>
    Object.entries(s.bodyMap || {}).forEach(([id, st]) => {
      if (!m[id]) m[id] = { focus: 0, avoid: 0 };
      m[id][st] = (m[id][st] || 0) + 1;
    })
  );
  const tf = Object.entries(m)
    .filter(([, v]) => v.focus > 0)
    .sort(([, a], [, b]) => b.focus - a.focus)
    .slice(0, 5)
    .map(([id, v]) => ({
      label: ALL_REGIONS.find((r) => r.id === id)?.label || id,
      count: v.focus,
      pct: Math.round((v.focus / sessions.length) * 100),
    }));
  const ta = Object.entries(m)
    .filter(([, v]) => v.avoid > 0)
    .sort(([, a], [, b]) => b.avoid - a.avoid)
    .slice(0, 3)
    .map(([id, v]) => ({
      label: ALL_REGIONS.find((r) => r.id === id)?.label || id,
      count: v.avoid,
      pct: Math.round((v.avoid / sessions.length) * 100),
    }));
  const ps = sessions.map((s) => s.prefs?.pressure).filter(Boolean);
  const avg = ps.length
    ? Math.round(ps.reduce((a, b) => a + b, 0) / ps.length)
    : 3;
  const gs = {};
  sessions.forEach((s) => {
    if (s.prefs?.goal) gs[s.prefs.goal] = (gs[s.prefs.goal] || 0) + 1;
  });
  const tg = Object.entries(gs).sort(([, a], [, b]) => b - a)[0]?.[0];
  return {
    topFocus: tf,
    topAvoid: ta,
    avgPressure: avg,
    topGoal: tg,
    total: sessions.length,
  };
}

function getLoyalty(sessions) {
  const paid = sessions.filter((s) => !s.isFreeSession).length;
  const cycleProgress = paid % SESSIONS_FOR_FREE;
  const nextFreeIn = SESSIONS_FOR_FREE - cycleProgress;
  const hasEarned = cycleProgress === 0 && paid > 0;
  return { paid, cycleProgress, nextFreeIn, hasEarned };
}

// SVG Body
const Sil = ({ isFront }) => {
  const sk = C.skin,
    ol = C.skinDark,
    sw = 1.2;
  return (
    <g>
      <ellipse
        cx="100"
        cy="44"
        rx="28"
        ry="32"
        fill={sk}
        stroke={ol}
        strokeWidth={sw}
      />
      <rect
        x="90"
        y="73"
        width="20"
        height="18"
        rx="7"
        fill={sk}
        stroke={ol}
        strokeWidth={sw}
      />
      <rect
        x="67"
        y="87"
        width="66"
        height="75"
        rx="13"
        fill={sk}
        stroke={ol}
        strokeWidth={sw}
      />
      <rect
        x="71"
        y="148"
        width="58"
        height="38"
        rx="9"
        fill={sk}
        stroke={ol}
        strokeWidth={sw}
      />
      <rect
        x="45"
        y="108"
        width="20"
        height="48"
        rx="10"
        fill={sk}
        stroke={ol}
        strokeWidth={sw}
      />
      <rect
        x="135"
        y="108"
        width="20"
        height="48"
        rx="10"
        fill={sk}
        stroke={ol}
        strokeWidth={sw}
      />
      <rect
        x="39"
        y="154"
        width="18"
        height="44"
        rx="9"
        fill={sk}
        stroke={ol}
        strokeWidth={sw}
      />
      <rect
        x="143"
        y="154"
        width="18"
        height="44"
        rx="9"
        fill={sk}
        stroke={ol}
        strokeWidth={sw}
      />
      <ellipse
        cx="48"
        cy="205"
        rx="11"
        ry="13"
        fill={sk}
        stroke={ol}
        strokeWidth={sw}
      />
      <ellipse
        cx="152"
        cy="205"
        rx="11"
        ry="13"
        fill={sk}
        stroke={ol}
        strokeWidth={sw}
      />
      <rect
        x="75"
        y="183"
        width="25"
        height="65"
        rx="11"
        fill={sk}
        stroke={ol}
        strokeWidth={sw}
      />
      <rect
        x="100"
        y="183"
        width="25"
        height="65"
        rx="11"
        fill={sk}
        stroke={ol}
        strokeWidth={sw}
      />
      <ellipse
        cx="87"
        cy="253"
        rx="14"
        ry="13"
        fill={sk}
        stroke={ol}
        strokeWidth={sw}
      />
      <ellipse
        cx="113"
        cy="253"
        rx="14"
        ry="13"
        fill={sk}
        stroke={ol}
        strokeWidth={sw}
      />
      <rect
        x="75"
        y="262"
        width="23"
        height="56"
        rx="11"
        fill={sk}
        stroke={ol}
        strokeWidth={sw}
      />
      <rect
        x="102"
        y="262"
        width="23"
        height="56"
        rx="11"
        fill={sk}
        stroke={ol}
        strokeWidth={sw}
      />
      <ellipse
        cx="84"
        cy="325"
        rx="18"
        ry="10"
        fill={sk}
        stroke={ol}
        strokeWidth={sw}
      />
      <ellipse
        cx="116"
        cy="325"
        rx="18"
        ry="10"
        fill={sk}
        stroke={ol}
        strokeWidth={sw}
      />
      {isFront ? (
        <>
          <ellipse cx="93" cy="42" rx="3" ry="3.5" fill={ol} opacity="0.25" />
          <ellipse cx="107" cy="42" rx="3" ry="3.5" fill={ol} opacity="0.25" />
          <path
            d="M 94 52 Q 100 56 106 52"
            stroke={ol}
            strokeWidth="1.5"
            fill="none"
            opacity="0.25"
            strokeLinecap="round"
          />
        </>
      ) : (
        <path
          d="M100,88 L100,218"
          stroke={ol}
          strokeWidth="1"
          strokeDasharray="3,5"
          opacity="0.2"
        />
      )}
    </g>
  );
};

const BR = ({ r, state, onToggle, readOnly }) => {
  const fill =
    state === "focus" ? C.focus : state === "avoid" ? C.avoid : C.neutral;
  const s = {
    fill,
    opacity: state ? 0.88 : 0.4,
    onClick: readOnly ? undefined : () => onToggle(r.id),
    style: {
      cursor: readOnly ? "default" : "pointer",
      transition: "all 0.18s",
    },
  };
  return r.type === "ellipse" ? (
    <ellipse {...s} cx={r.cx} cy={r.cy} rx={r.rx} ry={r.ry} />
  ) : (
    <rect {...s} x={r.x} y={r.y} width={r.w} height={r.h} rx={r.rx || 0} />
  );
};

const BMSVG = ({
  regions,
  selections,
  onToggle,
  readOnly = false,
  scale = 1,
}) => {
  const [tip, setTip] = useState(null);
  const front = regions[0]?.id?.startsWith("f-");
  return (
    <div style={{ position: "relative", userSelect: "none" }}>
      <svg
        viewBox="0 0 200 340"
        style={{
          width: "100%",
          maxWidth: 200 * scale,
          display: "block",
          margin: "0 auto",
        }}
      >
        <Sil isFront={front} />
        {regions.map((r) => (
          <g
            key={r.id}
            onMouseEnter={() => !readOnly && setTip(r.label)}
            onMouseLeave={() => setTip(null)}
          >
            <BR
              r={r}
              state={selections[r.id]}
              onToggle={onToggle}
              readOnly={readOnly}
            />
          </g>
        ))}
      </svg>
      {tip && (
        <div
          style={{
            position: "absolute",
            top: 6,
            left: "50%",
            transform: "translateX(-50%)",
            background: C.green,
            color: "#fff",
            padding: "4px 14px",
            borderRadius: 20,
            fontSize: 12,
            fontFamily: F.body,
            fontWeight: 700,
            pointerEvents: "none",
            whiteSpace: "nowrap",
            zIndex: 9,
          }}
        >
          {tip}
        </div>
      )}
    </div>
  );
};

const Mini = ({ regions, selections, label }) => (
  <div style={{ textAlign: "center", flex: 1 }}>
    {label && (
      <p
        style={{
          fontFamily: F.body,
          fontSize: 11,
          fontWeight: 800,
          color: C.textLight,
          marginBottom: 4,
          letterSpacing: 1,
          textTransform: "uppercase",
        }}
      >
        {label}
      </p>
    )}
    <BMSVG
      regions={regions}
      selections={selections}
      onToggle={() => {}}
      readOnly
      scale={0.54}
    />
  </div>
);

// UI primitives
const Card = ({ children, style = {}, onClick }) => (
  <div
    onClick={onClick}
    style={{
      background: C.cardBg,
      borderRadius: 20,
      padding: 18,
      boxShadow: `0 4px 18px ${C.shadow}`,
      marginBottom: 12,
      cursor: onClick ? "pointer" : "default",
      ...style,
    }}
  >
    {children}
  </div>
);
const Btn = ({
  children,
  onClick,
  ghost = false,
  disabled = false,
  style = {},
}) => (
  <button
    onClick={disabled ? undefined : onClick}
    style={{
      background: ghost ? "transparent" : disabled ? C.border : C.green,
      color: ghost ? C.textMid : disabled ? C.textLight : "#fff",
      border: ghost ? `2px solid ${C.border}` : "none",
      padding: "14px 22px",
      borderRadius: 50,
      fontFamily: F.body,
      fontSize: 14,
      fontWeight: 800,
      cursor: disabled ? "not-allowed" : "pointer",
      transition: "all 0.2s",
      boxShadow: !ghost && !disabled ? `0 4px 14px ${C.shadow}` : "none",
      flex: 1,
      ...style,
    }}
  >
    {children}
  </button>
);
const Inp = ({ style = {}, ...p }) => (
  <input
    {...p}
    style={{
      fontFamily: F.body,
      border: `2px solid ${C.border}`,
      borderRadius: 12,
      padding: "12px 14px",
      fontSize: 15,
      width: "100%",
      color: C.text,
      background: C.white,
      outline: "none",
      boxSizing: "border-box",
      ...style,
    }}
  />
);
const TA = ({ style = {}, ...p }) => (
  <textarea
    {...p}
    style={{
      fontFamily: F.body,
      border: `2px solid ${C.border}`,
      borderRadius: 12,
      padding: "12px 14px",
      fontSize: 14,
      width: "100%",
      color: C.text,
      background: C.white,
      outline: "none",
      resize: "vertical",
      minHeight: 80,
      boxSizing: "border-box",
      lineHeight: 1.6,
      ...style,
    }}
  />
);
const PT = ({ icon, label, selected, onClick }) => (
  <button
    onClick={onClick}
    style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 5,
      padding: "11px 4px",
      borderRadius: 14,
      border: `2px solid ${selected ? C.green : C.border}`,
      background: selected ? C.sagePale : C.white,
      cursor: "pointer",
      transition: "all 0.2s",
    }}
  >
    <span style={{ fontSize: 20 }}>{icon}</span>
    <span
      style={{
        fontSize: 10,
        fontWeight: 800,
        color: selected ? C.green : C.textLight,
        fontFamily: F.body,
        textAlign: "center",
        lineHeight: 1.2,
      }}
    >
      {label}
    </span>
  </button>
);
const PS = ({ icon, title }) => (
  <div
    style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}
  >
    <span style={{ fontSize: 15 }}>{icon}</span>
    <h3
      style={{
        fontFamily: F.body,
        fontSize: 13,
        fontWeight: 800,
        color: C.green,
      }}
    >
      {title}
    </h3>
  </div>
);
const Slider = ({ value, onChange }) => (
  <div>
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        marginBottom: 6,
      }}
    >
      <span style={{ fontFamily: F.body, fontSize: 11, color: C.textLight }}>
        🪶 Feather
      </span>
      <span
        style={{
          fontFamily: F.body,
          fontSize: 13,
          fontWeight: 800,
          color: C.green,
        }}
      >
        {PLICONS[value]} {PLABELS[value]}
      </span>
      <span style={{ fontFamily: F.body, fontSize: 11, color: C.textLight }}>
        ⚡ Deep
      </span>
    </div>
    <input
      type="range"
      min={1}
      max={5}
      value={value}
      onChange={(e) => onChange(+e.target.value)}
      style={{ width: "100%", accentColor: C.green, cursor: "pointer" }}
    />
    <div
      style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <div
          key={n}
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: n <= value ? C.green : C.border,
            transition: "background 0.2s",
          }}
        />
      ))}
    </div>
  </div>
);
const Step = ({ step }) => {
  const steps = ["Front", "Back", "Preferences"];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 22,
      }}
    >
      {steps.map((l, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                fontFamily: F.body,
                background:
                  i + 1 < step ? C.sage : i + 1 === step ? C.green : C.border,
                color: i + 1 <= step ? "#fff" : C.textLight,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 800,
                boxShadow: i + 1 === step ? `0 0 0 4px ${C.sagePale}` : "none",
              }}
            >
              {i + 1 < step ? "✓" : i + 1}
            </div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                fontFamily: F.body,
                color: i + 1 <= step ? C.green : C.textLight,
              }}
            >
              {l}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              style={{
                width: 40,
                height: 2,
                background: i + 1 < step ? C.sage : C.border,
                marginBottom: 14,
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
};
const MT = ({ mode, setMode }) => (
  <div
    style={{
      display: "flex",
      background: "#E2D9CB",
      borderRadius: 50,
      padding: 4,
      marginBottom: 12,
    }}
  >
    {[
      { v: "focus", e: "🟢", l: "Focus Here", a: C.focus },
      { v: "avoid", e: "🔴", l: "Avoid", a: C.avoid },
    ].map(({ v, e, l, a }) => (
      <button
        key={v}
        onClick={() => setMode(v)}
        style={{
          flex: 1,
          padding: "10px 8px",
          borderRadius: 50,
          border: "none",
          fontFamily: F.body,
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          background: mode === v ? a : "transparent",
          color: mode === v ? "#fff" : C.textLight,
          transition: "all 0.2s",
        }}
      >
        {e} {l}
      </button>
    ))}
  </div>
);
const AT = ({ regions, selections }) => {
  const sel = regions.filter((r) => selections[r.id]);
  if (!sel.length) return null;
  return (
    <div
      style={{
        marginTop: 12,
        padding: "10px 12px",
        background: C.sagePale,
        borderRadius: 12,
      }}
    >
      <p
        style={{
          fontFamily: F.body,
          fontSize: 10,
          fontWeight: 800,
          color: C.green,
          marginBottom: 6,
          textTransform: "uppercase",
        }}
      >
        Selected:
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {sel.map((r) => (
          <span
            key={r.id}
            style={{
              background: selections[r.id] === "focus" ? C.focus : C.avoid,
              color: "#fff",
              padding: "3px 9px",
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 700,
              fontFamily: F.body,
            }}
          >
            {selections[r.id] === "focus" ? "🟢" : "🔴"} {r.label}
          </span>
        ))}
      </div>
    </div>
  );
};

// AI UI
const Shimmer = () => (
  <div style={{ padding: "16px 0" }}>
    {[80, 95, 70, 88].map((w, i) => (
      <div
        key={i}
        style={{
          height: 12,
          background: `linear-gradient(90deg,${C.aiGoldPale} 25%,#EDE0C8 50%,${C.aiGoldPale} 75%)`,
          backgroundSize: "200% 100%",
          borderRadius: 6,
          marginBottom: 10,
          width: `${w}%`,
          animation: "shimmer 1.5s infinite",
        }}
      />
    ))}
    <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
  </div>
);
const AIC = ({ children, style = {} }) => (
  <div
    style={{
      background: `linear-gradient(135deg,${C.aiGoldPale} 0%,#FDF6E8 100%)`,
      border: `1.5px solid ${C.aiGoldBorder}`,
      borderRadius: 20,
      padding: 18,
      marginBottom: 12,
      boxShadow: "0 4px 20px rgba(184,120,64,0.12)",
      ...style,
    }}
  >
    {children}
  </div>
);
const AIB = ({ label = "AI Insight" }) => (
  <div
    style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}
  >
    <div
      style={{
        width: 26,
        height: 26,
        borderRadius: "50%",
        background: C.aiGold,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 14,
      }}
    >
      ✦
    </div>
    <span
      style={{
        fontFamily: F.body,
        fontSize: 11,
        fontWeight: 800,
        color: C.aiGold,
        textTransform: "uppercase",
        letterSpacing: 1,
      }}
    >
      {label}
    </span>
  </div>
);

// Loyalty bar (client-facing)
const LoyaltyBar = ({ sessions }) => {
  const { paid, cycleProgress, nextFreeIn, hasEarned } = getLoyalty(sessions);
  if (!paid) return null;
  if (hasEarned)
    return (
      <div
        style={{
          background: `linear-gradient(135deg,${C.gold} 0%,#E8C84A 100%)`,
          borderRadius: 20,
          padding: 18,
          marginBottom: 12,
          boxShadow: "0 4px 20px rgba(212,172,74,0.3)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 36 }}>🎁</div>
          <div style={{ flex: 1 }}>
            <p
              style={{
                fontFamily: F.display,
                fontSize: 22,
                fontWeight: 600,
                color: C.text,
                marginBottom: 4,
              }}
            >
              You've earned a free session!
            </p>
            <p style={{ fontFamily: F.body, fontSize: 13, color: C.textMid }}>
              Show this to your therapist to redeem your complimentary session.
            </p>
          </div>
        </div>
        <div
          style={{
            background: "rgba(255,255,255,0.5)",
            borderRadius: 12,
            padding: "10px 14px",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontFamily: F.body,
              fontSize: 12,
              fontWeight: 800,
              color: C.text,
            }}
          >
            🆓 1 FREE SESSION READY TO REDEEM
          </p>
        </div>
      </div>
    );
  return (
    <div
      style={{
        background: C.goldPale,
        border: `1.5px solid ${C.gold}40`,
        borderRadius: 20,
        padding: 18,
        marginBottom: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>🎁</span>
          <div>
            <p
              style={{
                fontFamily: F.body,
                fontSize: 13,
                fontWeight: 800,
                color: C.text,
              }}
            >
              Loyalty Reward
            </p>
            <p style={{ fontFamily: F.body, fontSize: 11, color: C.textLight }}>
              {nextFreeIn} session{nextFreeIn !== 1 ? "s" : ""} until your free
              session
            </p>
          </div>
        </div>
        <p
          style={{
            fontFamily: F.display,
            fontSize: 24,
            fontWeight: 600,
            color: C.aiGold,
          }}
        >
          {cycleProgress}
          <span style={{ fontSize: 14, color: C.textLight }}>
            /{SESSIONS_FOR_FREE}
          </span>
        </p>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {Array.from({ length: SESSIONS_FOR_FREE }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 10,
              borderRadius: 5,
              background:
                i < cycleProgress
                  ? `linear-gradient(90deg,${C.aiGold},${C.gold})`
                  : C.border,
              transition: "background 0.3s",
            }}
          />
        ))}
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: cycleProgress === SESSIONS_FOR_FREE ? C.gold : C.border,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          🎁
        </div>
      </div>
      <p
        style={{
          fontFamily: F.body,
          fontSize: 11,
          color: C.textLight,
          marginTop: 8,
          textAlign: "center",
        }}
      >
        Every {SESSIONS_FOR_FREE} sessions = 1 complimentary session
      </p>
    </div>
  );
};

// Loyalty alert (therapist-facing)
const TherapistLoyalty = ({ sessions, clientName }) => {
  const { paid, cycleProgress, nextFreeIn, hasEarned } = getLoyalty(sessions);
  if (!paid) return null;
  if (hasEarned)
    return (
      <div
        style={{
          background: `linear-gradient(135deg,${C.gold} 0%,#E8C84A 100%)`,
          borderRadius: 16,
          padding: 16,
          marginBottom: 12,
          boxShadow: "0 4px 16px rgba(212,172,74,0.3)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 10,
          }}
        >
          <span style={{ fontSize: 28 }}>🎁</span>
          <div>
            <p
              style={{
                fontFamily: F.body,
                fontSize: 13,
                fontWeight: 800,
                color: C.text,
              }}
            >
              Free Session Earned!
            </p>
            <p style={{ fontFamily: F.body, fontSize: 12, color: C.textMid }}>
              {clientName} has completed {paid} paid sessions
            </p>
          </div>
        </div>
        <div
          style={{
            background: "rgba(255,255,255,0.6)",
            borderRadius: 10,
            padding: "10px 14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <p
            style={{
              fontFamily: F.body,
              fontSize: 13,
              fontWeight: 800,
              color: C.text,
            }}
          >
            🆓 This session is complimentary
          </p>
          <button
            style={{
              background: C.green,
              color: "#fff",
              border: "none",
              padding: "6px 14px",
              borderRadius: 50,
              fontFamily: F.body,
              fontSize: 11,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Mark Redeemed
          </button>
        </div>
      </div>
    );
  return (
    <div
      style={{
        background: C.goldPale,
        border: `1.5px solid ${C.gold}40`,
        borderRadius: 14,
        padding: 13,
        marginBottom: 12,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 18 }}>🎁</span>
        <div>
          <p
            style={{
              fontFamily: F.body,
              fontSize: 12,
              fontWeight: 800,
              color: C.text,
            }}
          >
            {cycleProgress} of {SESSIONS_FOR_FREE} sessions
          </p>
          <p style={{ fontFamily: F.body, fontSize: 11, color: C.textLight }}>
            {nextFreeIn} more until {clientName}'s free session
          </p>
        </div>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        {Array.from({ length: SESSIONS_FOR_FREE }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: i < cycleProgress ? C.aiGold : C.border,
            }}
          />
        ))}
      </div>
    </div>
  );
};

// AI brief for therapist
const AIBrief = ({ clientInfo, bodyMap, prefs, notes, sessions }) => {
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const gen = async () => {
    setLoading(true);
    const focus = ALL_REGIONS.filter((r) => bodyMap[r.id] === "focus").map(
      (r) => r.label
    );
    const avoid = ALL_REGIONS.filter((r) => bodyMap[r.id] === "avoid").map(
      (r) => r.label
    );
    const p = buildPattern(sessions);
    const prompt = `Professional massage therapist session brief. Client: ${
      clientInfo.name
    }. Focus: ${focus.join(", ") || "none"}. Avoid: ${
      avoid.join(", ") || "none"
    }. Pressure: ${PLABELS[prefs.pressure]}. Goal: ${
      GOAL_LABELS[prefs.goal] || "Relaxation"
    }. Conversation: ${prefs.conversation}. ${
      notes ? `Notes: "${notes}".` : ""
    }${
      prefs.medFlag === "yes" && prefs.medNote
        ? `Area of awareness: "${prefs.medNote}".`
        : ""
    }${
      p && sessions.length >= 2
        ? `History: ${sessions.length} sessions. Top focus: ${p.topFocus
            .slice(0, 3)
            .map((f) => `${f.label} ${f.pct}%`)
            .join(", ")}.`
        : ""
    } Write warm professional 3-4 sentence brief. Never diagnose.`;
    const r = await callClaude(prompt);
    setBrief(r);
    setLoading(false);
    setDone(true);
  };
  return (
    <AIC>
      <AIB label="AI Session Brief" />
      <p
        style={{
          fontFamily: F.body,
          fontSize: 12,
          color: C.textMid,
          marginBottom: 14,
        }}
      >
        AI-generated overview from intake & session history
      </p>
      {!done && !loading && (
        <button
          onClick={gen}
          style={{
            background: C.aiGold,
            color: "#fff",
            border: "none",
            padding: "12px 20px",
            borderRadius: 50,
            fontFamily: F.body,
            fontSize: 13,
            fontWeight: 800,
            cursor: "pointer",
            width: "100%",
          }}
        >
          ✦ Generate Session Brief
        </button>
      )}
      {loading && <Shimmer />}
      {brief && (
        <div>
          <p
            style={{
              fontFamily: F.body,
              fontSize: 14,
              color: C.text,
              lineHeight: 1.8,
              fontStyle: "italic",
            }}
          >
            {brief}
          </p>
          <button
            onClick={gen}
            style={{
              background: "transparent",
              border: `1px solid ${C.aiGoldBorder}`,
              color: C.aiGold,
              padding: "7px 14px",
              borderRadius: 50,
              fontFamily: F.body,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              marginTop: 10,
            }}
          >
            ↺ Regenerate
          </button>
        </div>
      )}
    </AIC>
  );
};

// AI wellness insights (client-facing)
const Insights = ({ sessions, clientName }) => {
  const [ins, setIns] = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const gen = useCallback(async () => {
    if (sessions.length < 2) return;
    setLoading(true);
    const p = buildPattern(sessions);
    const ps = sessions
      .slice(0, 5)
      .map((s) => s.prefs?.pressure)
      .filter(Boolean);
    const trend =
      ps.length > 1 && ps[0] > ps[ps.length - 1]
        ? "lighter"
        : ps.length > 1 && ps[0] < ps[ps.length - 1]
        ? "deeper"
        : "consistent";
    const prompt = `Wellness pattern observations for ${
      clientName || "this person"
    }. ${sessions.length} sessions. Focus: ${p?.topFocus
      .slice(0, 4)
      .map((f) => `${f.label} ${f.count}/${sessions.length} sessions`)
      .join(", ")}. Avoid: ${
      p?.topAvoid
        .slice(0, 3)
        .map((a) => `${a.label} ${a.pct}%`)
        .join(", ") || "none"
    }. Pressure: ${
      PLABELS[p?.avgPressure || 3]
    }, trending ${trend}. Write 2-3 warm curious observations as wellness companion. 4-5 sentences. End with disclaimer.`;
    const r = await callClaude(prompt);
    setIns(r);
    setLoading(false);
    setDone(true);
  }, [sessions, clientName]);
  if (sessions.length < 2)
    return (
      <AIC>
        <AIB label="Wellness Intelligence" />
        <p style={{ fontFamily: F.body, fontSize: 13, color: C.textMid }}>
          Complete 2+ sessions to unlock your personal wellness pattern
          insights.
        </p>
      </AIC>
    );
  return (
    <AIC>
      <AIB label="Wellness Intelligence" />
      <h3
        style={{
          fontFamily: F.body,
          fontSize: 13,
          fontWeight: 800,
          color: C.aiGold,
          marginBottom: 4,
          textTransform: "uppercase",
        }}
      >
        Your Wellness Patterns
      </h3>
      <p
        style={{
          fontFamily: F.body,
          fontSize: 12,
          color: C.textMid,
          marginBottom: 14,
        }}
      >
        AI observations from your {sessions.length} sessions — not medical
        advice
      </p>
      {!done && !loading && (
        <button
          onClick={gen}
          style={{
            background: C.aiGold,
            color: "#fff",
            border: "none",
            padding: "12px 20px",
            borderRadius: 50,
            fontFamily: F.body,
            fontSize: 13,
            fontWeight: 800,
            cursor: "pointer",
            width: "100%",
          }}
        >
          ✦ Reveal My Wellness Patterns
        </button>
      )}
      {loading && <Shimmer />}
      {ins && (
        <div>
          <p
            style={{
              fontFamily: F.body,
              fontSize: 14,
              color: C.text,
              lineHeight: 1.9,
            }}
          >
            {ins}
          </p>
          <button
            onClick={gen}
            style={{
              background: "transparent",
              border: `1px solid ${C.aiGoldBorder}`,
              color: C.aiGold,
              padding: "7px 14px",
              borderRadius: 50,
              fontFamily: F.body,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              marginTop: 10,
            }}
          >
            ↺ Refresh
          </button>
        </div>
      )}
    </AIC>
  );
};

// Smart pre-fill
const PreFill = ({ sessions, onPreFill }) => {
  if (!sessions.length) return null;
  const last = sessions[0];
  const fc = Object.values(last.bodyMap || {}).filter(
    (v) => v === "focus"
  ).length;
  const d = Math.floor((Date.now() - new Date(last.date)) / 86400000);
  return (
    <AIC style={{ marginBottom: 14 }}>
      <AIB label="Smart Session Start" />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 12,
        }}
      >
        <div style={{ flex: 1 }}>
          <p
            style={{
              fontFamily: F.body,
              fontSize: 13,
              fontWeight: 700,
              color: C.text,
              marginBottom: 4,
            }}
          >
            Welcome back
            {last.clientInfo?.name ? `, ${last.clientInfo.name}` : ""}!
          </p>
          <p style={{ fontFamily: F.body, fontSize: 12, color: C.textMid }}>
            Last session{" "}
            {d === 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`} · {fc}{" "}
            focus area{fc !== 1 ? "s" : ""}
          </p>
        </div>
        <Mini
          regions={FRONT_REGIONS}
          selections={last.bodyMap || {}}
          label=""
        />
      </div>
      <button
        onClick={() => onPreFill(last)}
        style={{
          background: C.aiGold,
          color: "#fff",
          border: "none",
          padding: "11px 18px",
          borderRadius: 50,
          fontFamily: F.body,
          fontSize: 13,
          fontWeight: 800,
          cursor: "pointer",
          width: "100%",
        }}
      >
        ✦ Start from Last Session's Preferences
      </button>
      <p
        style={{
          fontFamily: F.body,
          fontSize: 11,
          color: C.textLight,
          textAlign: "center",
          marginTop: 8,
        }}
      >
        Pre-fills your map and preferences — modify anything
      </p>
    </AIC>
  );
};

// Pattern prediction
const Prediction = ({ sessions, onApply }) => {
  if (sessions.length < 3) return null;
  const p = buildPattern(sessions);
  if (!p || !p.topFocus.length) return null;
  const top = p.topFocus[0];
  const cc = top.pct >= 80 ? C.focus : top.pct >= 60 ? C.aiGold : C.sage;
  const cl =
    top.pct >= 80
      ? "Strong pattern"
      : top.pct >= 60
      ? "Clear pattern"
      : "Emerging pattern";
  return (
    <AIC>
      <AIB label="Session Intelligence" />
      <h3
        style={{
          fontFamily: F.body,
          fontSize: 13,
          fontWeight: 800,
          color: C.aiGold,
          marginBottom: 12,
          textTransform: "uppercase",
        }}
      >
        Based on your {sessions.length} sessions
      </h3>
      <div
        style={{
          background: "rgba(255,255,255,0.6)",
          borderRadius: 14,
          padding: "12px 14px",
          marginBottom: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 6,
          }}
        >
          <p
            style={{
              fontFamily: F.body,
              fontSize: 12,
              fontWeight: 800,
              color: C.textMid,
            }}
          >
            Most Chosen Focus Area
          </p>
          <span
            style={{
              background: cc,
              color: "#fff",
              fontSize: 10,
              fontWeight: 800,
              padding: "2px 8px",
              borderRadius: 20,
              fontFamily: F.body,
            }}
          >
            {cl}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <p
            style={{
              fontFamily: F.display,
              fontSize: 22,
              fontWeight: 600,
              color: C.green,
              flex: 1,
            }}
          >
            {top.label}
          </p>
          <div style={{ textAlign: "right" }}>
            <p
              style={{
                fontFamily: F.body,
                fontSize: 20,
                fontWeight: 800,
                color: cc,
              }}
            >
              {top.pct}%
            </p>
            <p style={{ fontFamily: F.body, fontSize: 10, color: C.textLight }}>
              of sessions
            </p>
          </div>
        </div>
        <div
          style={{
            height: 6,
            background: C.border,
            borderRadius: 3,
            marginTop: 8,
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${top.pct}%`,
              background: `linear-gradient(90deg,${C.focus},${C.sage})`,
              borderRadius: 3,
            }}
          />
        </div>
      </div>
      {p.topFocus.length > 1 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {p.topFocus.slice(0, 5).map((f) => (
              <span
                key={f.label}
                style={{
                  background: `${C.focus}18`,
                  color: C.focus,
                  border: `1px solid ${C.focus}30`,
                  padding: "4px 10px",
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: F.body,
                }}
              >
                🟢 {f.label} · {f.pct}%
              </span>
            ))}
          </div>
        </div>
      )}
      <button
        onClick={onApply}
        style={{
          background: C.green,
          color: "#fff",
          border: "none",
          padding: "12px 20px",
          borderRadius: 50,
          fontFamily: F.body,
          fontSize: 13,
          fontWeight: 800,
          cursor: "pointer",
          width: "100%",
        }}
      >
        ✦ Pre-fill from My Patterns
      </button>
    </AIC>
  );
};

// ── 5-DIMENSION REVIEW ──
const DIMS = [
  {
    id: "pressure",
    icon: "💆",
    label: "Pressure Match",
    q: "Did the pressure match what you asked for?",
    opts: [
      { v: 1, e: "😣", l: "Way off" },
      { v: 2, e: "😕", l: "A bit off" },
      { v: 3, e: "😊", l: "Pretty good" },
      { v: 4, e: "😌", l: "Just right" },
      { v: 5, e: "🤩", l: "Perfect" },
    ],
  },
  {
    id: "focus",
    icon: "🎯",
    label: "Focus Accuracy",
    q: "Did your therapist work on the right areas?",
    opts: [
      { v: 1, e: "😞", l: "Missed them" },
      { v: 2, e: "😐", l: "Partially" },
      { v: 3, e: "🙂", l: "Mostly yes" },
      { v: 4, e: "😄", l: "Very accurate" },
      { v: 5, e: "⭐", l: "Spot on" },
    ],
  },
  {
    id: "comfort",
    icon: "🛡️",
    label: "Comfort & Communication",
    q: "Did you feel comfortable and heard?",
    opts: [
      { v: 1, e: "😰", l: "Uncomfortable" },
      { v: 2, e: "😟", l: "Somewhat" },
      { v: 3, e: "😌", l: "Fairly good" },
      { v: 4, e: "🥰", l: "Very at ease" },
      { v: 5, e: "💚", l: "Completely" },
    ],
  },
  {
    id: "atmosphere",
    icon: "🌿",
    label: "Atmosphere",
    q: "Music, lighting, temperature — how was the setting?",
    opts: [
      { v: 1, e: "😩", l: "Distracting" },
      { v: 2, e: "😑", l: "Okay" },
      { v: 3, e: "🙂", l: "Good" },
      { v: 4, e: "😊", l: "Very nice" },
      { v: 5, e: "✨", l: "Heavenly" },
    ],
  },
  {
    id: "overall",
    icon: "🌟",
    label: "Overall Experience",
    q: "How do you feel walking out?",
    opts: [
      { v: 1, e: "😔", l: "Disappointed" },
      { v: 2, e: "😐", l: "Fine" },
      { v: 3, e: "🙂", l: "Good" },
      { v: 4, e: "😄", l: "Really good" },
      { v: 5, e: "🚀", l: "Amazing" },
    ],
  },
];

const DimRater = ({ dim, value, onChange }) => (
  <div style={{ marginBottom: 20 }}>
    <div
      style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}
    >
      <span style={{ fontSize: 18 }}>{dim.icon}</span>
      <div>
        <p
          style={{
            fontFamily: F.body,
            fontSize: 13,
            fontWeight: 800,
            color: C.green,
          }}
        >
          {dim.label}
        </p>
        <p style={{ fontFamily: F.body, fontSize: 12, color: C.textLight }}>
          {dim.q}
        </p>
      </div>
    </div>
    <div style={{ display: "flex", gap: 5 }}>
      {dim.opts.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(dim.id, o.v)}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            padding: "10px 2px",
            borderRadius: 14,
            border: "none",
            background:
              value === o.v ? `${C.focus}20` : "rgba(255,255,255,0.7)",
            outline: `2px solid ${value === o.v ? C.focus : "transparent"}`,
            cursor: "pointer",
            transition: "all 0.18s",
            transform: value === o.v ? "scale(1.05)" : "scale(1)",
          }}
        >
          <span style={{ fontSize: 24 }}>{o.e}</span>
          <span
            style={{
              fontFamily: F.body,
              fontSize: 9,
              fontWeight: 800,
              color: value === o.v ? C.focus : C.textLight,
              textAlign: "center",
              lineHeight: 1.2,
            }}
          >
            {o.l}
          </span>
        </button>
      ))}
    </div>
    {value > 0 && (
      <div
        style={{
          height: 3,
          background: C.border,
          borderRadius: 2,
          marginTop: 8,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${(value / 5) * 100}%`,
            background: `linear-gradient(90deg,${C.sage},${C.focus})`,
            borderRadius: 2,
            transition: "width 0.3s",
          }}
        />
      </div>
    )}
  </div>
);

const ReviewScreen = ({ clientInfo, onDone }) => {
  const [ratings, setR] = useState({});
  const [returning, setRet] = useState(null);
  const [note, setNote] = useState("");
  const [submitted, setSub] = useState(false);
  const setRating = (id, v) => setR((r) => ({ ...r, [id]: v }));
  const allRated = DIMS.every((d) => ratings[d.id]);
  const avg = allRated
    ? Math.round(
        Object.values(ratings).reduce((a, b) => a + b, 0) / DIMS.length
      )
    : 0;
  const OC = ["", "#E57373", "#FFA726", "#66BB6A", "#42A5F5", "#AB47BC"];
  const OL = [
    "",
    "Needs work",
    "Getting there",
    "Good session",
    "Great session",
    "Exceptional!",
  ];
  const submit = () => {
    try {
      const r = JSON.parse(localStorage.getItem("bodymap-reviews") || "[]");
      r.unshift({
        id: Date.now(),
        client: clientInfo.name,
        ratings,
        avg,
        returning,
        note,
        date: new Date().toISOString(),
      });
      localStorage.setItem("bodymap-reviews", JSON.stringify(r));
    } catch {}
    setSub(true);
  };

  if (submitted)
    return (
      <div
        style={{
          background: C.bg,
          padding: "60px 20px",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 380 }}>
          <div style={{ fontSize: 60, marginBottom: 16 }}>🌿</div>
          <h1
            style={{
              fontFamily: F.display,
              fontSize: 36,
              fontWeight: 600,
              color: C.green,
              marginBottom: 8,
            }}
          >
            Thank you!
          </h1>
          <p
            style={{
              fontFamily: F.body,
              fontSize: 15,
              color: C.textMid,
              marginBottom: 28,
              lineHeight: 1.7,
            }}
          >
            Your detailed feedback helps your therapist grow their practice.
          </p>
          <Card style={{ background: C.sagePale, marginBottom: 20 }}>
            <p
              style={{
                fontFamily: F.body,
                fontSize: 11,
                fontWeight: 800,
                color: C.textLight,
                textTransform: "uppercase",
                marginBottom: 14,
              }}
            >
              Your Feedback Summary
            </p>
            {DIMS.map((d) => (
              <div
                key={d.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{d.icon}</span>
                  <p
                    style={{ fontFamily: F.body, fontSize: 12, color: C.text }}
                  >
                    {d.label}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 20 }}>
                    {d.opts.find((o) => o.v === ratings[d.id])?.e || "—"}
                  </span>
                  <div
                    style={{
                      width: 40,
                      height: 6,
                      background: C.border,
                      borderRadius: 3,
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${((ratings[d.id] || 0) / 5) * 100}%`,
                        background: C.focus,
                        borderRadius: 3,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
            {avg > 0 && (
              <div
                style={{
                  borderTop: `1px solid ${C.border}`,
                  paddingTop: 12,
                  marginTop: 4,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <p
                  style={{
                    fontFamily: F.body,
                    fontSize: 13,
                    fontWeight: 800,
                    color: C.green,
                  }}
                >
                  Overall
                </p>
                <p
                  style={{
                    fontFamily: F.display,
                    fontSize: 20,
                    fontWeight: 600,
                    color: OC[avg],
                  }}
                >
                  {OL[avg]}
                </p>
              </div>
            )}
          </Card>
          <Btn onClick={onDone} style={{ width: "100%" }}>
            Back to Home 🏠
          </Btn>
        </div>
      </div>
    );

  return (
    <div
      style={{
        background: C.bg,
        padding: "24px 20px 60px",
        minHeight: "100vh",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <h1
          style={{
            fontFamily: F.display,
            fontSize: 34,
            fontWeight: 600,
            color: C.green,
          }}
        >
          How was your session?
        </h1>
        <p
          style={{
            fontFamily: F.body,
            fontSize: 13,
            color: C.textLight,
            marginTop: 6,
          }}
        >
          5 quick ratings across what matters most
        </p>
      </div>
      <div style={{ display: "flex", gap: 5, marginBottom: 16 }}>
        {DIMS.map((d) => (
          <div
            key={d.id}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: ratings[d.id] ? C.focus : C.border,
              transition: "background 0.3s",
            }}
          />
        ))}
      </div>
      {allRated && (
        <div
          style={{
            background: OC[avg] + "18",
            border: `2px solid ${OC[avg]}40`,
            borderRadius: 16,
            padding: "14px 18px",
            marginBottom: 16,
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontFamily: F.display,
              fontSize: 24,
              fontWeight: 600,
              color: OC[avg],
            }}
          >
            {OL[avg]}
          </p>
          <p
            style={{
              fontFamily: F.body,
              fontSize: 12,
              color: C.textMid,
              marginTop: 4,
            }}
          >
            Average across all dimensions
          </p>
        </div>
      )}
      <Card>
        {DIMS.map((d) => (
          <DimRater
            key={d.id}
            dim={d}
            value={ratings[d.id] || 0}
            onChange={setRating}
          />
        ))}
      </Card>
      <Card>
        <PS icon="🔄" title="Would you return?" />
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { v: true, i: "💚", l: "Absolutely" },
            { v: "maybe", i: "🤔", l: "Maybe" },
            { v: false, i: "❌", l: "Probably not" },
          ].map(({ v, i, l }) => (
            <PT
              key={l}
              icon={i}
              label={l}
              selected={returning === v}
              onClick={() => setRet(v)}
            />
          ))}
        </div>
      </Card>
      <Card>
        <PS icon="✍️" title="Anything else? (optional)" />
        <TA
          placeholder="What you loved, or suggestions for next time..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{ minHeight: 90 }}
        />
      </Card>
      <div
        style={{
          background: C.sagePale,
          borderRadius: 14,
          padding: "11px 15px",
          marginBottom: 16,
        }}
      >
        <p style={{ fontFamily: F.body, fontSize: 12, color: C.textMid }}>
          🔒 Shared with your therapist only. Your name{" "}
          <strong>{clientInfo.name}</strong> will be visible.
        </p>
      </div>
      <Btn onClick={submit} disabled={!allRated} style={{ width: "100%" }}>
        {allRated ? "Submit Feedback ✓" : "Rate all 5 dimensions to submit"}
      </Btn>
    </div>
  );
};

// Preferences screen
const PrefScreen = ({
  prefs,
  setPrefs,
  notes,
  setNotes,
  consent,
  setConsent,
  onNext,
  onBack,
}) => {
  const upd = (k, v) => setPrefs((p) => ({ ...p, [k]: v }));
  return (
    <div
      style={{
        background: C.bg,
        padding: "18px 20px 60px",
        minHeight: "100vh",
      }}
    >
      <Step step={3} />
      <h2
        style={{
          fontFamily: F.display,
          fontSize: 26,
          fontWeight: 600,
          color: C.green,
          textAlign: "center",
          marginBottom: 4,
        }}
      >
        Your Preferences
      </h2>
      <p
        style={{
          fontFamily: F.body,
          fontSize: 13,
          color: C.textLight,
          textAlign: "center",
          marginBottom: 18,
        }}
      >
        Help your therapist create the perfect session
      </p>
      <Card>
        <PS icon="💆" title="Pressure" />
        <Slider value={prefs.pressure} onChange={(v) => upd("pressure", v)} />
      </Card>
      <Card>
        <PS icon="🎯" title="Session Goal" />
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { v: "relax", i: "😌", l: "Relax" },
            { v: "pain", i: "💊", l: "Pain Relief" },
            { v: "athletic", i: "🏃", l: "Athletic" },
            { v: "stress", i: "🧘", l: "Stress" },
            { v: "injury", i: "🩹", l: "Rehab" },
          ].map((o) => (
            <PT
              key={o.v}
              icon={o.i}
              label={o.l}
              selected={prefs.goal === o.v}
              onClick={() => upd("goal", o.v)}
            />
          ))}
        </div>
      </Card>
      <Card>
        <PS icon="🌡️" title="Table Temperature" />
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {[
            { v: "cool", i: "❄️", l: "Cool" },
            { v: "neutral", i: "😊", l: "Neutral" },
            { v: "warm", i: "☀️", l: "Warm" },
            { v: "hot", i: "🔥", l: "Hot" },
          ].map((o) => (
            <PT
              key={o.v}
              icon={o.i}
              label={o.l}
              selected={prefs.tableTemp === o.v}
              onClick={() => upd("tableTemp", o.v)}
            />
          ))}
        </div>
        <PS icon="🌿" title="Room Temperature" />
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { v: "cool", i: "🌬️", l: "Cool" },
            { v: "comfortable", i: "✅", l: "Comfortable" },
            { v: "warm", i: "🌞", l: "Warm" },
          ].map((o) => (
            <PT
              key={o.v}
              icon={o.i}
              label={o.l}
              selected={prefs.roomTemp === o.v}
              onClick={() => upd("roomTemp", o.v)}
            />
          ))}
        </div>
      </Card>
      <Card>
        <PS icon="🎵" title="Music" />
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {[
            { v: "silence", i: "🔇", l: "Silence" },
            { v: "soft", i: "🎵", l: "Soft" },
            { v: "nature", i: "🌿", l: "Nature" },
            { v: "upbeat", i: "🎶", l: "Upbeat" },
          ].map((o) => (
            <PT
              key={o.v}
              icon={o.i}
              label={o.l}
              selected={prefs.music === o.v}
              onClick={() => upd("music", o.v)}
            />
          ))}
        </div>
        <PS icon="💡" title="Lighting" />
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { v: "dark", i: "🌑", l: "Very Dim" },
            { v: "dim", i: "🌓", l: "Soft" },
            { v: "normal", i: "💡", l: "Normal" },
          ].map((o) => (
            <PT
              key={o.v}
              icon={o.i}
              label={o.l}
              selected={prefs.lighting === o.v}
              onClick={() => upd("lighting", o.v)}
            />
          ))}
        </div>
      </Card>
      <Card>
        <PS icon="🗣️" title="Conversation" />
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {[
            { v: "quiet", i: "🤫", l: "Quiet please" },
            { v: "open", i: "💬", l: "Happy to chat" },
          ].map((o) => (
            <PT
              key={o.v}
              icon={o.i}
              label={o.l}
              selected={prefs.conversation === o.v}
              onClick={() => upd("conversation", o.v)}
            />
          ))}
        </div>
        <PS icon="🛏️" title="Draping" />
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { v: "standard", i: "🛏️", l: "Standard" },
            { v: "extra", i: "🔒", l: "Extra Coverage" },
          ].map((o) => (
            <PT
              key={o.v}
              icon={o.i}
              label={o.l}
              selected={prefs.draping === o.v}
              onClick={() => upd("draping", o.v)}
            />
          ))}
        </div>
      </Card>
      <Card>
        <PS icon="🌸" title="Oil & Fragrance" />
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {[
            { v: "none", i: "✅", l: "No Issues" },
            { v: "noscent", i: "🚫", l: "Fragrance-free" },
            { v: "allergy", i: "⚠️", l: "Allergies" },
          ].map((o) => (
            <PT
              key={o.v}
              icon={o.i}
              label={o.l}
              selected={prefs.oilPref === o.v}
              onClick={() => upd("oilPref", o.v)}
            />
          ))}
        </div>
        {prefs.oilPref === "allergy" && (
          <Inp
            placeholder="Describe your allergy..."
            value={prefs.allergyNote || ""}
            onChange={(e) => upd("allergyNote", e.target.value)}
          />
        )}
      </Card>
      <Card>
        <PS icon="📋" title="Medical or Injury Notes" />
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {[
            { v: "none", i: "✅", l: "Nothing to note" },
            { v: "yes", i: "⚠️", l: "I have a note" },
          ].map((o) => (
            <PT
              key={o.v}
              icon={o.i}
              label={o.l}
              selected={prefs.medFlag === o.v}
              onClick={() => upd("medFlag", o.v)}
            />
          ))}
        </div>
        {prefs.medFlag === "yes" && (
          <TA
            placeholder="Describe any areas of awareness your therapist should know about..."
            value={prefs.medNote || ""}
            onChange={(e) => upd("medNote", e.target.value)}
          />
        )}
        <p
          style={{
            fontFamily: F.body,
            fontSize: 11,
            color: C.textLight,
            marginTop: 8,
          }}
        >
          ℹ️ BodyMap is a communication tool, not a medical service.
        </p>
      </Card>
      <Card>
        <PS icon="✏️" title="Anything else?" />
        <TA
          placeholder="Special requests, things you love, anything your therapist should know..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Card>
      <Card style={{ background: C.sagePale }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            style={{
              width: 18,
              height: 18,
              marginTop: 2,
              accentColor: C.green,
              cursor: "pointer",
              flexShrink: 0,
            }}
          />
          <p
            style={{
              fontFamily: F.body,
              fontSize: 12,
              color: C.textMid,
              lineHeight: 1.6,
            }}
          >
            I confirm this is a communication tool, not a medical service. I
            authorize sharing this information with my massage therapist.
          </p>
        </div>
      </Card>
      <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
        <Btn ghost onClick={onBack}>
          ← Back
        </Btn>
        <Btn onClick={onNext} disabled={!consent} style={{ flex: 2 }}>
          Send to Therapist 📤
        </Btn>
      </div>
    </div>
  );
};

// Therapist view
const PMAP = {
  goal: {
    relax: ["😌", "Relaxation"],
    pain: ["💊", "Pain Relief"],
    athletic: ["🏃", "Athletic Recovery"],
    stress: ["🧘", "Stress Relief"],
    injury: ["🩹", "Injury Rehab"],
  },
  tableTemp: {
    cool: ["❄️", "Cool"],
    neutral: ["😊", "Neutral"],
    warm: ["☀️", "Warm"],
    hot: ["🔥", "Hot"],
  },
  roomTemp: {
    cool: ["🌬️", "Cool"],
    comfortable: ["✅", "Comfortable"],
    warm: ["🌞", "Warm"],
  },
  music: {
    silence: ["🔇", "Silence"],
    soft: ["🎵", "Soft Music"],
    nature: ["🌿", "Nature Sounds"],
    upbeat: ["🎶", "Upbeat"],
  },
  lighting: {
    dark: ["🌑", "Very Dim"],
    dim: ["🌓", "Soft"],
    normal: ["💡", "Normal"],
  },
  conversation: {
    quiet: ["🤫", "Quiet Please"],
    open: ["💬", "Happy to Chat"],
  },
  draping: { standard: ["🛏️", "Standard"], extra: ["🔒", "Extra Coverage"] },
  oilPref: {
    none: ["✅", "No Issues"],
    noscent: ["🚫", "Fragrance-Free"],
    allergy: ["⚠️", "Has Allergy"],
  },
};

const TherapistView = ({
  clientInfo,
  bodyMap,
  prefs,
  notes,
  sessions,
  onBack,
  onReview,
}) => {
  const [tN, setTN] = useState("");
  const [saved, setSaved] = useState(false);
  const fa = ALL_REGIONS.filter((r) => bodyMap[r.id] === "focus");
  const av = ALL_REGIONS.filter((r) => bodyMap[r.id] === "avoid");
  return (
    <div
      style={{
        background: "#EEF2EC",
        minHeight: "100vh",
        padding: "0 20px 60px",
      }}
    >
      <div
        style={{
          background: `linear-gradient(135deg,${C.green} 0%,#1E4230 100%)`,
          borderRadius: "0 0 28px 28px",
          padding: "28px 22px 22px",
          marginLeft: -20,
          marginRight: -20,
          width: "calc(100% + 40px)",
          marginBottom: 18,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <p
              style={{
                fontFamily: F.body,
                fontSize: 10,
                color: C.sagePale,
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: "uppercase",
                marginBottom: 3,
              }}
            >
              Therapist View · Pre-Session
            </p>
            <h2
              style={{
                fontFamily: F.display,
                fontSize: 30,
                fontWeight: 600,
                color: "#fff",
              }}
            >
              {clientInfo.name}
            </h2>
            <p
              style={{
                fontFamily: F.body,
                fontSize: 12,
                color: C.sagePale,
                marginTop: 4,
              }}
            >
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
            }}
          >
            🌿
          </div>
        </div>
      </div>
      <TherapistLoyalty sessions={sessions} clientName={clientInfo.name} />
      <AIBrief
        clientInfo={clientInfo}
        bodyMap={bodyMap}
        prefs={prefs}
        notes={notes}
        sessions={sessions}
      />
      <Card>
        <h3
          style={{
            fontFamily: F.body,
            fontSize: 13,
            fontWeight: 800,
            color: C.green,
            marginBottom: 14,
            textTransform: "uppercase",
          }}
        >
          Body Focus Map
        </h3>
        <div style={{ display: "flex", gap: 14, justifyContent: "center" }}>
          <Mini regions={FRONT_REGIONS} selections={bodyMap} label="Front" />
          <Mini regions={BACK_REGIONS} selections={bodyMap} label="Back" />
        </div>
        {fa.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <p
              style={{
                fontFamily: F.body,
                fontSize: 10,
                fontWeight: 800,
                color: C.focus,
                marginBottom: 6,
                textTransform: "uppercase",
              }}
            >
              🟢 Focus ({fa.length})
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {fa.map((r) => (
                <span
                  key={r.id}
                  style={{
                    background: `${C.focus}18`,
                    color: C.focus,
                    border: `1px solid ${C.focus}40`,
                    padding: "3px 9px",
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: F.body,
                  }}
                >
                  {r.label}
                </span>
              ))}
            </div>
          </div>
        )}
        {av.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <p
              style={{
                fontFamily: F.body,
                fontSize: 10,
                fontWeight: 800,
                color: C.avoid,
                marginBottom: 6,
                textTransform: "uppercase",
              }}
            >
              🔴 Avoid ({av.length})
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {av.map((r) => (
                <span
                  key={r.id}
                  style={{
                    background: `${C.avoid}18`,
                    color: C.avoid,
                    border: `1px solid ${C.avoid}40`,
                    padding: "3px 9px",
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: F.body,
                  }}
                >
                  {r.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>
      <Card>
        <h3
          style={{
            fontFamily: F.body,
            fontSize: 13,
            fontWeight: 800,
            color: C.green,
            marginBottom: 14,
            textTransform: "uppercase",
          }}
        >
          Session Preferences
        </h3>
        <div
          style={{
            background: C.sagePale,
            borderRadius: 14,
            padding: "13px 15px",
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 26 }}>💆</span>
          <div>
            <p
              style={{
                fontFamily: F.body,
                fontSize: 10,
                fontWeight: 700,
                color: C.textLight,
                textTransform: "uppercase",
              }}
            >
              Pressure
            </p>
            <p
              style={{
                fontFamily: F.display,
                fontSize: 22,
                fontWeight: 600,
                color: C.green,
              }}
            >
              {PLICONS[prefs.pressure]} {PLABELS[prefs.pressure]}
            </p>
          </div>
        </div>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
        >
          {[
            ["Goal", PMAP.goal[prefs.goal]],
            ["Table", PMAP.tableTemp[prefs.tableTemp]],
            ["Room", PMAP.roomTemp[prefs.roomTemp]],
            ["Music", PMAP.music[prefs.music]],
            ["Lighting", PMAP.lighting[prefs.lighting]],
            ["Chat", PMAP.conversation[prefs.conversation]],
            ["Draping", PMAP.draping[prefs.draping]],
            ["Oil", PMAP.oilPref[prefs.oilPref]],
          ]
            .filter(([, v]) => v)
            .map(([label, [icon, val]]) => (
              <div
                key={label}
                style={{
                  background: C.bg,
                  borderRadius: 12,
                  padding: "10px 11px",
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                }}
              >
                <span style={{ fontSize: 18 }}>{icon}</span>
                <div>
                  <p
                    style={{
                      fontFamily: F.body,
                      fontSize: 10,
                      fontWeight: 700,
                      color: C.textLight,
                      textTransform: "uppercase",
                    }}
                  >
                    {label}
                  </p>
                  <p
                    style={{
                      fontFamily: F.body,
                      fontSize: 12,
                      fontWeight: 700,
                      color: C.text,
                    }}
                  >
                    {val}
                  </p>
                </div>
              </div>
            ))}
        </div>
        {prefs.oilPref === "allergy" && prefs.allergyNote && (
          <div
            style={{
              marginTop: 10,
              background: "#FFE4E0",
              border: "1px solid #E57373",
              borderRadius: 12,
              padding: 12,
            }}
          >
            <p
              style={{
                fontFamily: F.body,
                fontSize: 10,
                fontWeight: 800,
                color: "#B71C1C",
                marginBottom: 3,
              }}
            >
              🚫 ALLERGY ALERT
            </p>
            <p style={{ fontFamily: F.body, fontSize: 13, color: "#7F0000" }}>
              {prefs.allergyNote}
            </p>
          </div>
        )}
        {prefs.medFlag === "yes" && prefs.medNote && (
          <div
            style={{
              marginTop: 10,
              background: "#FFF8E1",
              border: "1px solid #FFC107",
              borderRadius: 12,
              padding: 12,
            }}
          >
            <p
              style={{
                fontFamily: F.body,
                fontSize: 10,
                fontWeight: 800,
                color: "#856404",
                marginBottom: 3,
              }}
            >
              ⚠️ CLIENT-NOTED AREA OF AWARENESS
            </p>
            <p style={{ fontFamily: F.body, fontSize: 13, color: "#533F00" }}>
              {prefs.medNote}
            </p>
          </div>
        )}
      </Card>
      {notes && (
        <Card>
          <h3
            style={{
              fontFamily: F.body,
              fontSize: 13,
              fontWeight: 800,
              color: C.green,
              marginBottom: 8,
              textTransform: "uppercase",
            }}
          >
            Client Notes
          </h3>
          <p
            style={{
              fontFamily: F.body,
              fontSize: 14,
              color: C.textMid,
              fontStyle: "italic",
              lineHeight: 1.6,
            }}
          >
            "{notes}"
          </p>
        </Card>
      )}
      <Card>
        <h3
          style={{
            fontFamily: F.body,
            fontSize: 13,
            fontWeight: 800,
            color: C.green,
            marginBottom: 4,
            textTransform: "uppercase",
          }}
        >
          Therapist Session Notes
        </h3>
        <p
          style={{
            fontFamily: F.body,
            fontSize: 12,
            color: C.textLight,
            marginBottom: 10,
          }}
        >
          For your records (saved to client history)
        </p>
        <TA
          placeholder="What did you focus on? How did the client respond? Recommendations for next session?"
          value={tN}
          onChange={(e) => {
            setTN(e.target.value);
            setSaved(false);
          }}
        />
        <Btn
          onClick={() => setSaved(true)}
          disabled={!tN}
          style={{ marginTop: 10, width: "100%" }}
        >
          {saved ? "✅ Notes Saved" : "Save Session Notes"}
        </Btn>
      </Card>
      {sessions.length > 0 && (
        <Card>
          <h3
            style={{
              fontFamily: F.body,
              fontSize: 13,
              fontWeight: 800,
              color: C.green,
              marginBottom: 12,
              textTransform: "uppercase",
            }}
          >
            Session History ({sessions.length})
          </h3>
          {sessions.slice(0, 3).map((s, i) => (
            <div
              key={s.id}
              style={{
                border: `1px solid ${C.border}`,
                borderRadius: 14,
                padding: 13,
                marginBottom: 8,
                background: C.bg,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 4,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <p
                    style={{
                      fontFamily: F.body,
                      fontWeight: 800,
                      fontSize: 13,
                      color: C.green,
                    }}
                  >
                    Session {sessions.length - i}
                  </p>
                  {s.isFreeSession && (
                    <span
                      style={{
                        background: C.gold,
                        color: C.text,
                        fontSize: 9,
                        fontWeight: 800,
                        padding: "1px 6px",
                        borderRadius: 20,
                        fontFamily: F.body,
                      }}
                    >
                      FREE
                    </span>
                  )}
                </div>
                <p
                  style={{
                    fontFamily: F.body,
                    fontSize: 11,
                    color: C.textLight,
                  }}
                >
                  {new Date(s.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
              {s.therapistNotes ? (
                <p
                  style={{
                    fontFamily: F.body,
                    fontSize: 12,
                    color: C.textMid,
                    fontStyle: "italic",
                  }}
                >
                  "{s.therapistNotes}"
                </p>
              ) : (
                <p
                  style={{
                    fontFamily: F.body,
                    fontSize: 12,
                    color: C.textLight,
                  }}
                >
                  No notes recorded
                </p>
              )}
            </div>
          ))}
          {sessions.length > 3 && (
            <p
              style={{
                fontFamily: F.body,
                fontSize: 11,
                color: C.textMid,
                textAlign: "center",
                marginTop: 8,
              }}
            >
              + {sessions.length - 3} more session
              {sessions.length - 3 > 1 ? "s" : ""}
            </p>
          )}
        </Card>
      )}
      <div
        style={{
          background: `linear-gradient(135deg,${C.sagePale} 0%,#E8F4ED 100%)`,
          border: `1.5px solid ${C.sage}40`,
          borderRadius: 14,
          padding: "12px 14px",
          marginBottom: 12,
        }}
      >
        <p
          style={{
            fontFamily: F.body,
            fontSize: 11,
            fontWeight: 800,
            color: C.green,
            marginBottom: 5,
            textTransform: "uppercase",
          }}
        >
          📋 Demo: Session Complete
        </p>
        <p
          style={{
            fontFamily: F.body,
            fontSize: 12,
            color: C.text,
            lineHeight: 1.5,
          }}
        >
          After the massage, you'd send {clientInfo.name} a link to rate their
          experience. Click below to see the client feedback screen.
        </p>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <Btn ghost onClick={onBack} style={{ flex: 1 }}>
          ← Back
        </Btn>
        <Btn onClick={onReview} style={{ flex: 2 }}>
          Preview: Client Feedback →
        </Btn>
      </div>
    </div>
  );
};

// History screen
const HistoryScreen = ({ sessions, clientName, onBack, onNewSession }) => {
  const [exp, setExp] = useState(null);
  if (!sessions.length)
    return (
      <div
        style={{
          background: C.bg,
          padding: "60px 20px",
          minHeight: "100vh",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 50, marginBottom: 16 }}>📋</div>
        <h2
          style={{
            fontFamily: F.display,
            fontSize: 28,
            fontWeight: 600,
            color: C.green,
            marginBottom: 8,
          }}
        >
          No history yet
        </h2>
        <p
          style={{
            fontFamily: F.body,
            fontSize: 14,
            color: C.textLight,
            marginBottom: 28,
          }}
        >
          Complete your first session to start building your wellness timeline.
        </p>
        <Btn onClick={onNewSession} style={{ width: "100%" }}>
          Start First Session
        </Btn>
      </div>
    );
  const cm = {};
  sessions.forEach((s) =>
    Object.entries(s.bodyMap || {}).forEach(([id, st]) => {
      if (!cm[id]) cm[id] = { focus: 0, avoid: 0 };
      cm[id][st] = (cm[id][st] || 0) + 1;
    })
  );
  const tf = Object.entries(cm)
    .filter(([, v]) => v.focus > 0)
    .sort(([, a], [, b]) => b.focus - a.focus)
    .slice(0, 3);
  const ta = Object.entries(cm)
    .filter(([, v]) => v.avoid > 0)
    .sort(([, a], [, b]) => b.avoid - a.avoid)
    .slice(0, 3);
  return (
    <div
      style={{
        background: C.bg,
        padding: "20px 20px 60px",
        minHeight: "100vh",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 22,
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            fontSize: 22,
            cursor: "pointer",
            color: C.green,
          }}
        >
          ←
        </button>
        <div>
          <h2
            style={{
              fontFamily: F.display,
              fontSize: 26,
              fontWeight: 600,
              color: C.green,
            }}
          >
            Session History
          </h2>
          <p style={{ fontFamily: F.body, fontSize: 12, color: C.textLight }}>
            {sessions.length} session{sessions.length !== 1 ? "s" : ""} on
            record
          </p>
        </div>
      </div>
      <LoyaltyBar sessions={sessions} />
      <Insights sessions={sessions} clientName={clientName} />
      {sessions.length >= 2 && (
        <Card
          style={{
            background: `linear-gradient(135deg,${C.sagePale} 0%,#EAF4EF 100%)`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <span style={{ fontSize: 18 }}>📊</span>
            <h3
              style={{
                fontFamily: F.body,
                fontSize: 13,
                fontWeight: 800,
                color: C.green,
              }}
            >
              YOUR PATTERNS
            </h3>
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
          >
            <div>
              <p
                style={{
                  fontFamily: F.body,
                  fontSize: 10,
                  fontWeight: 800,
                  color: C.focus,
                  marginBottom: 6,
                  textTransform: "uppercase",
                }}
              >
                Most Focused
              </p>
              {tf.map(([id, v]) => {
                const r = ALL_REGIONS.find((r) => r.id === id);
                return (
                  <div
                    key={id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 5,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: F.body,
                        fontSize: 12,
                        color: C.text,
                      }}
                    >
                      {r?.label}
                    </span>
                    <span
                      style={{
                        fontFamily: F.body,
                        fontSize: 11,
                        fontWeight: 800,
                        color: C.focus,
                        background: `${C.focus}18`,
                        padding: "1px 7px",
                        borderRadius: 10,
                      }}
                    >
                      {v.focus}×
                    </span>
                  </div>
                );
              })}
            </div>
            <div>
              <p
                style={{
                  fontFamily: F.body,
                  fontSize: 10,
                  fontWeight: 800,
                  color: C.avoid,
                  marginBottom: 6,
                  textTransform: "uppercase",
                }}
              >
                Most Avoided
              </p>
              {ta.map(([id, v]) => {
                const r = ALL_REGIONS.find((r) => r.id === id);
                return (
                  <div
                    key={id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 5,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: F.body,
                        fontSize: 12,
                        color: C.text,
                      }}
                    >
                      {r?.label}
                    </span>
                    <span
                      style={{
                        fontFamily: F.body,
                        fontSize: 11,
                        fontWeight: 800,
                        color: C.avoid,
                        background: `${C.avoid}18`,
                        padding: "1px 7px",
                        borderRadius: 10,
                      }}
                    >
                      {v.avoid}×
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}
      <div style={{ position: "relative" }}>
        <div
          style={{
            position: "absolute",
            left: 18,
            top: 20,
            bottom: 20,
            width: 2,
            background: C.sageMid,
            borderRadius: 2,
            zIndex: 0,
          }}
        />
        {sessions.map((s, i) => (
          <div
            key={s.id}
            style={{ position: "relative", paddingLeft: 44, marginBottom: 12 }}
          >
            <div
              style={{
                position: "absolute",
                left: 10,
                top: 18,
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: i === 0 ? C.green : C.sage,
                border: `3px solid ${C.bg}`,
                zIndex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {i === 0 && (
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#fff",
                  }}
                />
              )}
            </div>
            <Card
              style={{ cursor: "pointer", marginBottom: 0 }}
              onClick={() => setExp(exp === s.id ? null : s.id)}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 4,
                    }}
                  >
                    {i === 0 && (
                      <span
                        style={{
                          background: C.green,
                          color: "#fff",
                          fontSize: 10,
                          fontWeight: 800,
                          padding: "2px 8px",
                          borderRadius: 20,
                          fontFamily: F.body,
                        }}
                      >
                        LATEST
                      </span>
                    )}
                    {s.isFreeSession && (
                      <span
                        style={{
                          background: C.gold,
                          color: C.text,
                          fontSize: 10,
                          fontWeight: 800,
                          padding: "2px 8px",
                          borderRadius: 20,
                          fontFamily: F.body,
                        }}
                      >
                        🎁 FREE
                      </span>
                    )}
                    <p
                      style={{
                        fontFamily: F.body,
                        fontSize: 13,
                        fontWeight: 800,
                        color: C.green,
                      }}
                    >
                      Session {sessions.length - i}
                    </p>
                  </div>
                  <p
                    style={{
                      fontFamily: F.body,
                      fontSize: 12,
                      color: C.textLight,
                    }}
                  >
                    {new Date(s.date).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <span
                  style={{ fontSize: 14, color: C.textLight, marginLeft: 8 }}
                >
                  {exp === s.id ? "▲" : "▼"}
                </span>
              </div>
              {exp === s.id && (
                <div
                  style={{
                    marginTop: 14,
                    borderTop: `1px solid ${C.border}`,
                    paddingTop: 14,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      justifyContent: "center",
                      marginBottom: 14,
                    }}
                  >
                    <Mini
                      regions={FRONT_REGIONS}
                      selections={s.bodyMap || {}}
                      label="Front"
                    />
                    <Mini
                      regions={BACK_REGIONS}
                      selections={s.bodyMap || {}}
                      label="Back"
                    />
                  </div>
                  {s.therapistNotes && (
                    <div>
                      <p
                        style={{
                          fontFamily: F.body,
                          fontSize: 10,
                          fontWeight: 800,
                          color: C.textLight,
                          textTransform: "uppercase",
                          marginBottom: 4,
                        }}
                      >
                        Therapist Notes
                      </p>
                      <p
                        style={{
                          fontFamily: F.body,
                          fontSize: 13,
                          color: C.textMid,
                        }}
                      >
                        {s.therapistNotes}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 8, paddingLeft: 44 }}>
        <Btn onClick={onNewSession} style={{ width: "100%" }}>
          + Book New Session
        </Btn>
      </div>
    </div>
  );
};

// Welcome screen
const WelcomeScreen = ({ onStart, sessions, onHistory, onPreFill }) => {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <div
        style={{
          background: `linear-gradient(155deg,${C.green} 0%,#1E4230 100%)`,
          padding: "28px 20px 24px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 5 }}>🌿</div>
        <h1
          style={{
            fontFamily: F.display,
            fontSize: 32,
            fontWeight: 600,
            color: "#fff",
            margin: 0,
            lineHeight: 1.1,
          }}
        >
          BodyMap
        </h1>
        <p
          style={{
            fontFamily: F.body,
            fontSize: 12,
            color: C.sagePale,
            marginTop: 4,
            opacity: 0.9,
          }}
        >
          Never re-explain your preferences again
        </p>
      </div>
      <div style={{ padding: "16px 20px 40px" }}>
        <Card style={{ padding: "13px" }}>
          <p
            style={{
              fontFamily: F.body,
              fontSize: 10,
              fontWeight: 800,
              color: C.green,
              marginBottom: 9,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Start Your First Session
          </p>
          <Inp
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ padding: "9px 11px", fontSize: 14, marginBottom: 7 }}
          />
          <Inp
            placeholder="Phone or email"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            style={{ padding: "9px 11px", fontSize: 14, marginBottom: 10 }}
          />
          <Btn
            onClick={() =>
              onStart({ name: name.trim(), contact: contact.trim() })
            }
            
            disabled={!name.trim() || !contact.trim()}
            style={{ width: "100%" }}
          >
            Create My Body Map →
          </Btn>
          <p
            style={{
              fontFamily: F.body,
              fontSize: 10,
              color: C.textLight,
              textAlign: "center",
              marginTop: 7,
            }}
          >
            🔒 Only shared with your therapist
          </p>
        </Card>

      </div>
    </div>
  );
};

// Body map screen
const BMScreen = ({
  title,
  subtitle,
  step,
  regions,
  selections,
  onToggle,
  mode,
  setMode,
  onNext,
  onBack,
  sessions,
  onApply,
}) => (
  <div
    style={{ background: C.bg, padding: "18px 20px 40px", minHeight: "100vh" }}
  >
    <Step step={step} />
    <h2
      style={{
        fontFamily: F.display,
        fontSize: 26,
        fontWeight: 600,
        color: C.green,
        textAlign: "center",
        marginBottom: 4,
      }}
    >
      {title}
    </h2>
    <p
      style={{
        fontFamily: F.body,
        fontSize: 13,
        color: C.textLight,
        textAlign: "center",
        marginBottom: 16,
      }}
    >
      {subtitle}
    </p>
    {(step === 1 || step === 2) && sessions.length >= 3 && (
      <Prediction sessions={sessions} onApply={onApply} />
    )}
    <MT mode={mode} setMode={setMode} />
    <div
      style={{
        background: mode === "focus" ? `${C.focus}12` : `${C.avoid}12`,
        border: `1px solid ${mode === "focus" ? C.focus : C.avoid}40`,
        borderRadius: 12,
        padding: "9px 14px",
        marginBottom: 14,
        textAlign: "center",
      }}
    >
      <p
        style={{
          fontFamily: F.body,
          fontSize: 13,
          fontWeight: 700,
          color: mode === "focus" ? C.focus : C.avoid,
        }}
      >
        {mode === "focus"
          ? "🟢 Tap areas where you want focus — tap again to clear"
          : "🔴 Tap areas to avoid — tap again to clear"}
      </p>
    </div>
    <Card style={{ padding: 14 }}>
      <BMSVG
        regions={regions}
        selections={selections}
        onToggle={onToggle}
        scale={1.06}
      />
      <div
        style={{
          display: "flex",
          gap: 14,
          justifyContent: "center",
          marginTop: 10,
        }}
      >
        {[
          { color: C.focus, l: "Focus" },
          { color: C.avoid, l: "Avoid" },
          { color: C.neutral, l: "Tap to mark" },
        ].map(({ color, l }) => (
          <div
            key={l}
            style={{ display: "flex", alignItems: "center", gap: 5 }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: color,
              }}
            />
            <span
              style={{
                fontFamily: F.body,
                fontSize: 11,
                fontWeight: 700,
                color: C.textMid,
              }}
            >
              {l}
            </span>
          </div>
        ))}
      </div>
      <AT regions={regions} selections={selections} />
    </Card>
    <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
      {onBack && (
        <Btn ghost onClick={onBack}>
          ← Back
        </Btn>
      )}
      <Btn onClick={onNext} style={{ flex: 2 }}>
        {step === 2 ? "Next: Preferences →" : "Next: Back of Body →"}
      </Btn>
    </div>
  </div>
);

// Summary screen
const SummaryScreen = ({ clientInfo, bodyMap, onViewTherapist, onReset }) => {
  const [copied, setCopied] = useState(false);
  const link = `bodymap.app/s/${clientInfo.name
    .toLowerCase()
    .replace(/\s+/g, "")}-${Date.now().toString(36)}`;
  const fn = Object.values(bodyMap).filter((v) => v === "focus").length;
  const an = Object.values(bodyMap).filter((v) => v === "avoid").length;
  const copy = () => {
    try {
      navigator.clipboard.writeText(`https://${link}`);
    } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };
  return (
    <div
      style={{
        background: C.bg,
        padding: "32px 20px 60px",
        minHeight: "100vh",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 22 }}>
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: "50%",
            background: C.sagePale,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 32,
            margin: "0 auto 10px",
          }}
        >
          ✅
        </div>
        <h1
          style={{
            fontFamily: F.display,
            fontSize: 28,
            fontWeight: 600,
            color: C.green,
          }}
        >
          You're all set!
        </h1>
        <p
          style={{
            fontFamily: F.body,
            fontSize: 13,
            color: C.textLight,
            marginTop: 5,
          }}
        >
          Your preferences are ready to share
        </p>
      </div>
      <Card style={{ padding: 14 }}>
        <h3
          style={{
            fontFamily: F.body,
            fontSize: 12,
            fontWeight: 800,
            color: C.green,
            marginBottom: 12,
            textTransform: "uppercase",
          }}
        >
          Your Body Map
        </h3>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <Mini regions={FRONT_REGIONS} selections={bodyMap} label="Front" />
          <Mini regions={BACK_REGIONS} selections={bodyMap} label="Back" />
        </div>
        <div
          style={{
            display: "flex",
            gap: 16,
            justifyContent: "center",
            marginTop: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div
              style={{
                width: 9,
                height: 9,
                borderRadius: 2,
                background: C.focus,
              }}
            />
            <span
              style={{ fontFamily: F.body, fontSize: 11, color: C.textMid }}
            >
              {fn} focus
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div
              style={{
                width: 9,
                height: 9,
                borderRadius: 2,
                background: C.avoid,
              }}
            />
            <span
              style={{ fontFamily: F.body, fontSize: 11, color: C.textMid }}
            >
              {an} avoid
            </span>
          </div>
        </div>
      </Card>
      <Card style={{ padding: 14 }}>
        <h3
          style={{
            fontFamily: F.body,
            fontSize: 12,
            fontWeight: 800,
            color: C.green,
            marginBottom: 3,
            textTransform: "uppercase",
          }}
        >
          Share with Your Therapist
        </h3>
        <p
          style={{
            fontFamily: F.body,
            fontSize: 12,
            color: C.textLight,
            marginBottom: 12,
          }}
        >
          Text, email, or show them this link before your appointment
        </p>
        <div style={{ display: "flex", gap: 7, marginBottom: 12 }}>
          {[
            { i: "💬", l: "Text" },
            { i: "📧", l: "Email" },
            {
              i: copied ? "✅" : "📋",
              l: copied ? "Copied" : "Copy",
              fn: copy,
            },
          ].map(({ i, l, fn: f }) => (
            <button
              key={l}
              onClick={f || undefined}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                padding: "10px 3px",
                borderRadius: 12,
                border: `2px solid ${C.border}`,
                background: C.white,
                cursor: "pointer",
              }}
            >
              <span style={{ fontSize: 18 }}>{i}</span>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: C.textMid,
                  fontFamily: F.body,
                }}
              >
                {l}
              </span>
            </button>
          ))}
        </div>
        <div
          style={{
            background: C.bg,
            borderRadius: 9,
            padding: "8px 11px",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span style={{ fontSize: 13 }}>🔗</span>
          <span
            style={{
              fontFamily: F.body,
              fontSize: 10,
              color: C.textMid,
              flex: 1,
              wordBreak: "break-all",
            }}
          >
            {link}
          </span>
        </div>
      </Card>
      <Btn
        onClick={onViewTherapist}
        style={{ width: "100%", marginBottom: 10 }}
      >
        👁 Preview: What Your Therapist Sees
      </Btn>
      <Btn ghost onClick={onReset} style={{ width: "100%" }}>
        ← Back to Home
      </Btn>
    </div>
  );
};

// Main App
export default function BodyMapApp({ therapistName = "Your Therapist", onSubmit = null, getLastSession = null }) {
  const [screen, setScreen] = useState("welcome");
  const [mode, setMode] = useState("focus");
  const [clientInfo, setCI] = useState({ name: "", contact: "" });
  const [bodyMap, setBM] = useState({});
  const [prefs, setPrefs] = useState({ ...DEFAULT_PREFS });
  const [notes, setNotes] = useState("");
  const [consent, setConsent] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [lastSession, setLastSession] = useState(null);
  const [checkingReturn, setCheckingReturn] = useState(false);

  useEffect(() => {
    const l = document.createElement("link");
    l.href =
      "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Nunito:wght@400;500;600;700;800&display=swap";
    l.rel = "stylesheet";
    document.head.appendChild(l);
    try {
      setSessions(JSON.parse(localStorage.getItem("bodymap-sessions") || "[]"));
    } catch {}
    return () => {
      try {
        document.head.removeChild(l);
      } catch {}
    };
  }, []);

  const toggle = (id) =>
    setBM((p) => {
      if (!p[id]) return { ...p, [id]: mode };
      if (p[id] === mode) {
        const n = { ...p };
        delete n[id];
        return n;
      }
      return { ...p, [id]: mode };
    });

  const handlePreFill = (last) => {
    setBM({ ...last.bodyMap });
    setPrefs({ ...DEFAULT_PREFS, ...last.prefs });
    if (last.clientInfo) setCI({ ...last.clientInfo });
    setScreen("front");
  };

  const onStart = (info) => {
    setCI(info);
    setLastSession(null);
    setScreen("front");
    if (getLastSession && info.contact) {
      setTimeout(() => {
        getLastSession(info.contact).then(last => {
          if (last) setLastSession(last);
        }).catch(() => {});
      }, 100);
    }
  };

  const applyPrefill = (last) => {
    setBM(last.bodyMap || {});
    setPrefs(prev => ({ ...prev, ...(last.prefs || {}) }));
    setScreen("front");
  };

  const handleApply = () => {
    const p = buildPattern(sessions);
    if (!p) return;
    const dm = {};
    p.topFocus.slice(0, 3).forEach((f) => {
      const r = ALL_REGIONS.find((r) => r.label === f.label);
      if (r) dm[r.id] = "focus";
    });
    p.topAvoid.slice(0, 2).forEach((a) => {
      const r = ALL_REGIONS.find((r) => r.label === a.label);
      if (r) dm[r.id] = "avoid";
    });
    setBM(dm);
    setPrefs((prev) => ({
      ...prev,
      pressure: p.avgPressure,
      goal: p.topGoal || prev.goal,
    }));
  };

  const handleSend = () => {
    const { hasEarned } = getLoyalty(sessions);
    const s = {
      id: Date.now(),
      date: new Date().toISOString(),
      clientInfo,
      bodyMap,
      prefs,
      notes,
      therapistNotes: "",
      isFreeSession: hasEarned,
    };
    const upd = [s, ...sessions].slice(0, 50);
    setSessions(upd);
    try {
      localStorage.setItem("bodymap-sessions", JSON.stringify(upd));
    } catch {}
    
    // If onSubmit prop is provided, call it with intake data
    if (onSubmit) {
      // Extract focus and avoid areas
      const frontFocus = Object.keys(bodyMap).filter(k => k.startsWith('f-') && bodyMap[k] === 'focus');
      const frontAvoid = Object.keys(bodyMap).filter(k => k.startsWith('f-') && bodyMap[k] === 'avoid');
      const backFocus = Object.keys(bodyMap).filter(k => k.startsWith('b-') && bodyMap[k] === 'focus');
      const backAvoid = Object.keys(bodyMap).filter(k => k.startsWith('b-') && bodyMap[k] === 'avoid');
      
      onSubmit({
        clientName: clientInfo.name,
        clientPhone: clientInfo.contact,
        clientEmail: null,
        frontFocus,
        frontAvoid,
        backFocus,
        backAvoid,
        pressure: prefs.pressure,
        goal: prefs.goal,
        tableTemp: prefs.tableTemp,
        roomTemp: prefs.roomTemp,
        music: prefs.music,
        lighting: prefs.lighting,
        conversation: prefs.conversation,
        draping: prefs.draping,
        oilPref: prefs.oilPref,
        medFlag: prefs.medFlag
      });
    } else {
      // Default behavior - show summary screen
      setScreen("summary");
    }
  };

  const reset = () => {
    setBM({});
    setNotes("");
    setConsent(false);
    setPrefs({ ...DEFAULT_PREFS });
    setScreen("welcome");
  };

  const screens = {
    welcome: (
      <WelcomeScreen
        onStart={onStart}
        sessions={sessions}
        onHistory={() => setScreen("history")}
        checkingReturn={checkingReturn}
        onPreFill={handlePreFill}
      />
    ),
    front: (
      <div>
        {lastSession && (
          <div style={{ background: "#FDF6E8", border: "1.5px solid #D4B070", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div>
              <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: 800, color: "#B87840", margin: 0 }}>✦ Welcome back{clientInfo?.name ? `, ${clientInfo.name.split(" ")[0]}` : ""}!</p>
              <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 11, color: "#7A9485", margin: "2px 0 0" }}>Tap "Use Last Session" to pre-fill your preferences</p>
            </div>
            <button onClick={() => applyPrefill(lastSession)} style={{ background: "#B87840", color: "#fff", border: "none", padding: "8px 14px", borderRadius: 50, fontFamily: "'Nunito', sans-serif", fontSize: 12, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>
              Use Last Session
            </button>
          </div>
        )}
        <BMScreen
          title="Front of Body"
          subtitle="Tap any area to mark as focus or avoid"
          step={1}
          regions={FRONT_REGIONS}
          selections={bodyMap}
          onToggle={toggle}
          mode={mode}
          setMode={setMode}
          onNext={() => setScreen("back")}
          onBack={null}
          sessions={sessions}
          onApply={handleApply}
        />
      </div>
    ),
    back: (
      <div>
        {lastSession && (
          <div style={{ background: "#FDF6E8", border: "1.5px solid #D4B070", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div>
              <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: 800, color: "#B87840", margin: 0 }}>✦ Welcome back{clientInfo?.name ? `, ${clientInfo.name.split(" ")[0]}` : ""}!</p>
              <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 11, color: "#7A9485", margin: "2px 0 0" }}>Tap "Use Last Session" to pre-fill your preferences</p>
            </div>
            <button onClick={() => applyPrefill(lastSession)} style={{ background: "#B87840", color: "#fff", border: "none", padding: "8px 14px", borderRadius: 50, fontFamily: "'Nunito', sans-serif", fontSize: 12, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>
              Use Last Session
            </button>
          </div>
        )}
        <BMScreen
          title="Back of Body"
          subtitle="Continue marking focus and avoid areas"
          step={2}
          regions={BACK_REGIONS}
          selections={bodyMap}
          onToggle={toggle}
          mode={mode}
          setMode={setMode}
          onNext={() => setScreen("prefs")}
          onBack={() => setScreen("front")}
          sessions={sessions}
          onApply={handleApply}
        />
      </div>
    ),
    prefs: (
      <div>
        {lastSession && (
          <div style={{ background: "#FDF6E8", border: "1.5px solid #D4B070", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div>
              <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: 800, color: "#B87840", margin: 0 }}>✦ Welcome back{clientInfo?.name ? `, ${clientInfo.name.split(" ")[0]}` : ""}!</p>
              <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 11, color: "#7A9485", margin: "2px 0 0" }}>Tap "Use Last Session" to pre-fill your preferences</p>
            </div>
            <button onClick={() => applyPrefill(lastSession)} style={{ background: "#B87840", color: "#fff", border: "none", padding: "8px 14px", borderRadius: 50, fontFamily: "'Nunito', sans-serif", fontSize: 12, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>
              Use Last Session
            </button>
          </div>
        )}
        <PrefScreen
          prefs={prefs}
          setPrefs={setPrefs}
          notes={notes}
          setNotes={setNotes}
          consent={consent}
          setConsent={setConsent}
          onNext={handleSend}
          onBack={() => setScreen("back")}
        />
      </div>
    ),
    summary: (
      <SummaryScreen
        clientInfo={clientInfo}
        bodyMap={bodyMap}
        onViewTherapist={() => setScreen("therapist")}
        onReset={reset}
      />
    ),
    therapist: (
      <TherapistView
        clientInfo={clientInfo}
        bodyMap={bodyMap}
        prefs={prefs}
        notes={notes}
        sessions={sessions}
        onBack={() => setScreen("summary")}
        onReview={() => setScreen("review")}
      />
    ),
    review: <ReviewScreen clientInfo={clientInfo} onDone={reset} />,
    history: (
      <HistoryScreen
        sessions={sessions}
        clientName={clientInfo.name}
        onBack={() => setScreen("welcome")}
        onNewSession={reset}
      />
    ),
  };

  return (
    <div
      style={{
        maxWidth: 480,
        margin: "0 auto",
        minHeight: "100vh",
        background: C.bg,
        fontFamily: F.body,
      }}
    >
      {screens[screen] || screens.welcome}
    </div>
  );
}
