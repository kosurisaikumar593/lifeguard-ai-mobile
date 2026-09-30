/**
 * LifeGuard AI — Comprehensive Full Codebase Regression Runner
 * Executes all 12 test suites across all completed project phases:
 * Phase 4: Mobile Auth & OTP Flow
 * Phase 5: SQLite Database & Session Persistence
 * Phase 6: Mobile Permissions Management
 * Phase 7: Emergency Contacts
 * Phase 8: Home Dashboard
 * Phase 9: Real-Time Sound Monitoring
 * Phase 10: Temporary Audio Capture
 * Phase 11: AI/ML Scream Detection
 * Phase 12: False-Alarm & Duration Verification
 * Phase 13: Manual SOS Workflow
 * Phase 14: GPS Location Tracking
 * Phase 15: Emergency Incident Database
 */

import { execSync } from 'child_process';

const suites = [
  { name: 'Phase 4: Auth Flow', file: 'tests/auth-flow.test.ts' },
  { name: 'Phase 5: SQLite Database & Auth', file: 'tests/database-auth.test.ts' },
  { name: 'Phase 6: Mobile Permissions', file: 'tests/permissions.test.ts' },
  { name: 'Phase 7: Emergency Contacts', file: 'tests/emergency-contacts.test.ts' },
  { name: 'Phase 8: Home Dashboard', file: 'tests/home-dashboard.test.ts' },
  { name: 'Phase 9: Real-Time Sound Monitoring', file: 'tests/sound-monitoring.test.ts' },
  { name: 'Phase 10: Temporary Audio Capture', file: 'tests/audio-capture.test.ts' },
  { name: 'Phase 11: AI/ML Scream Detection', file: 'tests/scream-detection.test.ts' },
  { name: 'Phase 12: Verification & False-Alarm Filter', file: 'tests/emergency-verification.test.ts' },
  { name: 'Phase 13: Manual SOS Workflow', file: 'tests/manual-sos.test.ts' },
  { name: 'Phase 14: GPS Location Tracking', file: 'tests/location.test.ts' },
  { name: 'Phase 15: Emergency Incident Database', file: 'tests/emergency-incident.test.ts' },
  { name: 'Phase 16: Emergency Alert System', file: 'tests/emergency-alert.test.ts' },
  { name: 'Phase 17: Alert / Incident History', file: 'tests/alert-history.test.ts' },
  { name: 'Phase 18: Profile & Settings', file: 'tests/profile-settings.test.ts' },
  { name: 'Phase 19: End-to-End Workflow Integration', file: 'tests/end-to-end-workflow.test.ts' },
  { name: 'Phase 20: Final Testing & Debugging', file: 'tests/final-testing-debugging.test.ts' },
];

async function runAllSuites() {
  console.log('\n======================================================');
  console.log('   LIFEGUARD AI — FULL REGRESSION TEST RUNNER');
  console.log('   Testing all 17 Phases (Phases 4 through 20)');
  console.log('======================================================\n');

  const startTime = Date.now();
  let passedCount = 0;

  for (const suite of suites) {
    process.stdout.write(`▶ Running ${suite.name} (${suite.file})... `);
    const suiteStart = Date.now();
    try {
      execSync(`npx ts-node "${suite.file}"`, {
        stdio: 'pipe',
        encoding: 'utf-8',
        cwd: process.cwd(),
      });
      const suiteElapsed = Date.now() - suiteStart;
      console.log(`✓ PASSED (${suiteElapsed}ms)`);
      passedCount++;
    } catch (err: any) {
      console.log(`✗ FAILED`);
      console.error(`\n--- ERROR OUTPUT FOR ${suite.name} ---`);
      console.error(err.stdout || err.stderr || err.message);
      process.exit(1);
    }
  }

  const elapsedMs = Date.now() - startTime;
  console.log('\n======================================================');
  console.log(`✅ ALL ${passedCount} OF ${suites.length} TEST SUITES PASSED CLEANLY IN ${elapsedMs}ms!`);
  console.log('======================================================\n');
}

runAllSuites();
