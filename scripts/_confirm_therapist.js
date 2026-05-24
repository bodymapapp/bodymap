// _confirm_therapist.js
//
// Safety gate for any white-glove script that touches a single therapist's data.
// Prints a full identity card from the database and requires the operator to
// type the therapist's custom_url to proceed.
//
// Why this exists:
//   On the night of May 23 2026, a comprehensive wipe was run against
//   Candice Peek's therapist_id while the operator believed it was Jacquie's.
//   The mistake erased a live customer's bookings, clients, services,
//   notification log, session payments, etc. Recovery took 5+ hours.
//
//   The mistake was structural: nothing forced the operator to confront the
//   actual row in the database before destruction. This gate forces that.
//
// How to use it in any white-glove script:
//
//   const { confirmTherapist } = require('./_confirm_therapist');
//
//   await confirmTherapist({
//     supabase,                                 // existing supabase client
//     therapistId: '58799af0-...',              // the id you THINK you want
//     operation: 'wipe all bookings + clients', // human-readable
//   });
//   // throws if confirmation fails; otherwise returns silently and you proceed
//
// You see the full identity card (business name, owner email, custom_url,
// counts of clients/bookings) and type the custom_url shown on screen to
// proceed. Mismatch = throw. Empty = throw. Ctrl-C = throw.
//
// Bypass: there is none. Add one only if there is a very good reason.

const readline = require('readline');

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function divider(char = '═', width = 65) {
  return char.repeat(width);
}

async function confirmTherapist({ supabase, therapistId, operation }) {
  if (!supabase) throw new Error('confirmTherapist: supabase client is required');
  if (!therapistId) throw new Error('confirmTherapist: therapistId is required');
  if (!operation) throw new Error('confirmTherapist: operation description is required');

  // Pull the therapist row + counts in parallel
  const [
    therapistRes,
    clientsRes,
    futureBookingsRes,
    pastBookingsRes,
    servicesRes,
  ] = await Promise.all([
    supabase
      .from('therapists')
      .select('id, business_name, full_name, email, custom_url, created_at')
      .eq('id', therapistId)
      .maybeSingle(),
    supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('therapist_id', therapistId),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('therapist_id', therapistId)
      .gte('booking_date', new Date().toISOString().slice(0, 10)),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('therapist_id', therapistId)
      .lt('booking_date', new Date().toISOString().slice(0, 10)),
    supabase
      .from('services')
      .select('id', { count: 'exact', head: true })
      .eq('therapist_id', therapistId),
  ]);

  if (therapistRes.error) {
    throw new Error(`Failed to look up therapist ${therapistId}: ${therapistRes.error.message}`);
  }

  const t = therapistRes.data;
  if (!t) {
    throw new Error(`No therapist row found with id ${therapistId}. Aborting.`);
  }

  const clientCount = clientsRes.count ?? 0;
  const futureBookings = futureBookingsRes.count ?? 0;
  const pastBookings = pastBookingsRes.count ?? 0;
  const serviceCount = servicesRes.count ?? 0;

  const created = t.created_at
    ? new Date(t.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '(unknown)';

  // Print the identity card
  console.log('');
  console.log(divider());
  console.log('DESTRUCTIVE OPERATION CONFIRMATION REQUIRED');
  console.log(divider());
  console.log('');
  console.log(`You are about to: ${operation}`);
  console.log('');
  console.log('THERAPIST DETAILS (from database):');
  console.log('');
  console.log(`  Business name:    ${t.business_name || '(none set)'}`);
  console.log(`  Owner name:       ${t.full_name || '(none set)'}`);
  console.log(`  Owner email:      ${t.email || '(none set)'}`);
  console.log(`  Custom URL:       ${t.custom_url || '(none set)'}`);
  console.log(`  Therapist ID:     ${t.id}`);
  console.log(`  Account created:  ${created}`);
  console.log(`  Clients:          ${clientCount}`);
  console.log(`  Future bookings:  ${futureBookings}`);
  console.log(`  Past bookings:    ${pastBookings}`);
  console.log(`  Services:         ${serviceCount}`);
  console.log('');

  console.log('Read the details above carefully. This is the therapist whose data will be affected.');
  console.log('');
  console.log('If everything looks correct, type:  go');
  console.log('Anything else cancels the operation.');
  console.log('');

  const answer = await ask('> ');

  if (answer.trim().toLowerCase() !== 'go') {
    console.log('');
    console.log(`Confirmation failed. Expected "go", got "${answer.trim()}".`);
    console.log('Operation cancelled. No changes were made.');
    console.log('');
    throw new Error('Therapist confirmation failed.');
  }

  console.log('');
  console.log(`Confirmed. Proceeding with: ${operation}`);
  console.log(divider());
  console.log('');

  return {
    therapist: t,
    counts: { clients: clientCount, futureBookings, pastBookings, services: serviceCount },
  };
}

module.exports = { confirmTherapist };
