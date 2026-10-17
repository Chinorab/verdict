// Free calls only: current unit balance and the skin analysis price list.
// Usage: node scripts/cost.mjs
import { apiKey, credits, featureCost } from './lib/youcam.mjs';

const key = apiKey();
const [bal, skus] = await Promise.all([credits(key), featureCost(key)]);

console.log(`Spendable API units: ${bal.spendable}`);
for (const b of bal.batches) console.log(`  ${b.type}: ${b.amount}${b.expired_time ? ` (expires ${b.expired_time})` : ''}`);
console.log('\nSkin analysis pricing:');
for (const s of skus) console.log(`  ${s.amount} ${s.unit ?? 'units'} per ${s.proc_unit ?? 'task'}: ${s.description}`);
