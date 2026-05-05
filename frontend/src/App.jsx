import { useState, useRef, useEffect } from "react";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_URL || "";

/* ── Colour tokens ─────────────────────────────────────────────────────────── */
const C = {
  bg:      "#0d1117",
  card:    "#161b22",
  card2:   "#1c2230",
  border:  "#21262d",
  border2: "#30363d",
  text:    "#e6edf3",
  muted:   "#8b949e",
  green:   "#3fb950",
  red:     "#f85149",
  amber:   "#d29922",
  blue:    "#58a6ff",
  purple:  "#bc8cff",
};

/* ── Label helpers ─────────────────────────────────────────────────────────── */
const AGE_LABEL = {1:"18-24",2:"25-29",3:"30-34",4:"35-39",5:"40-44",
                   6:"45-49",7:"50-54",8:"55-59",9:"60-64",10:"65-69",
                   11:"70-74",12:"75-79",13:"80+"};
const GENHLTH_LABEL = {1:"Excellent",2:"Very Good",3:"Good",4:"Fair",5:"Poor"};
const BMI_LABEL = (b) => b < 18.5 ? "Underweight" : b < 25 ? "Normal" : b < 30 ? "Overweight" : "Obese";

/* ── Persistent user ID via localStorage ────────────────────────────────────── */
function getOrCreateUserId() {
  let uid = localStorage.getItem("diabetes_uid");
  if (!uid) {
    uid = "user_" + Math.random().toString(36).slice(2, 9);
    localStorage.setItem("diabetes_uid", uid);
  }
  return uid;
}

/* ── Number input ──────────────────────────────────────────────────────────── */
function NumInput({ label, value, onChange, min, max, step = 1, hint, icon, sub }) {
  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10,
                  padding:"14px 16px", display:"flex", justifyContent:"space-between",
                  alignItems:"center", gap:12 }}>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:3 }}>
          <span style={{ fontSize:15 }}>{icon}</span>
          <span style={{ fontSize:13, fontWeight:600, color:C.text }}>{label}</span>
        </div>
        {hint && <div style={{ fontSize:11, color:C.muted, paddingLeft:22 }}>{hint}</div>}
        {sub  && <div style={{ fontSize:11, color:C.blue,  paddingLeft:22, marginTop:2 }}>{sub}</div>}
      </div>
      <input type="number" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width:76, padding:"7px 10px", borderRadius:7, textAlign:"center",
                 border:`1.5px solid ${C.border2}`, background:C.bg,
                 color:C.text, fontSize:15, fontWeight:700,
                 fontFamily:"monospace", outline:"none" }}
      />
    </div>
  );
}

/* ── Toggle input ──────────────────────────────────────────────────────────── */
function Toggle({ label, value, onChange, hint, icon }) {
  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10,
                  padding:"14px 16px", display:"flex", justifyContent:"space-between",
                  alignItems:"center", gap:12 }}>
      <div>
        <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:3 }}>
          <span style={{ fontSize:15 }}>{icon}</span>
          <span style={{ fontSize:13, fontWeight:600, color:C.text }}>{label}</span>
        </div>
        {hint && <div style={{ fontSize:11, color:C.muted, paddingLeft:22 }}>{hint}</div>}
      </div>
      <button onClick={() => onChange(value === 1 ? 0 : 1)} style={{
        display:"flex", alignItems:"center", gap:7, border:`1.5px solid ${value ? C.blue : C.border2}`,
        borderRadius:8, padding:"6px 14px", cursor:"pointer",
        color: value ? C.blue : C.muted, background: value ? "rgba(88,166,255,.1)" : "transparent",
        fontSize:12, fontFamily:"inherit", transition:"all .18s", flexShrink:0,
      }}>
        <span style={{ width:30, height:16, borderRadius:8, background: value ? C.blue : "#21262d",
                        position:"relative", display:"inline-block", transition:"background .18s" }}>
          <span style={{ position:"absolute", top:2, left: value ? 14 : 2,
                          width:12, height:12, borderRadius:"50%",
                          background:"#fff", transition:"left .18s" }}/>
        </span>
        {value ? "Yes" : "No"}
      </button>
    </div>
  );
}

/* ── Speedometer gauge ─────────────────────────────────────────────────────── */
function Speedometer({ probability }) {
  const cx = 110, cy = 92, r = 80, sw = 14;

  const pt = (frac) => {
    const a = Math.PI * (1 - frac);
    return [+(cx + r * Math.cos(a)).toFixed(2), +(cy - r * Math.sin(a)).toFixed(2)];
  };

  // Counterclockwise SVG arc from pt(start) to pt(end) going through the top
  const arc = (s, e) => {
    const [sx, sy] = pt(s);
    const [ex, ey] = pt(e);
    return `M ${sx} ${sy} A ${r} ${r} 0 0 0 ${ex} ${ey}`;
  };

  const p = Math.max(0.001, Math.min(0.999, probability));
  const [nx, ny] = pt(p);
  const zoneColor = p >= 0.75 ? C.red : p >= 0.5 ? C.amber : p >= 0.25 ? C.blue : C.green;
  const riskLabel = p >= 0.75 ? "Very High Risk" : p >= 0.5 ? "High Risk"
                  : p >= 0.25 ? "Moderate Risk" : "Low Risk";

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"8px 0" }}>
      <svg width={220} height={118} viewBox="0 0 220 118">
        {/* Background arc */}
        <path d={arc(0, 1)} fill="none" stroke={C.border2} strokeWidth={sw} />
        {/* Zone arcs */}
        <path d={arc(0,    0.25)} fill="none" stroke={C.green} strokeWidth={sw} opacity={0.35} />
        <path d={arc(0.25, 0.5)}  fill="none" stroke={C.blue}  strokeWidth={sw} opacity={0.35} />
        <path d={arc(0.5,  0.75)} fill="none" stroke={C.amber} strokeWidth={sw} opacity={0.35} />
        <path d={arc(0.75, 1)}    fill="none" stroke={C.red}   strokeWidth={sw} opacity={0.35} />
        {/* Progress fill */}
        {p > 0.005 && <path d={arc(0, p)} fill="none" stroke={zoneColor} strokeWidth={sw} />}
        {/* Needle */}
        <line x1={cx} y1={cy} x2={nx} y2={ny}
              stroke={C.text} strokeWidth={2.5} strokeLinecap="round"/>
        <circle cx={cx} cy={cy} r={5} fill={C.text} />
        {/* Probability text */}
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize={22} fontWeight={700}
              fill={zoneColor} fontFamily="monospace">{Math.round(p * 100)}%</text>
        <text x={cx} y={cy + 30} textAnchor="middle" fontSize={10} fill={C.muted}>{riskLabel}</text>
        {/* Edge labels */}
        <text x={30}  y={cy + 4} fontSize={9} fill={C.muted} textAnchor="middle">Low</text>
        <text x={190} y={cy + 4} fontSize={9} fill={C.muted} textAnchor="middle">High</text>
      </svg>
    </div>
  );
}

/* ── SHAP explanation panel ────────────────────────────────────────────────── */
const FNAME = {
  HeartDiseaseorAttack:"Heart Disease", HvyAlcoholConsump:"Heavy Alcohol",
  HighBP:"High BP", HighChol:"High Cholesterol", GenHlth:"General Health",
  PhysHlth:"Physical Health", MentHlth:"Mental Health", DiffWalk:"Difficulty Walking",
};

function SHAPPanel({ explanation, summary }) {
  if (!explanation || explanation.length === 0) return null;
  const maxImp = Math.max(...explanation.map(f => f.impact), 0.001);
  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12,
                  padding:"18px 20px" }}>
      <div style={{ fontSize:12, fontWeight:600, marginBottom:8, color:C.text }}>
        SHAP Explanation — Why this prediction?
      </div>
      {summary && (
        <div style={{ fontSize:12, color:C.muted, marginBottom:14, lineHeight:1.6,
                      padding:"9px 12px", background:C.card2, borderRadius:8,
                      border:`1px solid ${C.border}`, fontStyle:"italic" }}>
          {summary}
        </div>
      )}
      <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
        {explanation.map((f, i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:11, color:C.muted, minWidth:124, flexShrink:0 }}>
              {FNAME[f.feature] || f.feature}
            </span>
            <div style={{ flex:1, height:6, background:C.border2, borderRadius:3 }}>
              <div style={{
                height:"100%", borderRadius:3,
                width:`${(f.impact / maxImp) * 100}%`,
                background: f.direction === "increases" ? C.red : C.green,
                transition:"width .7s ease",
              }}/>
            </div>
            <span style={{
              fontSize:10, fontWeight:700, minWidth:54, textAlign:"right",
              color: f.direction === "increases" ? C.red : C.green,
            }}>
              {f.direction === "increases" ? "↑" : "↓"} risk
            </span>
            <span style={{ fontSize:10, color:C.muted, fontFamily:"monospace",
                           minWidth:40, textAlign:"right" }}>
              {f.impact.toFixed(3)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── SVG Doughnut ──────────────────────────────────────────────────────────── */
function Doughnut({ segments }) {
  const r = 52, cx = 70, cy = 70, sw = 18;
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const circ  = 2 * Math.PI * r;
  let offset  = 0;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:20, flexWrap:"wrap" }}>
      <svg width={140} height={140}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.border2} strokeWidth={sw}/>
        {segments.map((s, i) => {
          const dash = (s.value / total) * circ;
          const el = (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none"
              stroke={s.color} strokeWidth={sw}
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-offset}
              style={{ transform:"rotate(-90deg)", transformOrigin:`${cx}px ${cy}px` }}
            />
          );
          offset += dash;
          return el;
        })}
      </svg>
      <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
        {segments.map((s, i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:8, fontSize:12 }}>
            <span style={{ width:10, height:10, borderRadius:2, background:s.color,
                            flexShrink:0, display:"inline-block" }}/>
            <span style={{ color:C.muted }}>{s.label}</span>
            <span style={{ color:C.text, fontFamily:"monospace", marginLeft:"auto",
                            paddingLeft:12 }}>{s.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── SVG Radar ─────────────────────────────────────────────────────────────── */
function Radar({ axes, values, color }) {
  const n = axes.length, cx = 100, cy = 100, maxR = 72;
  const pt = (v, i) => {
    const a = i * (2 * Math.PI / n) - Math.PI / 2;
    return [cx + maxR * (v / 100) * Math.cos(a), cy + maxR * (v / 100) * Math.sin(a)];
  };
  const grid = [33, 66, 100];
  return (
    <svg width={200} height={200} viewBox="0 0 200 200">
      {grid.map(g => (
        <polygon key={g} points={axes.map((_, i) => pt(g, i).join(",")).join(" ")}
          fill="none" stroke={C.border2} strokeWidth={0.8}/>
      ))}
      {axes.map((_, i) => {
        const [x, y] = pt(100, i);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={C.border2} strokeWidth={0.8}/>;
      })}
      <polygon points={values.map((v, i) => pt(v, i).join(",")).join(" ")}
        fill={color + "30"} stroke={color} strokeWidth={2}/>
      {axes.map((a, i) => {
        const [x, y] = pt(122, i);
        return (
          <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
            fontSize={9} fill={C.muted} fontFamily="sans-serif">{a}</text>
        );
      })}
    </svg>
  );
}

/* ── Confidence bar ────────────────────────────────────────────────────────── */
function ConfBar({ pct, diabetic }) {
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:11,
                    color:C.muted, marginBottom:6 }}>
        <span>Confidence — {diabetic ? "Diabetic" : "Not Diabetic"}</span>
        <span style={{ color:C.text, fontFamily:"monospace", fontWeight:700 }}>{pct}%</span>
      </div>
      <div style={{ position:"relative", height:10, borderRadius:5, overflow:"hidden",
                    background:`linear-gradient(to right,${C.green},${C.amber},${C.red})` }}>
        <div style={{ position:"absolute", top:0, left:0, right:0, bottom:0,
                      background:C.bg, clipPath:`inset(0 0 0 ${pct}%)` }}/>
      </div>
      <div style={{ position:"relative", height:14 }}>
        <div style={{ position:"absolute", left:`${pct}%`, transform:"translateX(-50%)",
                      width:2, height:14, background:C.text, borderRadius:1 }}/>
      </div>
    </div>
  );
}

/* ── Feature importance table ──────────────────────────────────────────────── */
function ImportanceTable({ importances }) {
  const entries = Object.entries(importances).slice(0, 6);
  const max = entries[0]?.[1] || 1;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
      {entries.map(([k, v]) => (
        <div key={k} style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:11, color:C.muted, minWidth:100, flexShrink:0 }}>
            {FNAME[k] || k}
          </span>
          <div style={{ flex:1, height:5, background:C.border2, borderRadius:3 }}>
            <div style={{ height:"100%", borderRadius:3, width:`${(v/max)*100}%`,
                          background:`linear-gradient(90deg,${C.blue},${C.purple})`,
                          transition:"width .7s ease" }}/>
          </div>
          <span style={{ fontSize:11, color:C.text, fontFamily:"monospace",
                          minWidth:34, textAlign:"right" }}>{v.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

function GlobalImportancePanel({ items }) {
  if (!items || items.length === 0) return null;
  const max = items[0]?.importance || 1;

  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"18px 20px" }}>
      <div style={{ fontSize:12, fontWeight:600, marginBottom:14, color:C.text }}>
        Global feature importance
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {items.map((item) => (
          <div key={item.feature} style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:11, color:C.muted, minWidth:110, flexShrink:0 }}>
              {FNAME[item.feature] || item.feature}
            </span>
            <div style={{ flex:1, height:6, background:C.border2, borderRadius:3 }}>
              <div style={{
                height:"100%", borderRadius:3,
                width:`${(item.importance / max) * 100}%`,
                background:`linear-gradient(90deg,${C.blue},${C.purple})`,
              }}/>
            </div>
            <span style={{ fontSize:11, color:C.text, fontFamily:"monospace", minWidth:38, textAlign:"right" }}>
              {item.importance.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Metric card ───────────────────────────────────────────────────────────── */
function MetricCard({ icon, value, sub, label }) {
  return (
    <div style={{ background:C.card2, border:`1px solid ${C.border}`, borderRadius:10,
                  padding:"14px 16px", flex:1, minWidth:100 }}>
      <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>{icon} {label}</div>
      <div style={{ fontSize:22, fontWeight:700, color:C.text, fontFamily:"monospace" }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:C.blue, marginTop:3 }}>{sub}</div>}
    </div>
  );
}

/* ── Risk tag ──────────────────────────────────────────────────────────────── */
function Tag({ label, color }) {
  const map = { red:[C.red,"rgba(248,81,73,.12)"], amber:[C.amber,"rgba(210,153,34,.12)"],
                blue:[C.blue,"rgba(88,166,255,.12)"] };
  const [fg, bg] = map[color] || map.blue;
  return (
    <span style={{ fontSize:11, padding:"3px 10px", borderRadius:12,
                   background:bg, color:fg, border:`1px solid ${fg}44`, fontWeight:600 }}>
      {label}
    </span>
  );
}

/* ── API-driven Recommendations ────────────────────────────────────────────── */
function RecommendationList({ recommendations }) {
  if (!recommendations || recommendations.length === 0) return null;
  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12,
                  padding:"18px 20px" }}>
      <div style={{ fontSize:12, fontWeight:600, marginBottom:14, color:C.text }}>
        Personalised Recommendations
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {recommendations.map((rec, i) => (
          <div key={i} style={{ display:"flex", gap:10 }}>
            <span style={{ color:C.blue, fontSize:14, marginTop:1, flexShrink:0 }}>•</span>
            <span style={{ fontSize:12, color:C.muted, lineHeight:1.65 }}>{rec}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Data drift warning ────────────────────────────────────────────────────── */
function DriftWarning() {
  return (
    <div style={{ display:"flex", alignItems:"flex-start", gap:10, marginTop:12,
                  padding:"10px 14px", background:"rgba(210,153,34,.1)",
                  border:`1px solid rgba(210,153,34,.35)`, borderRadius:8 }}>
      <span style={{ fontSize:16, flexShrink:0 }}>⚠️</span>
      <div>
        <div style={{ fontSize:12, fontWeight:700, color:C.amber, marginBottom:2 }}>
          Data Drift Detected
        </div>
        <div style={{ fontSize:11, color:C.muted, lineHeight:1.6 }}>
          One or more of your input values are statistically unusual compared to the
          training distribution. Prediction confidence may be reduced.
        </div>
      </div>
    </div>
  );
}

/* ── History Dashboard (fetches from API) ──────────────────────────────────── */
function HistoryDashboard({ userId }) {
  const [history, setHistory]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [fetched, setFetched]   = useState(false);

  useEffect(() => {
    async function fetchHistory() {
      setLoading(true);
      try {
        const res = await fetch(
          `${API_BASE}/user-history?user_id=${encodeURIComponent(userId)}&limit=30`
        );
        if (res.ok) {
          const data = await res.json();
          setHistory(data.history || []);
        }
      } catch (e) {
        console.error("History fetch failed:", e);
      }
      setLoading(false);
      setFetched(true);
    }
    fetchHistory();
  }, [userId]);

  if (loading) {
    return (
      <div style={{ textAlign:"center", padding:"48px 20px", color:C.muted, fontSize:13 }}>
        Loading your history…
      </div>
    );
  }

  if (fetched && history.length === 0) {
    return (
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12,
                    padding:"40px 20px", textAlign:"center" }}>
        <div style={{ fontSize:32, marginBottom:12 }}>📋</div>
        <div style={{ fontSize:14, fontWeight:600, color:C.text, marginBottom:6 }}>
          No predictions yet
        </div>
        <div style={{ fontSize:12, color:C.muted }}>
          Run a prediction on the Predictor tab. Your results will appear here.
        </div>
        <div style={{ fontSize:11, color:C.border2, marginTop:10, fontFamily:"monospace" }}>
          User ID: {userId}
        </div>
      </div>
    );
  }

  const reversed = [...history].reverse();
  const avgProb  = history.length
    ? (history.reduce((s, h) => s + h.probability, 0) / history.length * 100).toFixed(1)
    : 0;
  const diabeticCount = history.filter(h => h.prediction === 1).length;
  const latestRecommendations = history[0]?.recommendations || [];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      {/* Summary stats */}
      <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
        <MetricCard icon="📊" label="Total predictions"
          value={history.length} sub={`User: ${userId}`}/>
        <MetricCard icon="📈" label="Average risk"
          value={`${avgProb}%`} sub="across all sessions"/>
        <MetricCard icon="⚠️" label="High-risk predictions"
          value={diabeticCount} sub={`${((diabeticCount/history.length)*100).toFixed(0)}% of total`}/>
      </div>

      {/* Trend chart */}
      {history.length > 1 && (
        <div style={{ background:C.card, border:`1px solid ${C.border}`,
                      borderRadius:12, padding:"18px 20px" }}>
          <div style={{ fontSize:12, fontWeight:600, marginBottom:14, color:C.text }}>
            Risk Probability Trend
          </div>
          <div style={{ display:"flex", alignItems:"flex-end", gap:3, height:80, marginBottom:8 }}>
            {reversed.map((h, i) => (
              <div key={i}
                   title={`${h.timestamp.slice(0,16).replace("T"," ")}: ${(h.probability*100).toFixed(1)}%`}
                   style={{
                     flex:1, minWidth:6, maxWidth:28,
                     height:`${Math.max(4, h.probability * 100)}%`,
                     borderRadius:"3px 3px 0 0",
                     background: h.prediction === 1 ? C.red : C.green,
                     transition:"height .5s ease", cursor:"default",
                   }}
              />
            ))}
          </div>
          <div style={{ display:"flex", justifyContent:"space-between",
                        fontSize:10, color:C.muted }}>
            <span>Earliest</span>
            <span>Latest</span>
          </div>
        </div>
      )}

      {latestRecommendations.length > 0 && (
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"18px 20px" }}>
          <div style={{ fontSize:12, fontWeight:600, marginBottom:14, color:C.text }}>
            Recommendations
          </div>
          <div style={{ display:"grid", gap:8 }}>
            {latestRecommendations.slice(0, 6).map((rec, i) => (
              <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                <span style={{ color:C.blue, fontSize:14, marginTop:1, flexShrink:0 }}>•</span>
                <span style={{ fontSize:12, color:C.muted, lineHeight:1.65 }}>{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prediction log */}
      <div style={{ background:C.card, border:`1px solid ${C.border}`,
                    borderRadius:12, padding:"18px 20px" }}>
        <div style={{ fontSize:12, fontWeight:600, marginBottom:14, color:C.text }}>
          Prediction Log
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {history.map((h, i) => (
            <div key={i} style={{
              display:"flex", flexWrap:"wrap", gap:8, alignItems:"center",
              padding:"9px 12px", background:C.card2, borderRadius:8,
              border:`1px solid ${C.border}`, fontSize:12,
            }}>
              <span style={{ color:C.muted, fontSize:10, fontFamily:"monospace", minWidth:130 }}>
                {h.timestamp.slice(0, 16).replace("T", " ")} UTC
              </span>
              <span style={{ fontWeight:700, color: h.prediction === 1 ? C.red : C.green }}>
                {h.prediction === 1 ? "Diabetic" : "Not Diabetic"}
              </span>
              <span style={{ fontFamily:"monospace", fontWeight:700, color:C.text }}>
                {(h.probability * 100).toFixed(1)}%
              </span>
              <span style={{
                fontSize:11, padding:"2px 9px", borderRadius:6,
                color:  h.risk_level === "Low" ? C.green
                      : h.risk_level === "Moderate" ? C.blue
                      : h.risk_level === "High" ? C.amber : C.red,
                background: h.risk_level === "Low" ? "rgba(63,185,80,.1)"
                           : h.risk_level === "Moderate" ? "rgba(88,166,255,.1)"
                           : h.risk_level === "High" ? "rgba(210,153,34,.1)"
                           : "rgba(248,81,73,.1)",
              }}>
                {h.risk_level}
              </span>
              {h.drift_detected && (
                <span style={{ fontSize:10, color:C.amber }}>⚠️ Drift</span>
              )}
              {h.shap_summary && (
                <span style={{ fontSize:11, color:C.muted, fontStyle:"italic",
                                flexBasis:"100%", paddingLeft:0, marginTop:2 }}>
                  {h.shap_summary}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Main App ──────────────────────────────────────────────────────────────── */
export default function App() {
  const [view, setView]   = useState("predictor"); // "predictor" | "history"
  const [userId]          = useState(getOrCreateUserId);
  const [globalImportance, setGlobalImportance] = useState([]);

  /* form state */
  const [v, setV] = useState({
    BMI:25.0, Age:7, GenHlth:3, MentHlth:0, PhysHlth:0,
    HighBP:0, HighChol:0, Stroke:0, HeartDiseaseorAttack:0,
    HvyAlcoholConsump:0, DiffWalk:0,
  });
  const [result,    setResult]  = useState(null);
  const [loading,   setLoading] = useState(false);
  const [error,     setError]   = useState(null);
  const [tab,       setTab]     = useState("ai");
  const [localHist, setLocalH]  = useState([]);
  const resultRef = useRef(null);

  useEffect(() => {
    async function loadGlobalImportance() {
      try {
        const res = await fetch(`${API_BASE}/feature-importance`);
        if (res.ok) {
          const data = await res.json();
          setGlobalImportance(data.feature_importances || []);
        }
      } catch (e) {
        console.error("Global importance fetch failed:", e);
      }
    }
    loadGlobalImportance();
  }, []);

  const set = (k, val) => setV(p => ({ ...p, [k]: val }));

  /* submit */
  async function handleSubmit() {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...v, user_id: userId }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.detail || "Prediction failed");
      }
      const data = await res.json();
      setResult(data);
      setLocalH(p => [...p, {
        time: new Date().toLocaleTimeString(),
        confidence: data.confidence,
        diabetic: data.prediction === 1,
        risk: data.risk_level,
      }]);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  /* derived */
  const bmiLabel   = BMI_LABEL(v.BMI);
  const ageLabel   = AGE_LABEL[v.Age] || v.Age;
  const genLabel   = GENHLTH_LABEL[v.GenHlth] || v.GenHlth;
  const confPct    = result ? result.confidence : 0;
  const isDiabetic = result?.prediction === 1;
  const riskColor  = isDiabetic ? C.red : C.green;

  const radarVals = result ? [
    v.HighBP * 100,
    Math.min(100, Math.max(0, ((v.BMI - 18.5) / 21.5) * 100)),
    ((v.GenHlth - 1) / 4) * 100,
    (v.Age / 13) * 100,
    (v.MentHlth / 30) * 100,
    ((v.HvyAlcoholConsump + v.DiffWalk) / 2) * 100,
  ] : [];

  const cardio = Math.max(5, Math.round(((v.HighBP + v.HighChol + v.Stroke + v.HeartDiseaseorAttack) / 4) * 100));
  const meta   = Math.max(5, Math.round(((v.BMI - 10) / 60 * 0.6 + (v.GenHlth - 1) / 4 * 0.4) * 100));
  const demo   = Math.max(5, Math.round((v.Age / 13) * 100));
  const life   = Math.max(5, Math.round(((v.HvyAlcoholConsump + v.DiffWalk) / 2) * 100));

  const tags = [];
  if (v.HighBP)               tags.push({ label:"High BP",          color:"red"   });
  if (v.HighChol)             tags.push({ label:"High Cholesterol",  color:"amber" });
  if (v.BMI >= 30)            tags.push({ label:`BMI ${v.BMI.toFixed(1)} — Obese`, color:"red"   });
  if (v.Stroke)               tags.push({ label:"Stroke History",    color:"red"   });
  if (v.HeartDiseaseorAttack) tags.push({ label:"Heart Disease",     color:"amber" });
  if (v.HvyAlcoholConsump)    tags.push({ label:"Heavy Alcohol",     color:"amber" });
  if (v.DiffWalk)             tags.push({ label:"Mobility Issues",   color:"blue"  });

  const PRECAUTIONS = [
    { title:"Monitor blood glucose regularly",  body:"Fasting glucose every 3 months if high risk." },
    { title:"Control blood pressure",           body:"Target BP below 130/80 mmHg." },
    { title:"Manage cholesterol levels",        body:"Target LDL below 100 mg/dL is recommended." },
    { title:"Regular HbA1c testing",            body:"Test every 3–6 months to track blood sugar trends." },
    { title:"Foot care routine",                body:"Check feet daily for cuts, blisters, or numbness." },
  ];
  const LIFESTYLE = [
    { title:"Quit smoking",          body:"Smoking doubles diabetes risk. Cessation programs improve outcomes." },
    { title:"Limit alcohol",         body:"Men: max 2 drinks/day. Women: max 1/day. Avoid binge drinking." },
    { title:"Sleep hygiene",         body:"7–9 hours nightly. Poor sleep raises insulin resistance significantly." },
    { title:"Hydration",             body:"8+ glasses of water daily. Replace sugary drinks with water or herbal tea." },
    { title:"Reduce processed food", body:"Low-GI diet stabilises blood sugar. Read labels for hidden sugars." },
  ];
  const DIET_PLAN = isDiabetic ? [
    { meal:"BREAKFAST",         food:"Whole grain toast · Peanut butter · Banana · Black coffee or green tea" },
    { meal:"MID-MORNING SNACK", food:"Fresh fruit · A few cashews" },
    { meal:"LUNCH",             food:"Grilled chicken or paneer · Salad · Whole wheat roti · Dal" },
    { meal:"EVENING SNACK",     food:"Sprouts chaat · Buttermilk" },
    { meal:"DINNER",            food:"Mixed vegetable curry · Brown rice · Curd" },
    { meal:"NUTRITION",         food:"Balanced macros · Portion control · Low glycaemic index foods · Regular meal times" },
  ] : [
    { meal:"BREAKFAST",         food:"Oats with berries · Boiled egg · Unsweetened green tea" },
    { meal:"MID-MORNING SNACK", food:"Greek yogurt · Mixed nuts" },
    { meal:"LUNCH",             food:"Quinoa bowl · Grilled salmon or tofu · Mixed greens · Olive oil dressing" },
    { meal:"EVENING SNACK",     food:"Walnuts · Banana · Herbal tea" },
    { meal:"DINNER",            food:"Vegetable stir-fry · Lean protein · Brown rice · Clear soup" },
    { meal:"NUTRITION",         food:"Balanced macros · Portion control · Low glycaemic index foods · Regular meal times" },
  ];

  /* render */
  return (
    <div className="app-shell" style={{ minHeight:"100vh", background:C.bg, color:C.text,
                  fontFamily:"'Inter', system-ui, sans-serif", padding:"0 0 60px" }}>

      {/* ── NAV ── */}
      <div style={{ borderBottom:`1px solid ${C.border}`, padding:"0 20px",
                    height:54, display:"flex", alignItems:"center",
                    justifyContent:"space-between", background:C.card, gap:12 }}>
        <div style={{ display:"flex", alignItems:"center", gap:9, flexShrink:0 }}>
          <span style={{ fontSize:18 }}>🩺</span>
          <span style={{ fontWeight:700, fontSize:15 }}>
            DiabetesAI <span style={{ color:C.blue }}>MLOps</span>
          </span>
        </div>

        {/* View tabs */}
        <div style={{ display:"flex", gap:6 }}>
          {[["predictor","Predictor"], ["history","My History"]].map(([id, label]) => (
            <button key={id} onClick={() => setView(id)} style={{
              padding:"6px 14px", borderRadius:7, border:"none", fontSize:12, fontWeight:600,
              cursor:"pointer", fontFamily:"inherit", transition:"all .15s",
              background: view === id ? C.blue   : C.card2,
              color:       view === id ? "#0d1117": C.muted,
            }}>
              {label}
            </button>
          ))}
        </div>

        <span style={{ fontSize:10, color:C.muted, fontFamily:"monospace",
                       flexShrink:0, maxWidth:160, overflow:"hidden",
                       textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          ID: {userId}
        </span>
      </div>

      <div style={{ maxWidth:880, margin:"0 auto", padding:"28px 20px" }}>

        {/* ══════════════ HISTORY VIEW ══════════════ */}
        {view === "history" && <HistoryDashboard userId={userId} />}

        {/* ══════════════ PREDICTOR VIEW ══════════════ */}
        {view === "predictor" && (
          <>
            {/* ── FORM ── */}
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12,
                          padding:"20px", marginBottom:20 }}>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:16, color:C.text }}>
                Health Indicators
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", gap:10 }}>

                <NumInput icon="⚖️" label="BMI"
                  hint="Body Mass Index (weight / height²)"
                  sub={`${v.BMI} — ${BMI_LABEL(v.BMI)}`}
                  value={v.BMI} min={10} max={70} step={0.1}
                  onChange={val => set("BMI", isNaN(val) ? 25 : val)} />

                <NumInput icon="🎂" label="Age Category  (1–13)"
                  hint="1=18-24 · 7=50-54 · 13=80+"
                  sub={AGE_LABEL[v.Age] || ""}
                  value={v.Age} min={1} max={13} step={1}
                  onChange={val => set("Age", isNaN(val) ? 7 : Math.round(val))} />

                <NumInput icon="💊" label="General Health  (1–5)"
                  hint="1=Excellent  2=Very Good  3=Good  4=Fair  5=Poor"
                  sub={GENHLTH_LABEL[v.GenHlth] || ""}
                  value={v.GenHlth} min={1} max={5} step={1}
                  onChange={val => set("GenHlth", isNaN(val) ? 3 : Math.round(val))} />

                <NumInput icon="🧘" label="Mental Health Bad Days  (0–30)"
                  hint="Days in past 30 with poor mental health"
                  value={v.MentHlth} min={0} max={30} step={1}
                  onChange={val => set("MentHlth", isNaN(val) ? 0 : Math.round(val))} />

                <NumInput icon="🏥" label="Physical Health Bad Days  (0–30)"
                  hint="Days in past 30 with illness or injury"
                  value={v.PhysHlth} min={0} max={30} step={1}
                  onChange={val => set("PhysHlth", isNaN(val) ? 0 : Math.round(val))} />

                <Toggle icon="🩸" label="High Blood Pressure"
                  hint="Ever told you have high blood pressure?"
                  value={v.HighBP} onChange={val => set("HighBP", val)} />

                <Toggle icon="🫀" label="High Cholesterol"
                  hint="Ever told you have high cholesterol?"
                  value={v.HighChol} onChange={val => set("HighChol", val)} />

                <Toggle icon="🧠" label="Stroke History"
                  hint="Have you ever had a stroke?"
                  value={v.Stroke} onChange={val => set("Stroke", val)} />

                <Toggle icon="💔" label="Heart Disease / Attack"
                  hint="Coronary heart disease or heart attack?"
                  value={v.HeartDiseaseorAttack} onChange={val => set("HeartDiseaseorAttack", val)} />

                <Toggle icon="🍺" label="Heavy Alcohol Use"
                  hint="Men >14 drinks/week or women >7/week?"
                  value={v.HvyAlcoholConsump} onChange={val => set("HvyAlcoholConsump", val)} />

                <Toggle icon="🦽" label="Difficulty Walking"
                  hint="Difficulty walking or climbing stairs?"
                  value={v.DiffWalk} onChange={val => set("DiffWalk", val)} />
              </div>

              {error && (
                <div style={{ marginTop:14, padding:"10px 14px",
                              background:"rgba(248,81,73,.1)",
                              border:`1px solid rgba(248,81,73,.3)`,
                              borderRadius:8, color:C.red, fontSize:12 }}>
                  ⚠️ {error}
                </div>
              )}

              <button onClick={handleSubmit} disabled={loading} style={{
                marginTop:16, width:"100%", padding:"13px 0",
                background: loading ? C.border : C.blue,
                color: loading ? C.muted : "#0d1117",
                border:"none", borderRadius:9, fontSize:14, fontWeight:700,
                cursor: loading ? "not-allowed" : "pointer", transition:"background .2s",
              }}>
                {loading ? "⏳  Running prediction…" : "▶  Run prediction"}
              </button>
            </div>

            {/* ══ RESULTS ══ */}
            {result && (
              <div ref={resultRef} style={{ display:"flex", flexDirection:"column", gap:14,
                                            animation:"fadeUp .4s ease" }}>

                {/* ── PREDICTION HEADER ── */}
                <div style={{ background:C.card, border:`1px solid ${C.border}`,
                              borderRadius:12, padding:"20px 24px" }}>
                  <div style={{ fontSize:11, color:C.muted, marginBottom:8,
                                letterSpacing:".06em", textTransform:"uppercase" }}>
                    Prediction result
                  </div>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                                flexWrap:"wrap", gap:12, marginBottom:18 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                      <span style={{ fontSize:26, fontWeight:700,
                                      color: isDiabetic ? C.red : C.green }}>
                        {isDiabetic ? "Diabetic" : "Not diabetic"}
                      </span>
                      <span style={{
                        fontSize:12, padding:"3px 12px", borderRadius:20, fontWeight:700,
                        background: isDiabetic ? "rgba(248,81,73,.15)" : "rgba(63,185,80,.15)",
                        color: isDiabetic ? C.red : C.green,
                        border:`1px solid ${isDiabetic ? C.red : C.green}44`,
                      }}>
                        {result.risk_level} Risk
                      </span>
                    </div>
                    <span style={{ fontSize:11, color:C.muted, fontFamily:"monospace" }}>
                      {result.model_used} · BRFSS 2015 · v3
                    </span>
                  </div>
                  <ConfBar pct={confPct} diabetic={isDiabetic} />
                  {result.drift_detected && <DriftWarning />}
                </div>

                {/* ── SPEEDOMETER + SHAP ── */}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:14 }}>
                  <div style={{ background:C.card, border:`1px solid ${C.border}`,
                                borderRadius:12, padding:"18px 20px",
                                display:"flex", flexDirection:"column", alignItems:"center" }}>
                    <div style={{ fontSize:12, fontWeight:600, marginBottom:6, color:C.text,
                                  alignSelf:"flex-start" }}>
                      Risk Probability Gauge
                    </div>
                    <Speedometer probability={result.probability_yes} />
                    <div style={{ display:"flex", gap:16, marginTop:6, fontSize:11 }}>
                      {[["Low","#3fb950"],["Moderate","#58a6ff"],
                        ["High","#d29922"],["Very High","#f85149"]].map(([l, c]) => (
                        <div key={l} style={{ display:"flex", alignItems:"center", gap:4 }}>
                          <span style={{ width:8, height:8, borderRadius:2, background:c, display:"inline-block" }}/>
                          <span style={{ color:C.muted }}>{l}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <SHAPPanel
                    explanation={result.shap_explanation}
                    summary={result.shap_summary}
                  />
                </div>

                {/* ── RISK BREAKDOWN + FEATURE IMPORTANCE ── */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                  <div style={{ background:C.card, border:`1px solid ${C.border}`,
                                borderRadius:12, padding:"18px 20px" }}>
                    <div style={{ fontSize:12, fontWeight:600, marginBottom:14, color:C.text }}>
                      Risk score breakdown
                    </div>
                    <Doughnut segments={[
                      { label:"Cardiovascular", value:cardio, color:C.red    },
                      { label:"Metabolic",      value:meta,   color:C.amber  },
                      { label:"Demographics",   value:demo,   color:C.purple },
                      { label:"Lifestyle",      value:life,   color:C.blue   },
                    ]}/>
                  </div>
                  <div style={{ background:C.card, border:`1px solid ${C.border}`,
                                borderRadius:12, padding:"18px 20px" }}>
                    <div style={{ fontSize:12, fontWeight:600, marginBottom:14, color:C.text }}>
                      Model feature importance
                    </div>
                    {Object.keys(result.feature_importances).length > 0
                      ? <ImportanceTable importances={result.feature_importances}/>
                      : <div style={{ fontSize:12, color:C.muted }}>Not available for this model.</div>
                    }
                  </div>
                </div>

                {globalImportance.length > 0 && (
                  <GlobalImportancePanel items={globalImportance} />
                )}

                {/* ── AI-DRIVEN RECOMMENDATIONS ── */}
                <RecommendationList recommendations={result.recommendations} />

                {/* ── RISK FACTOR ANALYSIS ── */}
                <div style={{ background:C.card, border:`1px solid ${C.border}`,
                              borderRadius:12, padding:"18px 20px" }}>
                  <div style={{ fontSize:12, fontWeight:600, marginBottom:14, color:C.text }}>
                    Risk factor analysis
                  </div>
                  <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:14 }}>
                    <MetricCard icon="⚖️" label="BMI"
                      value={v.BMI.toFixed(1)} sub={bmiLabel}/>
                    <MetricCard icon="🎂" label="Age group"
                      value={ageLabel} sub={`Category ${v.Age}`}/>
                    <MetricCard icon="💊" label="Gen health"
                      value={`${v.GenHlth}/5`} sub={genLabel}/>
                    <MetricCard icon="⚠️" label="Overall risk"
                      value={`${confPct}%`} sub={result.risk_level}/>
                  </div>
                  {tags.length > 0 && (
                    <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:16 }}>
                      {tags.map((t, i) => <Tag key={i} label={t.label} color={t.color}/>)}
                    </div>
                  )}
                  <div style={{ display:"flex", justifyContent:"center" }}>
                    <Radar
                      axes={["Cardiovascular","Metabolic","Gen health","Age factor","Mental health","Lifestyle"]}
                      values={radarVals}
                      color={riskColor}
                    />
                  </div>
                </div>

                {/* ── PRECAUTIONS & LIFESTYLE ── */}
                <div style={{ background:C.card, border:`1px solid ${C.border}`,
                              borderRadius:12, overflow:"hidden" }}>
                  <div style={{ padding:"16px 20px 0", fontSize:12, fontWeight:600, color:C.text }}>
                    Health guidance
                  </div>
                  <div style={{ display:"flex", gap:8, padding:"12px 20px",
                                borderBottom:`1px solid ${C.border}` }}>
                    {[
                      { id:"ai",          label:"AI Insights"     },
                      { id:"precautions", label:"Precautions"     },
                      { id:"lifestyle",   label:"Lifestyle"       },
                    ].map(t => (
                      <button key={t.id} onClick={() => setTab(t.id)} style={{
                        padding:"7px 16px", borderRadius:8, border:"none",
                        background: tab === t.id ? C.blue : C.card2,
                        color: tab === t.id ? "#0d1117" : C.muted,
                        fontSize:12, fontWeight:600, cursor:"pointer",
                        fontFamily:"inherit", transition:"all .15s",
                      }}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ padding:"16px 20px" }}>
                    {tab === "ai" && (
                      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                        {(result.recommendations || []).map((rec, i) => (
                          <div key={i} style={{ display:"flex", gap:10 }}>
                            <span style={{ color:C.blue, fontSize:14, marginTop:1 }}>•</span>
                            <div style={{ fontSize:12, color:C.muted, lineHeight:1.65 }}>{rec}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {tab === "precautions" && PRECAUTIONS.map((item, i) => (
                      <div key={i} style={{ display:"flex", gap:10, marginBottom:12 }}>
                        <span style={{ color:C.blue, fontSize:14, marginTop:1 }}>•</span>
                        <div>
                          <div style={{ fontSize:13, fontWeight:600, marginBottom:2 }}>{item.title}</div>
                          <div style={{ fontSize:12, color:C.muted, lineHeight:1.6 }}>{item.body}</div>
                        </div>
                      </div>
                    ))}
                    {tab === "lifestyle" && LIFESTYLE.map((item, i) => (
                      <div key={i} style={{ display:"flex", gap:10, marginBottom:12 }}>
                        <span style={{ color:C.blue, fontSize:14, marginTop:1 }}>•</span>
                        <div>
                          <div style={{ fontSize:13, fontWeight:600, marginBottom:2 }}>{item.title}</div>
                          <div style={{ fontSize:12, color:C.muted, lineHeight:1.6 }}>{item.body}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── DIET PLAN ── */}
                <div style={{ background:C.card, border:`1px solid ${C.border}`,
                              borderRadius:12, padding:"18px 20px" }}>
                  <div style={{ fontSize:12, fontWeight:600, marginBottom:14, color:C.text }}>
                    Personalised diet plan {isDiabetic ? "(diabetic-friendly)" : "(preventive)"}
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
                    {DIET_PLAN.map((d, i) => (
                      <div key={i} style={{ display:"flex", gap:0, paddingBottom:10,
                                             marginBottom:10, borderBottom: i < DIET_PLAN.length-1
                                               ? `1px solid ${C.border}` : "none" }}>
                        <span style={{ fontFamily:"monospace", fontSize:10, color:C.blue,
                                        minWidth:130, flexShrink:0, paddingTop:2,
                                        textTransform:"uppercase", letterSpacing:".05em" }}>
                          {d.meal}
                        </span>
                        <span style={{ fontSize:12, color:C.muted, lineHeight:1.65 }}>{d.food}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── SESSION HISTORY (local) ── */}
                {localHist.length > 0 && (
                  <div style={{ background:C.card, border:`1px solid ${C.border}`,
                                borderRadius:12, padding:"18px 20px" }}>
                    <div style={{ fontSize:12, fontWeight:600, marginBottom:14, color:C.text }}>
                      Session history
                      <span style={{ fontSize:11, color:C.muted, fontWeight:400, marginLeft:8 }}>
                        (switch to "My History" tab for full log)
                      </span>
                    </div>
                    <div style={{ display:"flex", alignItems:"flex-end", gap:4,
                                   height:56, marginBottom:12 }}>
                      {localHist.map((h, i) => (
                        <div key={i} title={`${h.time}: ${h.confidence}%`} style={{
                          flex:1, minWidth:10, maxWidth:28,
                          height:`${h.confidence}%`, borderRadius:"3px 3px 0 0",
                          background: h.diabetic ? C.red : C.green,
                          transition:"height .5s ease",
                        }}/>
                      ))}
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                      {[...localHist].reverse().map((h, i) => (
                        <div key={i} style={{
                          display:"flex", justifyContent:"space-between", alignItems:"center",
                          padding:"6px 12px", background:C.card2, borderRadius:7,
                          border:`1px solid ${C.border}`, fontSize:12,
                        }}>
                          <span style={{ color:C.muted, fontFamily:"monospace", fontSize:11 }}>{h.time}</span>
                          <span style={{ color: h.diabetic ? C.red : C.green, fontWeight:700 }}>
                            {h.diabetic ? "Diabetic" : "Not diabetic"}
                          </span>
                          <span style={{ fontFamily:"monospace", color:C.text, fontWeight:700 }}>
                            {h.confidence}%
                          </span>
                          <span style={{ color:C.muted, fontSize:11 }}>{h.risk}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ fontSize:11, color:C.muted, textAlign:"center", paddingTop:4 }}>
                  For educational purposes only — not a substitute for professional medical advice.
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} }
        input[type=number]::-webkit-inner-spin-button { opacity:.4; }
        ::-webkit-scrollbar{width:6px;height:6px}
        ::-webkit-scrollbar-track{background:${C.bg}}
        ::-webkit-scrollbar-thumb{background:${C.border2};border-radius:3px}
      `}</style>
    </div>
  );
}
