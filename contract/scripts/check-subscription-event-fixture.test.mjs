import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');

// Single source of truth shared by contract CI and the backend poller.
const FIXTURE_PATH = resolve(repoRoot, 'contract', 'fixtures', 'subscription-events.json');
const BACKEND_EVENTS_PATH = resolve(repoRoot, 'backend', 'src', 'events', 'target-events.ts');

function loadFixture() {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));
}

function loadBackendTargetEvents() {
  const source = readFileSync(BACKEND_EVENTS_PATH, 'utf8');
  const match = source.match(/TARGET_EVENTS\s*=\s*(\[[\s\S]*?\])\s*(?:as const)?\s*;/);
  assert.ok(match, 'TARGET_EVENTS array literal not found in backend poller');
  // The backend array is a plain list of topic strings; evaluate it safely.
  return JSON.parse(match[1].replace(/'/g, '"'));
}

test('fixture is well-formed and versioned', () => {
  const fixture = loadFixture();
  assert.equal(typeof fixture.version, 'number', 'fixture must declare a numeric version');
  assert.ok(Array.isArray(fixture.events), 'fixture must declare an events array');
  assert.ok(fixture.events.length > 0, 'fixture must contain at least one event');
});

test('every fixture event declares a topic and body shape', () => {
  const fixture = loadFixture();
  for (const event of fixture.events) {
    assert.equal(typeof event.name, 'string', 'event.name must be a string');
    assert.ok(Array.isArray(event.topics), `${event.name} must declare topics`);
    assert.ok(event.topics.length > 0, `${event.name} must declare at least one topic`);
    assert.ok(Array.isArray(event.body), `${event.name} must declare a body shape`);
  }
});

test('fixture topics are unique (no duplicate deliveries)', () => {
  const fixture = loadFixture();
  const seen = new Set();
  for (const event of fixture.events) {
    const key = event.topics.join(':');
    assert.ok(!seen.has(key), `duplicate topic signature: ${key}`);
    seen.add(key);
  }
});

test('backend TARGET_EVENTS matches the fixture topics', () => {
  const fixture = loadFixture();
  const fixtureTopics = fixture.events.map((event) => event.topics[0]).sort();
  const backendTopics = loadBackendTargetEvents().slice().sort();
  assert.deepEqual(
    backendTopics,
    fixtureTopics,
    'backend TARGET_EVENTS diverged from the shared event fixture',
  );
});

test('contract tests emit topics matching the fixture', () => {
  const fixture = loadFixture();
  const contractSource = readFileSync(
    resolve(repoRoot, 'contract', 'src', 'lib.rs'),
    'utf8',
  );
  for (const event of fixture.events) {
    for (const topic of event.topics) {
      assert.ok(
        contractSource.includes(topic),
        `contract does not emit fixture topic: ${topic}`,
      );
    }
  }
});

// Additional coverage from the incoming branch: canonical poller names,
// alias mapping, and rejection of unknown event names.
const backendFixturePath = resolve(
  repoRoot,
  'backend',
  'src',
  'subscriptions',
  'fixtures',
  'subscription-event-fixture.json',
);

function loadBackendFixture() {
  return JSON.parse(readFileSync(backendFixturePath, 'utf8'));
}

test('subscription event fixture lists the canonical poller names', () => {
  const backendFixture = loadBackendFixture();
  const canonical = backendFixture.targetEvents;
  assert.deepEqual(canonical, ['subscribed', 'extended', 'cancelled']);
  assert.ok(canonical.every((event) => backendFixture.eventSchemas[event]));
});

test('fixture aliases remain mappable to the canonical target events', () => {
  const backendFixture = loadBackendFixture();
  const canonical = backendFixture.targetEvents;
  const aliasEntries = Object.entries(backendFixture.aliases ?? {});
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
  const backendFixture = loadBackendFixture();
  assert.equal(backendFixture.targetEvents.includes('weird_event'), false);
  assert.equal(backendFixture.aliases.weird_event, undefined);
});
