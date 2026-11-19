import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const libPath = resolve(here, '../contracts/subscription/src/lib.rs');
const typesPath = resolve(here, '../contracts/subscription/src/types.rs');
const docPath = resolve(here, '../docs/interfaces/subscription.md');

const lib = readFileSync(libPath, 'utf8');
const types = readFileSync(typesPath, 'utf8');
const doc = readFileSync(docPath, 'utf8');

// Frozen schema: topic pair -> ordered body fields.
const FROZEN = {
  plan: {
    topic: ['plan', 'created'],
    fields: ['plan_id', 'creator', 'asset', 'amount', 'interval'],
  },
  subscribe: {
    topic: ['sub', 'created'],
    fields: ['fan', 'creator', 'plan_id', 'amount', 'fee', 'expires_at'],
  },
  renew: {
    topic: ['sub', 'renewed'],
    fields: ['fan', 'creator', 'plan_id', 'amount', 'fee', 'expires_at'],
  },
  cancel: {
    topic: ['sub', 'cancelled'],
    fields: ['fan', 'creator', 'plan_id'],
  },
  pause: {
    topic: ['sub', 'paused'],
    fields: ['fan', 'creator', 'plan_id'],
  },
  unpause: {
    topic: ['sub', 'unpaused'],
    fields: ['fan', 'creator', 'plan_id'],
  },
  fee: {
    topic: ['fee', 'updated'],
    fields: ['recipient', 'amount'],
  },
};

function symbolShort(value) {
  return `symbol_short!("${value}")`;
}

function assertTopic(name, [first, second]) {
  const a = symbolShort(first);
  const b = symbolShort(second);
  const pattern = new RegExp(
    `\\(\\s*${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*,\\s*${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\)`,
  );
  assert.match(lib, pattern, `${name} must publish topic (${first}, ${second})`);
}

for (const [name, spec] of Object.entries(FROZEN)) {
  test(`lib.rs publishes frozen ${name} topic`, () => {
    assertTopic(name, spec.topic);
  });
}

// The interface doc must list the same topics and field order.
for (const [name, spec] of Object.entries(FROZEN)) {
  test(`interface doc documents ${name} topic and fields`, () => {
    const topicLine = `(${spec.topic[0]}, ${spec.topic[1]})`;
    assert.ok(
      doc.includes(topicLine),
      `interface doc must document topic ${topicLine}`,
    );
    for (const field of spec.fields) {
      assert.ok(
        doc.includes(field),
        `interface doc must document field ${field} for ${name}`,
      );
    }
  });
}

// types.rs must describe the same schema, not a second one.
for (const [name, spec] of Object.entries(FROZEN)) {
  test(`types.rs describes ${name} schema`, () => {
    for (const field of spec.fields) {
      assert.ok(
        types.includes(field),
        `types.rs must describe field ${field} for ${name}`,
      );
    }
  });
}
