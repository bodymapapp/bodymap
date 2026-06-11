// supabase/functions/render-body-map/index.ts
//
// Renders a faithful PNG of a client's body map (front + back) for use
// as an <img> in emails, since email clients cannot render the live
// interactive map. Public (no JWT) so email clients can load it; keyed
// by session_id, which is an unguessable UUID (capability URL). The
// image contains only colored body regions, no name or contact PII.
//
// Faithful by construction: the silhouette, region geometry, ids, and
// palette are ported directly from the intake map (Demo.jsx Sil/BR +
// FRONT_REGIONS/BACK_REGIONS), so the email matches what the client
// saw and what the dashboard shows. It only ever draws what the client
// entered. GET /render-body-map?s=<session_id> returns image/png.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resvg, initWasm } from "https://esm.sh/@resvg/resvg-wasm@2.6.2";

const REGIONS: any = {"front":[{"id":"f-head","label":"Head","type":"ellipse","cx":100,"cy":44,"rx":27,"ry":31},{"id":"f-neck","label":"Neck","type":"rect","x":90,"y":73,"w":20,"h":17,"rx":7},{"id":"f-l-shldr","label":"L. Shoulder","type":"ellipse","cx":62,"cy":100,"rx":19,"ry":14},{"id":"f-r-shldr","label":"R. Shoulder","type":"ellipse","cx":138,"cy":100,"rx":19,"ry":14},{"id":"f-l-chest","label":"L. Chest","type":"rect","x":78,"y":91,"w":23,"h":29,"rx":5},{"id":"f-r-chest","label":"R. Chest","type":"rect","x":99,"y":91,"w":23,"h":29,"rx":5},{"id":"f-abdomen","label":"Abdomen","type":"rect","x":77,"y":119,"w":46,"h":33,"rx":6},{"id":"f-l-arm-u","label":"L. Upper Arm","type":"rect","x":46,"y":110,"w":18,"h":46,"rx":9},{"id":"f-r-arm-u","label":"R. Upper Arm","type":"rect","x":136,"y":110,"w":18,"h":46,"rx":9},{"id":"f-l-forearm","label":"L. Forearm","type":"rect","x":40,"y":154,"w":16,"h":42,"rx":8},{"id":"f-r-forearm","label":"R. Forearm","type":"rect","x":144,"y":154,"w":16,"h":42,"rx":8},{"id":"f-l-hand","label":"L. Hand","type":"ellipse","cx":48,"cy":204,"rx":10,"ry":12},{"id":"f-r-hand","label":"R. Hand","type":"ellipse","cx":152,"cy":204,"rx":10,"ry":12},{"id":"f-l-hip","label":"L. Hip","type":"rect","x":76,"y":151,"w":24,"h":24,"rx":6},{"id":"f-r-hip","label":"R. Hip","type":"rect","x":100,"y":151,"w":24,"h":24,"rx":6},{"id":"f-l-thigh","label":"L. Thigh","type":"rect","x":76,"y":173,"w":23,"h":62,"rx":9},{"id":"f-r-thigh","label":"R. Thigh","type":"rect","x":101,"y":173,"w":23,"h":62,"rx":9},{"id":"f-l-knee","label":"L. Knee","type":"ellipse","cx":87,"cy":242,"rx":13,"ry":12},{"id":"f-r-knee","label":"R. Knee","type":"ellipse","cx":113,"cy":242,"rx":13,"ry":12},{"id":"f-l-calf","label":"L. Calf","type":"rect","x":76,"y":251,"w":21,"h":54,"rx":9},{"id":"f-r-calf","label":"R. Calf","type":"rect","x":103,"y":251,"w":21,"h":54,"rx":9},{"id":"f-l-foot","label":"L. Foot","type":"ellipse","cx":84,"cy":312,"rx":17,"ry":9},{"id":"f-r-foot","label":"R. Foot","type":"ellipse","cx":116,"cy":312,"rx":17,"ry":9}],"back":[{"id":"b-head","label":"Head","type":"ellipse","cx":100,"cy":44,"rx":27,"ry":31},{"id":"b-neck","label":"Neck","type":"rect","x":90,"y":73,"w":20,"h":17,"rx":7},{"id":"b-l-shldr","label":"L. Shoulder","type":"ellipse","cx":62,"cy":100,"rx":19,"ry":14},{"id":"b-r-shldr","label":"R. Shoulder","type":"ellipse","cx":138,"cy":100,"rx":19,"ry":14},{"id":"b-upper-bk","label":"Upper Back","type":"rect","x":77,"y":90,"w":46,"h":29,"rx":5},{"id":"b-mid-bk","label":"Mid Back","type":"rect","x":77,"y":118,"w":46,"h":28,"rx":5},{"id":"b-lower-bk","label":"Lower Back","type":"rect","x":77,"y":145,"w":46,"h":26,"rx":5},{"id":"b-l-arm-u","label":"L. Upper Arm","type":"rect","x":46,"y":110,"w":18,"h":46,"rx":9},{"id":"b-r-arm-u","label":"R. Upper Arm","type":"rect","x":136,"y":110,"w":18,"h":46,"rx":9},{"id":"b-l-forearm","label":"L. Forearm","type":"rect","x":40,"y":154,"w":16,"h":42,"rx":8},{"id":"b-r-forearm","label":"R. Forearm","type":"rect","x":144,"y":154,"w":16,"h":42,"rx":8},{"id":"b-l-hand","label":"L. Hand","type":"ellipse","cx":48,"cy":204,"rx":10,"ry":12},{"id":"b-r-hand","label":"R. Hand","type":"ellipse","cx":152,"cy":204,"rx":10,"ry":12},{"id":"b-l-glute","label":"L. Glute","type":"ellipse","cx":89,"cy":184,"rx":17,"ry":16},{"id":"b-r-glute","label":"R. Glute","type":"ellipse","cx":111,"cy":184,"rx":17,"ry":16},{"id":"b-l-hamstr","label":"L. Hamstring","type":"rect","x":76,"y":197,"w":23,"h":53,"rx":9},{"id":"b-r-hamstr","label":"R. Hamstring","type":"rect","x":101,"y":197,"w":23,"h":53,"rx":9},{"id":"b-l-knee","label":"L. Knee","type":"ellipse","cx":87,"cy":257,"rx":13,"ry":12},{"id":"b-r-knee","label":"R. Knee","type":"ellipse","cx":113,"cy":257,"rx":13,"ry":12},{"id":"b-l-calf","label":"L. Calf","type":"rect","x":76,"y":266,"w":21,"h":52,"rx":9},{"id":"b-r-calf","label":"R. Calf","type":"rect","x":103,"y":266,"w":21,"h":52,"rx":9},{"id":"b-l-foot","label":"L. Foot","type":"ellipse","cx":84,"cy":325,"rx":17,"ry":9},{"id":"b-r-foot","label":"R. Foot","type":"ellipse","cx":116,"cy":325,"rx":17,"ry":9}]};

const SKIN = '#E8D0B0', SKIN_DK = '#C9A87A';
const FOCUS = '#3D8C55', AVOID = '#B84A42', NEUTRAL = '#C4B49A';

let wasmPromise: Promise<void> | null = null;
function ensureWasm(): Promise<void> {
  if (!wasmPromise) {
    wasmPromise = initWasm(fetch("https://esm.sh/@resvg/resvg-wasm@2.6.2/index_bg.wasm"));
  }
  return wasmPromise;
}

function silhouette(isFront: boolean): string {
  const sk = `fill="${SKIN}" stroke="${SKIN_DK}" stroke-width="1.2"`;
  const parts = [
    `<ellipse cx="100" cy="44" rx="28" ry="32" ${sk}/>`,
    `<rect x="90" y="73" width="20" height="18" rx="7" ${sk}/>`,
    `<rect x="67" y="87" width="66" height="75" rx="13" ${sk}/>`,
    `<rect x="71" y="148" width="58" height="38" rx="9" ${sk}/>`,
    `<rect x="45" y="108" width="20" height="48" rx="10" ${sk}/>`,
    `<rect x="135" y="108" width="20" height="48" rx="10" ${sk}/>`,
    `<rect x="39" y="154" width="18" height="44" rx="9" ${sk}/>`,
    `<rect x="143" y="154" width="18" height="44" rx="9" ${sk}/>`,
    `<ellipse cx="48" cy="205" rx="11" ry="13" ${sk}/>`,
    `<ellipse cx="152" cy="205" rx="11" ry="13" ${sk}/>`,
    `<rect x="75" y="183" width="25" height="65" rx="11" ${sk}/>`,
    `<rect x="100" y="183" width="25" height="65" rx="11" ${sk}/>`,
    `<ellipse cx="87" cy="253" rx="14" ry="13" ${sk}/>`,
    `<ellipse cx="113" cy="253" rx="14" ry="13" ${sk}/>`,
    `<rect x="75" y="262" width="23" height="56" rx="11" ${sk}/>`,
    `<rect x="102" y="262" width="23" height="56" rx="11" ${sk}/>`,
    `<ellipse cx="84" cy="325" rx="18" ry="10" ${sk}/>`,
    `<ellipse cx="116" cy="325" rx="18" ry="10" ${sk}/>`,
  ];
  if (isFront) {
    parts.push(`<ellipse cx="93" cy="42" rx="3" ry="3.5" fill="${SKIN_DK}" opacity="0.25"/>`);
    parts.push(`<ellipse cx="107" cy="42" rx="3" ry="3.5" fill="${SKIN_DK}" opacity="0.25"/>`);
    parts.push(`<path d="M 94 52 Q 100 56 106 52" stroke="${SKIN_DK}" stroke-width="1.5" fill="none" opacity="0.25" stroke-linecap="round"/>`);
  } else {
    parts.push(`<path d="M100,88 L100,218" stroke="${SKIN_DK}" stroke-width="1" stroke-dasharray="3,5" opacity="0.2"/>`);
  }
  return parts.join('');
}

function regionShapes(regions: any[], focus: string[], avoid: string[]): string {
  const f = new Set(focus || []);
  const a = new Set(avoid || []);
  return regions.map((r) => {
    const state = f.has(r.id) ? 'focus' : a.has(r.id) ? 'avoid' : null;
    const fill = state === 'focus' ? FOCUS : state === 'avoid' ? AVOID : NEUTRAL;
    const op = state ? '0.9' : '0.32';
    if (r.type === 'ellipse') {
      return `<ellipse cx="${r.cx}" cy="${r.cy}" rx="${r.rx}" ry="${r.ry}" fill="${fill}" opacity="${op}"/>`;
    }
    return `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${r.rx || 0}" fill="${fill}" opacity="${op}"/>`;
  }).join('');
}

function panel(isFront: boolean, focus: string[], avoid: string[], offsetX: number): string {
  const regions = isFront ? REGIONS.front : REGIONS.back;
  return `<g transform="translate(${offsetX},0)">${silhouette(isFront)}${regionShapes(regions, focus, avoid)}</g>`;
}

function buildSvg(s: any): string {
  const W = 430, H = 340;
  const front = panel(true, s.front_focus || [], s.front_avoid || [], 0);
  const back = panel(false, s.back_focus || [], s.back_avoid || [], 230);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${front}${back}</svg>`;
}

serve(async (req) => {
  const cors = { 'Access-Control-Allow-Origin': '*' };
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('s') || url.searchParams.get('session');
    if (!sessionId) return new Response('missing session', { status: 400, headers: cors });

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: s } = await supabase.from('sessions')
      .select('front_focus, front_avoid, back_focus, back_avoid')
      .eq('id', sessionId).maybeSingle();

    const svg = buildSvg(s || {});

    await ensureWasm();
    const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 860 }, background: 'rgba(255,255,255,0)' });
    const png = resvg.render().asPng();

    return new Response(png, {
      headers: {
        ...cors,
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (e) {
    console.error('[render-body-map] error', e);
    return new Response('render error', { status: 500, headers: cors });
  }
});
