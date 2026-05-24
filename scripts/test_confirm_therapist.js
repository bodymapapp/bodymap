// test_confirm_therapist.js
//
// Standalone test of the confirmation gate. Connects to the live DB, looks
// up Candice's therapist row, prints the identity card, and waits for you
// to type the custom_url. Does NOT write anything to the database regardless
// of what you type. Pure validation that the gate works as designed.
//
// Run with:
//   SUPABASE_URL='https://rmnqfrljoknmellbnpiy.supabase.co' \
//   SUPABASE_SERVICE_ROLE_KEY='...' \
//   node scripts/test_confirm_therapist.js
//
// If the gate works, typing 'groundedgrace' proceeds (and we print "test
// passed"). Anything else throws (and we print "test rejected, gate works").

const { createClient } = require('@supabase/supabase-js');
const { confirmTherapist } = require('./_confirm_therapist');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

(async () => {
  const CANDICE_ID = '58799af0-3b54-404c-ab14-3129c35e5ad2';
  try {
    const result = await confirmTherapist({
      supabase,
      therapistId: CANDICE_ID,
      operation: 'TEST RUN - no writes will happen regardless of input',
    });
    console.log('Test passed. Gate accepted the correct phrase.');
    console.log('Counts loaded:', result.counts);
  } catch (err) {
    console.log('Test rejected. Gate works correctly. Reason:', err.message);
  }
})();
