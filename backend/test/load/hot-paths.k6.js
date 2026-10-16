import http from 'k6/http';
import { check, sleep } from 'k6';

// Hot-paths smoke test (Issue #1851).
//
// The checkout step requires real inputs. Supply them via environment
// variables so the run exercises the checkout path instead of the
// validation-rejection path:
//
//   k6 run \
//     -e BASE_URL=https://api.example.com \
//     -e FAN_ADDRESS=G... \
//     -e CREATOR_ADDRESS=G... \
//     -e PLAN_ID=1 \
//     backend/test/load/hot-paths.k6.js
//
// Without FAN_ADDRESS/CREATOR_ADDRESS/PLAN_ID the script fails fast so a
// placeholder run can never be reported as a passing checkout check.

const STELLAR_ADDRESS_RE = /^G[A-Z2-7]{55}$/;

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const FAN_ADDRESS = __ENV.FAN_ADDRESS;
const CREATOR_ADDRESS = __ENV.CREATOR_ADDRESS;
const PLAN_ID = __ENV.PLAN_ID;

function validateInputs() {
  const errors = [];

  if (!FAN_ADDRESS || !STELLAR_ADDRESS_RE.test(FAN_ADDRESS)) {
    errors.push(
      'FAN_ADDRESS must be set and match /^G[A-Z2-7]{55}$/ (got: ' +
        (FAN_ADDRESS || '<unset>') +
        ')',
    );
  }

  if (!CREATOR_ADDRESS || !STELLAR_ADDRESS_RE.test(CREATOR_ADDRESS)) {
    errors.push(
      'CREATOR_ADDRESS must be set and match /^G[A-Z2-7]{55}$/ (got: ' +
        (CREATOR_ADDRESS || '<unset>') +
        ')',
    );
  }

  const planId = Number(PLAN_ID);
  if (!PLAN_ID || !Number.isInteger(planId) || planId <= 0) {
    errors.push(
      'PLAN_ID must be set and be a positive integer (got: ' +
        (PLAN_ID || '<unset>') +
        ')',
    );
  }

  return errors;
}

export function setup() {
  const errors = validateInputs();
  if (errors.length > 0) {
    throw new Error(
      'hot-paths.k6.js requires real checkout inputs; refusing to run with ' +
        'placeholders:\n  - ' +
        errors.join('\n  - '),
    );
  }

  return {
    fanAddress: FAN_ADDRESS,
    creatorAddress: CREATOR_ADDRESS,
    planId: Number(PLAN_ID),
  };
}

export const options = {
  thresholds: {
    http_req_duration: ['p(95)<500'],
  },
};

export default function (data) {
  const creatorsRes = http.get(`${BASE_URL}/creators`);
  check(creatorsRes, {
    'creators status is 200': (r) => r.status === 200,
  });

  const checkoutRes = http.post(
    `${BASE_URL}/checkout`,
    JSON.stringify({
      fanAddress: data.fanAddress,
      creatorAddress: data.creatorAddress,
      planId: data.planId,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(checkoutRes, {
    'checkout status is 201': (r) => r.status === 201,
  });

  sleep(1);
}
