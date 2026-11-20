#!/bin/bash
# Three unattended simulation runs, one after the other (each opens its own clean browser profile).
cd "$(dirname "$0")/.."
ACCOUNTS=20 MAX_HOURS=2 PRESET=gold  RISK=0.5 node scripts/simulate-accounts.mjs
ACCOUNTS=20 MAX_HOURS=2 PRESET=gold  RISK=1   node scripts/simulate-accounts.mjs
ACCOUNTS=20 MAX_HOURS=2 PRESET=aplus RISK=1   node scripts/simulate-accounts.mjs
echo ALL_DONE > analysis/sim-bitti.flag
