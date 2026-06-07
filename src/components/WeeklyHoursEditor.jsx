// src/components/WeeklyHoursEditor.jsx
//
// Graphic weekly hours editor (HK Jun 5 2026). Replaces the text time
// inputs with a visual week: each day is a bar and the working window is a
// green segment you drag. Designed to read at a glance for the persona.
//
// Key framing decisions (from HK feedback):
//   - "These hours repeat every week" is stated up front, so it is clear
//     this is the recurring schedule, not a single week. One-off changes
//     live under Date-specific hours.
//   - The old "Copy Monday to all weekdays" is renamed to name the days
//     ("Make Tue to Fri match Monday") so nobody reads it as copying to
//     future weeks.
//
// Persistence is delegated to the parent via setDayHours(dow, {active,
// blocks}), which reuses the proven availability write path. This
// component only owns the interaction and a transient drag draft.

import React, { useRef, useState } from "react";
import { RoundIconButton } from "./ChevronIcon";

const C = {
  forest:"#2A5741", cream:"#FCF8EE", border:"#E5D5C8", line:"#ECE9E1",
  ink:"#3D4A42", gray:"#7A8478", sageStroke:"#A9C99A", sageText:"#3A5C30",
  muted:"#F4F2EC", mutedText:"#B3B0A6",
};

// Mon-first display. dow values match availability.day_of_week (0=Sun..6=Sat).
const DAYS = [["Mon",1],["Tue",2],["Wed",3],["Thu",4],["Fri",5],["Sat",6],["Sun",0]];
const WEEKDAYS = [1,2,3,4,5];
const MIN = 360, MAX = 1260, SPAN = MAX - MIN, STEP = 30; // 6:00 AM to 9:00 PM

function toMin(hhmm){ var p=(hhmm||"09:00").split(":"); return (+p[0])*60 + (+(p[1]||0)); }
function toHHMM(min){ var h=Math.floor(min/60), m=min%60; return (h<10?"0":"")+h+":"+(m<10?"0":"")+m; }
function fmt(min){ var h=Math.floor(min/60), m=min%60, ap=h>=12?"PM":"AM", hh=h%12; if(hh===0)hh=12; return hh+(m?":"+(m<10?"0":"")+m:":00")+" "+ap; }
function pct(min){ return ((min-MIN)/SPAN)*100; }

export default function WeeklyHoursEditor({ availability, getBlocks, setDayHours }){
  // draft holds the live blocks for the day currently being dragged so the
  // bar moves smoothly without a database write on every pointer move.
  const [draft, setDraft] = useState(null); // { dow, blocks:[{start,end}] } | null
  const dragRef = useRef(null); // { dow, idx, edge, rect }

  function rowFor(dow){ return (availability || []).find(a => a.day_of_week === dow) || null; }
  function blocksFor(dow){
    if (draft && draft.dow === dow) return draft.blocks;
    var r = rowFor(dow);
    if (r) return getBlocks(r);
    return [{ start:"09:00", end:"17:00" }];
  }

  function onHandleDown(e, dow, idx, edge){
    e.preventDefault(); e.stopPropagation();
    var track = e.currentTarget.closest(".wh-track");
    if (!track) return;
    dragRef.current = { dow, idx, edge, rect: track.getBoundingClientRect() };
    setDraft({ dow, blocks: blocksFor(dow).map(function(b){ return { start:b.start, end:b.end }; }) });
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }
  function onMove(ev){
    var d = dragRef.current; if (!d) return;
    var x = (ev.clientX - d.rect.left) / d.rect.width;
    var min = MIN + Math.round((x * SPAN) / STEP) * STEP;
    if (min < MIN) min = MIN; if (min > MAX) min = MAX;
    setDraft(function(prev){
      if (!prev || prev.dow !== d.dow) return prev;
      var blocks = prev.blocks.map(function(b){ return { start:b.start, end:b.end }; });
      var b = blocks[d.idx]; if (!b) return prev;
      if (d.edge === "start"){
        var floor = d.idx > 0 ? toMin(blocks[d.idx-1].end) : MIN;
        var ceil = toMin(b.end) - STEP;
        if (min < floor) min = floor; if (min > ceil) min = ceil;
        b.start = toHHMM(min);
      } else {
        var floor2 = toMin(b.start) + STEP;
        var ceil2 = d.idx < blocks.length-1 ? toMin(blocks[d.idx+1].start) : MAX;
        if (min < floor2) min = floor2; if (min > ceil2) min = ceil2;
        b.end = toHHMM(min);
      }
      return { dow: prev.dow, blocks: blocks };
    });
  }
  function onUp(){
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    var d = dragRef.current; dragRef.current = null;
    setDraft(function(prev){
      if (prev && d && prev.dow === d.dow) { setDayHours(d.dow, { blocks: prev.blocks }); }
      return null;
    });
  }

  function toggle(dow){
    var r = rowFor(dow);
    setDayHours(dow, { active: !(r && r.active) });
  }
  function addBreak(dow){
    var blocks = blocksFor(dow).map(function(b){ return { start:b.start, end:b.end }; });
    var last = blocks[blocks.length-1];
    var s = Math.min(toMin(last.end) + 60, MAX - STEP);
    var en = Math.min(s + 60, MAX);
    blocks.push({ start: toHHMM(s), end: toHHMM(en) });
    setDayHours(dow, { blocks: blocks });
  }
  function removeBreak(dow, idx){
    var blocks = blocksFor(dow).filter(function(_, i){ return i !== idx; });
    if (blocks.length === 0) return;
    setDayHours(dow, { blocks: blocks });
  }
  function applyPreset(s, en){
    DAYS.forEach(function(d){
      var dow = d[1];
      if (WEEKDAYS.indexOf(dow) >= 0) setDayHours(dow, { active:true, blocks:[{ start:toHHMM(s), end:toHHMM(en) }] });
      else setDayHours(dow, { active:false });
    });
  }
  function matchMonday(){
    var mon = rowFor(1);
    var blocks = mon ? getBlocks(mon) : [{ start:"09:00", end:"17:00" }];
    [2,3,4,5].forEach(function(dow){ setDayHours(dow, { active:true, blocks: blocks.map(function(b){ return { start:b.start, end:b.end }; }) }); });
  }

  return (
    <div>
      <div style={{ fontSize:11.5, color:C.gray, lineHeight:1.5, marginBottom:12 }}>
        These hours <strong style={{ color:C.ink }}>repeat every week</strong>. Drag the green bar to set a day, or tap a day off to close it. To change a single date, use Date-specific hours below.
      </div>

      <div style={{ display:"flex", gap:7, flexWrap:"wrap", marginBottom:14 }}>
        <button onClick={function(){ applyPreset(540,1020); }} style={presetStyle}>Weekdays 9 to 5</button>
        <button onClick={function(){ applyPreset(480,720); }} style={presetStyle}>Mornings 8 to 12</button>
        <button onClick={function(){ applyPreset(780,1080); }} style={presetStyle}>Afternoons 1 to 6</button>
      </div>

      <div style={{ display:"flex", justifyContent:"space-between", fontSize:9.5, color:C.mutedText, fontWeight:700, padding:"0 2px 4px 64px" }}>
        <span>6a</span><span>9a</span><span>12p</span><span>3p</span><span>6p</span><span>9p</span>
      </div>

      {DAYS.map(function(d){
        var name = d[0], dow = d[1];
        var r = rowFor(dow);
        var isOn = !!(r && r.active);
        var blocks = blocksFor(dow);
        return (
          <div key={dow} style={{ marginBottom:8 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:54, flexShrink:0 }}>
              <div style={{ fontSize:13, fontWeight:700, color: isOn ? C.ink : C.mutedText }}>{name}</div>
              <button onClick={function(){ toggle(dow); }} style={{ display:"inline-flex", alignItems:"center", gap:5, background:"none", border:"none", padding:0, cursor:"pointer", marginTop:2 }}>
                <span style={{ width:28, height:16, borderRadius:999, background: isOn ? C.forest : "#D9D5CB", position:"relative", transition:"background .2s", flexShrink:0, display:"inline-block" }}>
                  <span style={{ position:"absolute", top:2, left: isOn ? 14 : 2, width:12, height:12, borderRadius:"50%", background:"#fff", transition:"left .2s" }} />
                </span>
              </button>
            </div>

            {isOn ? (
              <div className="wh-track" style={{ position:"relative", flex:1, height:42, background:"repeating-linear-gradient(90deg,#FAF8F2,#FAF8F2 calc(100%/15 - 1px),#EFEBE1 calc(100%/15 - 1px),#EFEBE1 calc(100%/15))", border:"1px solid "+C.line, borderRadius:10, touchAction:"none" }}>
                {blocks.map(function(b, idx){
                  var s = toMin(b.start), en = toMin(b.end);
                  return (
                    <div key={idx} style={{ position:"absolute", top:3, bottom:3, left:pct(s)+"%", width:(pct(en)-pct(s))+"%", background:"linear-gradient(135deg,#DFF0E4,#C9E6D2)", border:"1.5px solid "+C.sageStroke, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <span style={{ fontSize:10.5, fontWeight:800, color:C.sageText, whiteSpace:"nowrap", pointerEvents:"none", padding:"0 2px", overflow:"hidden" }}>{fmt(s)} - {fmt(en)}</span>
                      <div onPointerDown={function(e){ onHandleDown(e, dow, idx, "start"); }} style={{ position:"absolute", top:-3, bottom:-3, left:0, width:26, transform:"translateX(-50%)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"grab", touchAction:"none" }}>
                        <div style={{ width:8, height:30, borderRadius:5, background:C.forest, border:"2px solid #fff", boxShadow:"0 1px 4px rgba(0,0,0,.25)" }} />
                      </div>
                      <div onPointerDown={function(e){ onHandleDown(e, dow, idx, "end"); }} style={{ position:"absolute", top:-3, bottom:-3, right:0, width:26, transform:"translateX(50%)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"grab", touchAction:"none" }}>
                        <div style={{ width:8, height:30, borderRadius:5, background:C.forest, border:"2px solid #fff", boxShadow:"0 1px 4px rgba(0,0,0,.25)" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <button onClick={function(){ toggle(dow); }} style={{ flex:1, height:42, background:C.muted, border:"1px dashed "+C.border, borderRadius:10, color:C.mutedText, fontSize:12, fontWeight:700, cursor:"pointer" }}>Day off · tap to open</button>
            )}

            {isOn && (
              <RoundIconButton onClick={function(){ addBreak(dow); }} ariaLabel="Add another time block (split shift)" size={32} fontSize={22}>+</RoundIconButton>
            )}
            </div>

            {/* HK Jun 7 2026: a day can hold more than one time block (split
                shift). The only way to remove one used to be a 16px x tucked
                into the block corner, on top of the drag handles, so it was
                invisible and uncatchable. When a day has two or more blocks,
                list them here below the track with our standard round remove
                button. Removing is blocked at one block (use the day toggle
                to close a day), so the last block always stays. */}
            {isOn && blocks.length > 1 && (
              <div style={{ marginLeft:64, marginTop:7 }}>
                <div style={{ fontSize:10.5, color:C.gray, fontWeight:700, letterSpacing:0.3, marginBottom:6 }}>
                  This day has {blocks.length} time blocks. Tap to remove one.
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                  {blocks.map(function(b, idx){
                    return (
                      <div key={idx} style={{ display:"flex", alignItems:"center", gap:9 }}>
                        <span style={{ width:11, height:11, borderRadius:3, background:"linear-gradient(135deg,#DFF0E4,#C9E6D2)", border:"1.5px solid "+C.sageStroke, flexShrink:0, display:"inline-block" }} />
                        <span style={{ fontSize:12.5, color:C.ink, fontWeight:600, flex:1 }}>{fmt(toMin(b.start))} to {fmt(toMin(b.end))}</span>
                        <RoundIconButton onClick={function(){ removeBreak(dow, idx); }} ariaLabel={"Remove the "+fmt(toMin(b.start))+" to "+fmt(toMin(b.end))+" block"} size={32}>×</RoundIconButton>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

        );
      })}

      <div style={{ marginTop:12 }}>
        <button onClick={matchMonday} style={{ fontSize:12.5, fontWeight:700, color:C.forest, background:"#fff", border:"1.5px solid "+C.border, borderRadius:10, padding:"9px 12px", cursor:"pointer" }}>
          Make Tue to Fri match Monday
        </button>
      </div>
    </div>
  );
}

const presetStyle = { fontSize:12, fontWeight:700, padding:"8px 12px", borderRadius:999, border:"1.5px solid "+C.sageStroke, background:"#fff", color:C.forest, cursor:"pointer" };
