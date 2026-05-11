// src/data/demoSarahChen.js
//
// Demo dataset for the canonical MyBodyMap demo client.
//
// Used by:
//   1. /founder/seed-demo  (HK uploads or clicks "Use built-in" to
//      seed Sarah Chen's history into Supabase)
//   2. The three-dot document pages (Intake, Pre-Session,
//      Post-Session) when previewing the dataset
//
// The story: Sarah Chen, 52, software architect, books every 14
// days. Comes in with right shoulder + lower back tension (visit 1),
// pressure climbs from 2/5 to 4/5 as she gets comfortable, develops
// recurring tension headaches in visits 3-5 (therapist surfaces this
// in SOAP), gets a nightguard for jaw clenching, headache frequency
// drops, focus shifts to lower back, cadence stretched to 3 weeks
// for maintenance.
//
// Why these specific narrative beats:
//   - Pattern intelligence: same zones across visits (right shoulder)
//     and an evolving zone (lower back) so the heatmap looks rich.
//   - Change-over-time: pressure climbs visit to visit (intelligence
//     surfaces this as a trend).
//   - Med flags: scoliosis + headaches + jaw clenching all real
//     clinical patterns therapists see together. Lavender allergy
//     for the "custom answer" surface.
//   - SOAP that reads like real notes: subjective with patient quote,
//     objective with specific findings, assessment that names the
//     pattern, plan that's actionable.
//   - Aftercare that evolves: hydrate stays constant, but additions
//     change (gentle-stretch, ice for the headache visits, epsom-bath
//     for the heavier deep tissue visits).
//   - noteToClient that sounds like a human therapist talking, not
//     a chart entry.

export const DEMO_CLIENT = {
  id: '1565eac6-ceff-4e81-a038-82fe5e8299c6',
  name: 'Sarah Chen',
  phone: '+15125550042',
  email: 'sarah.chen.demo@mybodymap.app',
};

// Fixed UUIDs for repeatable seeding. Session 5 reuses the existing
// session id HK has been testing with so the previously-shared
// /brief/pre/<id> URL keeps working after a re-seed.
const SESSION_IDS = {
  s1: '10000000-0001-4000-8000-000000000001',
  s2: '10000000-0002-4000-8000-000000000002',
  s3: '10000000-0003-4000-8000-000000000003',
  s4: '10000000-0004-4000-8000-000000000004',
  s5: '3b07f57d-7e94-432c-a2b5-779c14faad1b',
};

// Anchor date: May 10, 2026 (yesterday relative to today). Session 5
// happens on this date. Sessions 1-4 are at 14-day intervals before.
function dateBack(days) {
  const d = new Date('2026-05-10T15:00:00.000Z');
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

// Shared intake answers (the parts that don't change visit to visit).
const STABLE_INTAKE_ANSWERS = {
  Occupation: 'Software architect, remote',
  Exercise: 'Yoga twice a week, daily walks',
  Allergies: 'Lavender (causes a headache)',
  Medications: 'Daily multivitamin, occasional ibuprofen',
  'Recent surgeries': 'None',
  'Emergency contact': 'David Chen, husband, +1 512 555 0099',
};

const STABLE_CONDITIONS = ['Occasional headaches', 'Jaw clenching', 'Scoliosis (mild)'];

// Build a SOAP json string. Mirrors the structure parseSoap reads.
function soap({ S, O, A, P, noteToClient, aftercare = [], aftercareCustom = '' }) {
  return JSON.stringify({
    __soap: true,
    S, O, A, P,
    noteToClient,
    aftercare,
    aftercareCustom,
    legacy: '',
  });
}

export const DEMO_SESSIONS = [
  // ───────────────────── SESSION 1: First visit ─────────────────────
  {
    id: SESSION_IDS.s1,
    client_id: DEMO_CLIENT.id,
    created_at: dateBack(56),
    completed: true,
    completed_at: dateBack(56),

    // Today's request, body map
    front_focus: ['f-r-shldr', 'f-r-chest'],
    front_avoid: [],
    back_focus: ['b-r-shldr', 'b-upper-bk', 'b-mid-bk', 'b-lower-bk'],
    back_avoid: [],

    // Preferences (cautious first visit)
    pressure: 2,
    goal: 'relax',
    table_temp: 'warm',
    room_temp: 'comfortable',
    music: 'soft',
    lighting: 'dim',
    conversation: 'quiet',
    draping: 'standard',
    oil_pref: 'none',

    // Medical
    med_flag: 'minor',
    med_note: 'Mild scoliosis (right curvature). Occasional tension headaches when stressed.',
    medical_conditions: STABLE_CONDITIONS,

    // Custom intake
    custom_intake_answers: {
      ...STABLE_INTAKE_ANSWERS,
      'What brings you in today?': 'Right shoulder feels stuck from desk work, want to see if massage helps.',
    },

    // What client wrote
    client_notes: 'Right shoulder tension building for a few weeks. Stressed at work this month. First massage in a year.',

    // Focus distribution
    front_pct: 30, top_pct: 50, middle_pct: 30, bottom_pct: 20,

    // SOAP
    therapist_notes: soap({
      S: 'Pt reports R shoulder tension x 3 weeks, worse end of day. Sleep adequate, no pain meds today. First massage in approximately 1 year.',
      O: 'Hypertonic R upper trap, palpable trigger points at rhomboid major. Cervical rotation R limited to ~65deg, L 80deg. Mild thoracic R-sided curvature visible.',
      A: 'Postural pattern from prolonged desk work. R-sided dominance compounded by mild scoliosis. Tension-pattern consistent with low-grade chronic stress.',
      P: 'Continue 60-min deep tissue every 2 weeks. Focus R upper trap, rhomboids, levator scapulae. Provide self-care: cat-cow stretch, doorway pec stretch. Reassess in 4 weeks for progress.',
      noteToClient: 'Lovely meeting you today, Sarah. Your right side carries a lot, which makes sense given the desk work. Be gentle with yourself tonight, lots of water and an early night.',
      aftercare: ['hydrate', 'rest', 'gentle-stretch'],
      aftercareCustom: '',
    }),
    public_notes: 'Lovely meeting you today, Sarah. Your right side carries a lot, which makes sense given the desk work. Be gentle with yourself tonight, lots of water and an early night.',
  },

  // ───────────────────── SESSION 2: Two weeks later ─────────────────────
  {
    id: SESSION_IDS.s2,
    client_id: DEMO_CLIENT.id,
    created_at: dateBack(42),
    completed: true,
    completed_at: dateBack(42),

    front_focus: ['f-r-shldr', 'f-r-chest'],
    front_avoid: [],
    back_focus: ['b-r-shldr', 'b-upper-bk', 'b-mid-bk', 'b-lower-bk', 'b-r-glute'],
    back_avoid: [],

    pressure: 3,
    goal: 'therapeutic',
    table_temp: 'warm',
    room_temp: 'comfortable',
    music: 'soft',
    lighting: 'dim',
    conversation: 'quiet',
    draping: 'standard',
    oil_pref: 'none',

    med_flag: 'minor',
    med_note: 'Same: mild scoliosis, occasional headaches.',
    medical_conditions: STABLE_CONDITIONS,

    custom_intake_answers: {
      ...STABLE_INTAKE_ANSWERS,
      'What brings you in today?': 'Shoulder is much better, but lower back has tightened up. Sat through several long meetings this week.',
    },

    client_notes: 'R shoulder is loosening up. Lower back has gotten tighter though, lots of meetings this week.',

    front_pct: 25, top_pct: 40, middle_pct: 35, bottom_pct: 25,

    therapist_notes: soap({
      S: 'Reports R shoulder loosening, but lumbar tightness increased. Sleep good. Tried the stretches I gave her and felt they helped.',
      O: 'Improved cervical ROM R now 75deg. Lumbar paraspinals tight bilaterally, R > L. QL palpable trigger on R.',
      A: 'Responding well to focused upper-quadrant work. Lower back compensation pattern emerging, likely as upper body releases.',
      P: 'Add lumbar paraspinal work. Maintain 2-week cadence. Try slightly deeper pressure (Pt requested level 3 today, tolerated well). Cue diaphragmatic breathing during deep work.',
      noteToClient: 'You did the stretches, thank you. Your shoulder is in a noticeably better place. We worked your lower back today too, which is a common pattern when the upper body starts to let go.',
      aftercare: ['hydrate', 'gentle-stretch', 'no-strenuous'],
      aftercareCustom: '',
    }),
    public_notes: 'You did the stretches, thank you. Your shoulder is in a noticeably better place. We worked your lower back today too, which is a common pattern when the upper body starts to let go.',
  },

  // ───────────────────── SESSION 3: Headaches surface ─────────────────────
  {
    id: SESSION_IDS.s3,
    client_id: DEMO_CLIENT.id,
    created_at: dateBack(28),
    completed: true,
    completed_at: dateBack(28),

    front_focus: ['f-head', 'f-neck', 'f-r-shldr'],
    front_avoid: ['f-l-forearm'],
    back_focus: ['b-head', 'b-neck', 'b-r-shldr', 'b-upper-bk'],
    back_avoid: ['b-l-forearm'],

    pressure: 3,
    goal: 'therapeutic',
    table_temp: 'warm',
    room_temp: 'comfortable',
    music: 'ambient',
    lighting: 'dim',
    conversation: 'quiet',
    draping: 'standard',
    oil_pref: 'none',

    med_flag: 'minor',
    med_note: 'Headaches more frequent this week (3 of them, evenings). Same scoliosis, same jaw clenching.',
    medical_conditions: STABLE_CONDITIONS,

    custom_intake_answers: {
      ...STABLE_INTAKE_ANSWERS,
      'What brings you in today?': 'Had three headaches this past week, want to address my neck and see if that helps. Lower back is better.',
    },

    client_notes: 'Three tension headaches this week, mostly evenings. Neck feels tight. Lower back has improved a lot since last visit. Skip my left forearm please, I have a small bruise from a yoga fall.',

    front_pct: 35, top_pct: 60, middle_pct: 25, bottom_pct: 15,

    therapist_notes: soap({
      S: 'Reports 3 tension-type headaches this week, evening onset. Jaw soreness on waking. Lower back significantly better. Sleep occasionally interrupted by jaw tension.',
      O: 'Suboccipital muscles very tight bilaterally. Masseter palpation tender, R > L. SCM tight. Cervical rotation now WNL (80deg both sides). Upper trap improving.',
      A: 'Tension headache pattern strongly suggests connection between suboccipital tension and nocturnal jaw clenching. Recurrent right shoulder pattern consistent across 3 visits.',
      P: 'Focus cervical/suboccipital work today. Strongly recommend dental evaluation for nightguard. Continue 2-week cadence. Have her track headache frequency and triggers in a notes app for 2 weeks.',
      noteToClient: 'Glad you mentioned the headaches today. We focused on the suboccipital muscles, the small ones at the base of your skull, which often drive tension headaches. I really think a dental visit about a nightguard would help here, given the jaw clenching pattern.',
      aftercare: ['hydrate', 'no-strenuous', 'ice'],
      aftercareCustom: 'If a headache comes on this week, try an ice pack at the base of your skull for 10 minutes. Notice if your jaw is clenched when you are at the computer.',
    }),
    public_notes: 'Glad you mentioned the headaches today. We focused on the suboccipital muscles, the small ones at the base of your skull, which often drive tension headaches. I really think a dental visit about a nightguard would help here, given the jaw clenching pattern.',
  },

  // ───────────────────── SESSION 4: Pattern confirmed ─────────────────────
  {
    id: SESSION_IDS.s4,
    client_id: DEMO_CLIENT.id,
    created_at: dateBack(14),
    completed: true,
    completed_at: dateBack(14),

    front_focus: ['f-head', 'f-neck', 'f-r-shldr'],
    front_avoid: ['f-l-forearm'],
    back_focus: ['b-neck', 'b-r-shldr', 'b-upper-bk', 'b-mid-bk'],
    back_avoid: [],

    pressure: 4,
    goal: 'therapeutic',
    table_temp: 'warm',
    room_temp: 'cool',
    music: 'ambient',
    lighting: 'dim',
    conversation: 'quiet',
    draping: 'standard',
    oil_pref: 'unscented',

    med_flag: 'minor',
    med_note: 'Headaches down to 2 this week and less severe. Nightguard fitting scheduled for next week.',
    medical_conditions: STABLE_CONDITIONS,

    custom_intake_answers: {
      ...STABLE_INTAKE_ANSWERS,
      'What brings you in today?': 'Headaches improving. Nightguard fitting scheduled. Going to keep working on the neck and shoulder.',
    },

    client_notes: '2 headaches this week, both milder. Got the nightguard fitting on the calendar. Right shoulder feels noticeably better most days.',

    front_pct: 35, top_pct: 55, middle_pct: 30, bottom_pct: 15,

    therapist_notes: soap({
      S: 'Reports 2 headaches this week, less intense. Got dental appt scheduled for nightguard fitting. Sleep better last few nights. Wants pressure level 4 today.',
      O: 'Suboccipitals still tight but improved 30%. Masseter R less tender. Upper trap R noticeably softer. SCM normalized. R shoulder ROM full.',
      A: 'Steady improvement across all targeted areas. Pattern of R upper-quadrant tension is consistent. Headache frequency reducing in correlation with treatment. Nightguard plan addressing root cause.',
      P: 'Maintain 2-week cadence one more visit. Re-evaluate cadence next visit based on headache frequency post-nightguard. Continue suboccipital + R shoulder focus.',
      noteToClient: 'Improvement is clear today, Sarah. The nightguard idea was good thinking on your part. Keep tracking your headache triggers this week and bring me what you notice next time.',
      aftercare: ['hydrate', 'epsom-bath', 'gentle-stretch'],
      aftercareCustom: 'Try the Epsom salt bath tonight, 20 minutes, water as warm as comfortable. Should help your nervous system settle after the deeper pressure today.',
    }),
    public_notes: 'Improvement is clear today, Sarah. The nightguard idea was good thinking on your part. Keep tracking your headache triggers this week and bring me what you notice next time.',
  },

  // ───────────────────── SESSION 5: Today's session (most recent) ─────────────────────
  {
    id: SESSION_IDS.s5,
    client_id: DEMO_CLIENT.id,
    created_at: dateBack(0),
    completed: true,
    completed_at: dateBack(0),

    front_focus: ['f-r-shldr', 'f-r-hip', 'f-l-hip'],
    front_avoid: ['f-neck'],  // Neck feels good now, asks to avoid
    back_focus: ['b-r-shldr', 'b-mid-bk', 'b-lower-bk', 'b-l-glute', 'b-r-glute'],
    back_avoid: ['b-neck'],

    pressure: 4,
    goal: 'therapeutic',
    table_temp: 'warm',
    room_temp: 'cool',
    music: 'ambient',
    lighting: 'dim',
    conversation: 'quiet',
    draping: 'standard',
    oil_pref: 'unscented',

    med_flag: 'minor',
    med_note: 'Headaches down to 1 this week. Nightguard fitted last week and helping. Lower back tight again from sitting.',
    medical_conditions: STABLE_CONDITIONS,

    custom_intake_answers: {
      ...STABLE_INTAKE_ANSWERS,
      'What brings you in today?': 'Nightguard helping a lot. Headaches almost gone. Want to focus on lower back today, neck is feeling great.',
    },

    client_notes: 'Nightguard fitted last week. Only 1 headache this week and it was mild. Lower back is what is bothering me now. Long days at the desk this past week.',

    front_pct: 20, top_pct: 30, middle_pct: 30, bottom_pct: 40,

    therapist_notes: soap({
      S: 'Reports headaches down to 1 this week, mild. Nightguard fitted and tolerating well. Wants to focus on lumbar today, neck feels good. Avoid neck per Pt request.',
      O: 'Lumbar paraspinals hypertonic R > L. R QL trigger reactivated. Cervical now WNL and pain-free. Upper trap R minimal residual tension.',
      A: 'Excellent progress. Nightguard appears to have addressed the headache trigger. Treatment pattern is now shifting toward maintenance of upper body and active treatment of recurring lumbar pattern.',
      P: 'Reduce visit cadence to every 3 weeks for maintenance. Continue lumbar focus. Consider adding hip work next visit. Recheck shoulder need at 6-week mark.',
      noteToClient: 'Sarah, today felt really good. Your neck is in a much better place since the nightguard, and we used the full hour on your lower back. Notice how it feels tomorrow. Let us stretch the next visit to 3 weeks instead of 2, you have earned a bit more space between sessions.',
      aftercare: ['hydrate', 'epsom-bath', 'gentle-stretch', 'no-strenuous'],
      aftercareCustom: 'Try the cat-cow stretch we talked about, 5 reps morning and evening. Watch how you sit at your desk this week, especially toward the end of the day.',
    }),
    public_notes: 'Sarah, today felt really good. Your neck is in a much better place since the nightguard, and we used the full hour on your lower back. Notice how it feels tomorrow. Let us stretch the next visit to 3 weeks instead of 2, you have earned a bit more space between sessions.',
  },
];

// Convenience export: the full payload an admin would POST.
export const DEMO_PAYLOAD = {
  client: DEMO_CLIENT,
  sessions: DEMO_SESSIONS,
};
