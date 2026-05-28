import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    stages: [
        { duration: '10s', target: 5 }, // ramp up
        { duration: '20s', target: 10 }, // stay at 10 VUs
        { duration: '5s', target: 0 }, // ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const V1_PREFIX = '/v1';

export default function () {
    // 1. Hot Path: Creators List/Search
    const creatorsRes = http.get(`${BASE_URL}${V1_PREFIX}/creators?limit=10`);
    check(creatorsRes, {
        'get creators status is 200': (r) => r.status === 200,
    });

    sleep(1);

    // 2. Hot Path: Subscription Checkout (MOCKED)
    // Note: Checkout requires valid fanAddress, creatorAddress, and planId.
    // In a real load test, these should be provided via data files or pre-populated in DB.
    const payload = JSON.stringify({
        fanAddress: 'G...', // Placeholder
        creatorAddress: 'G...', // Placeholder
        planId: 1,
    });

    const params = {
        headers: {
            'Content-Type': 'application/json',
            'x-network': 'testnet',
        },
    };

    const checkoutRes = http.post(`${BASE_URL}${V1_PREFIX}/subscriptions/checkout`, payload, params);
    check(checkoutRes, {
        'checkout status is 201 or 400 (if invalid data)': (r) => r.status === 201 || r.status === 400,
    });

    sleep(1);
}
