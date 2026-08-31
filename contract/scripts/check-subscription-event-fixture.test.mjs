import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturePath = path.resolve(__dirname, '../../backend/src/subscriptions/fixtures/subscription-event-fixture.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

const canonical = fixture.targetEvents;
const aliasEntries = Object.entries(fixture.aliases ?? {});

test('subscription event fixture lists the canonical poller names', () => {
  assert.deepEqual(canonical, ['subscribed', 'extended', 'cancelled']);
  assert.ok(canonical.every((event) => fixture.eventSchemas[event]));
});

test('fixture aliases remain mappable to the canonical target events', () => {
  const mapped = aliasEntries.map(([alias, target]) => ({ alias, target }));
  assert.deepEqual(
    mapped.sort((a, b) => a.alias.localeCompare(b.alias)),
    [
      { alias: 'subscription_cancelled', target: 'cancelled' },
      { alias: 'subscription_created', target: 'subscribed' },
      { alias: 'subscription_extended', target: 'extended' },
    ],
  );

  for (const [, target] of aliasEntries) {
    assert.ok(canonical.includes(target), `alias target ${target} must be in canonical list`);
  }
});

test('unknown event names are not treated as supported subscription events', () => {
  assert.equal(fixture.targetEvents.includes('weird_event'), false);
  assert.equal(fixture.aliases.weird_event, undefined);
});
