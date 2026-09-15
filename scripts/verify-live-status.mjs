#!/usr/bin/env node

/**
 * Verification script to detect discrepancies between Evenea, Firestore, and Website.
 */

import process from 'node:process';

const FIRESTORE_URL =
  'https://firestore.googleapis.com/v1/projects/gdg-warsaw-devfest26-web/databases/(default)/documents/tickets';
const EVENEA_URL = 'https://app.evenea.pl/event/devfestwarsaw2026/?out=1&source=event_iframe';
const SITE_URL = 'https://warsaw.devfest.pl/';

async function main() {
  console.log('=== DevFest Warsaw 2026 Live Consistency Check ===\n');
  let hasErrors = false;

  // 1. Fetch Evenea Status
  console.log('1. Checking Evenea iframe status...');
  let eveneaHtml = '';
  try {
    const res = await fetch(EVENEA_URL);
    eveneaHtml = await res.text();
    console.log('   Evenea responded HTTP', res.status);
  } catch (err) {
    console.error('   Failed to reach Evenea:', err.message);
    hasErrors = true;
  }

  const eveneaEarlyBirdSoldOut =
    eveneaHtml.includes('id="ticketRow452215"') && eveneaHtml.includes('Wyprzedane');

  console.log(
    `   Evenea Early Bird (452215): ${eveneaEarlyBirdSoldOut ? 'WYPRZEDANE (Sold Out)' : 'AVAILABLE'}`,
  );

  // 2. Fetch Firestore Status
  console.log('\n2. Checking Production Firestore (tickets collection)...');
  let firestoreTickets = [];
  try {
    const res = await fetch(FIRESTORE_URL);
    const data = await res.json();
    firestoreTickets = data.documents || [];
    console.log(`   Fetched ${firestoreTickets.length} tickets from Firestore.`);
  } catch (err) {
    console.error('   Failed to query Firestore:', err.message);
    hasErrors = true;
  }

  const earlyBirdDoc = firestoreTickets.find((doc) => doc.name.endsWith('/000'));
  if (earlyBirdDoc) {
    const soldOut = earlyBirdDoc.fields?.soldOut?.booleanValue ?? false;
    const available = earlyBirdDoc.fields?.available?.booleanValue ?? false;
    console.log(`   Firestore Early Bird (000): soldOut=${soldOut}, available=${available}`);

    if (eveneaEarlyBirdSoldOut && (!soldOut || available)) {
      console.error(
        '   ❌ MISMATCH DETECTED: Evenea Early Bird is Wyprzedane, but Firestore document has not marked it as soldOut=true, available=false!',
      );
      hasErrors = true;
    } else {
      console.log('   ✅ Firestore matches Evenea state.');
    }
  } else {
    console.warn('   ⚠️ Document tickets/000 not found in Firestore response.');
  }

  // 3. Check Live Website Route
  console.log('\n3. Checking Live Website (https://warsaw.devfest.pl/)...');
  try {
    const res = await fetch(SITE_URL);
    console.log('   Production root responded HTTP', res.status);
    if (res.status !== 200) {
      console.error('   ❌ Unexpected HTTP status:', res.status);
      hasErrors = true;
    } else {
      console.log('   ✅ Production website is serving normally.');
    }
  } catch (err) {
    console.error('   Failed to reach production website:', err.message);
    hasErrors = true;
  }

  console.log('\n===================================================');
  if (hasErrors) {
    console.error('STATUS: DISCREPANCIES OR ERRORS FOUND!');
    process.exit(1);
  } else {
    console.log('STATUS: ALL LIVE SYSTEMS CONSISTENT & GREEN! ✅');
    process.exit(0);
  }
}

main();
