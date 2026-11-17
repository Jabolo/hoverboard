#!/usr/bin/env node

/**
 * Verification script to detect discrepancies between Evenea, Firestore, and Website.
 */

import process from 'node:process';
import { pathToFileURL } from 'node:url';

const FIRESTORE_URL =
  'https://firestore.googleapis.com/v1/projects/gdg-warsaw-devfest26-web/databases/(default)/documents/tickets';
const EVENEA_URL = 'https://app.evenea.pl/event/devfestwarsaw2026/?out=1&source=event_iframe';
const SITE_URL = 'https://warsaw.devfest.pl/';

export function earlyBirdStatus(status, html) {
  if (status !== 200) return 'unknown';
  const row = html.match(/<tr\b[^>]*\bid=["']ticketRow452215["'][^>]*>[\s\S]*?<\/tr\s*>/i);
  if (!row) return 'unknown';
  return /Wyprzedane/i.test(row[0]) ? 'sold-out' : 'unknown';
}

export async function main() {
  console.log('=== DevFest Warsaw 2026 Live Consistency Check ===\n');
  let hasErrors = false;

  // 1. Fetch Evenea Status
  console.log('1. Checking Evenea iframe status...');
  let eveneaHtml = '';
  let eveneaHttpStatus = 0;
  try {
    const res = await fetch(EVENEA_URL);
    eveneaHttpStatus = res.status;
    eveneaHtml = await res.text();
    console.log('   Evenea responded HTTP', res.status);
  } catch (err) {
    console.error('   Failed to reach Evenea:', err.message);
    hasErrors = true;
  }

  const eveneaStatus = earlyBirdStatus(eveneaHttpStatus, eveneaHtml);
  if (eveneaStatus === 'unknown') hasErrors = true;

  console.log(
    `   Evenea Early Bird (452215): ${eveneaStatus === 'sold-out' ? 'WYPRZEDANE (Sold Out)' : 'UNKNOWN — unable to verify'}`,
  );

  // 2. Fetch Firestore Status
  console.log('\n2. Checking Production Firestore (tickets collection)...');
  let firestoreTickets = [];
  try {
    const res = await fetch(FIRESTORE_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    firestoreTickets = data.documents || [];
    console.log(`   Fetched ${firestoreTickets.length} tickets from Firestore.`);
  } catch (err) {
    console.error('   Failed to query Firestore:', err.message);
    hasErrors = true;
  }

  const earlyBirdDoc = firestoreTickets.find((doc) => doc.name.endsWith('/000'));
  if (earlyBirdDoc) {
    const soldOut = earlyBirdDoc.fields?.soldOut?.booleanValue;
    const available = earlyBirdDoc.fields?.available?.booleanValue;
    console.log(`   Firestore Early Bird (000): soldOut=${soldOut}, available=${available}`);

    if (typeof soldOut !== 'boolean' || typeof available !== 'boolean') {
      console.error('   ❌ Ticket status fields are missing or invalid.');
      hasErrors = true;
    } else if (eveneaStatus === 'unknown') {
      console.warn('   ⚠️ Comparison unavailable: Evenea status is unknown.');
    } else if (!soldOut || available) {
      console.error(
        '   ❌ MISMATCH DETECTED: Evenea Early Bird is Wyprzedane, but Firestore document has not marked it as soldOut=true, available=false!',
      );
      hasErrors = true;
    } else {
      console.log('   ✅ Firestore matches Evenea state.');
    }
  } else {
    console.warn('   ⚠️ Document tickets/000 not found in Firestore response.');
    hasErrors = true;
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
    console.error('STATUS: DISCREPANCIES OR UNVERIFIED CHECKS FOUND!');
    process.exit(1);
  } else {
    console.log('STATUS: ALL LIVE SYSTEMS CONSISTENT & GREEN! ✅');
    process.exit(0);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
