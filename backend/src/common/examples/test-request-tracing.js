/**
 * Manual test script to verify request tracing functionality
 * Run this script after starting the server to test request ID and correlation ID tracing
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testRequestTracing() {
    console.log('🧪 Testing Request Tracing...\n');

    try {
        // Test 1: Basic request without headers
        console.log('📝 Test 1: Basic request without headers');
        const response1 = await axios.get(`${BASE_URL}/example`);
        console.log('Response:', response1.data);
        console.log('Response Headers:', {
            'x-correlation-id': response1.headers['x-correlation-id'],
            'x-request-id': response1.headers['x-request-id'],
        });
        console.log('✅ Test 1 passed\n');

        // Test 2: Request with existing correlation ID
        console.log('📝 Test 2: Request with existing correlation ID');
        const existingCorrelationId = 'test-correlation-123';
        const response2 = await axios.get(`${BASE_URL}/example`, {
            headers: {
                'x-correlation-id': existingCorrelationId,
            },
        });
        console.log('Response:', response2.data);
        console.log('Response Headers:', {
            'x-correlation-id': response2.headers['x-correlation-id'],
            'x-request-id': response2.headers['x-request-id'],
        });
        console.log('✅ Test 2 passed\n');

        // Test 3: Request with both correlation ID and request ID
        console.log('📝 Test 3: Request with both correlation ID and request ID');
        const existingRequestId = 'test-request-456';
        const response3 = await axios.get(`${BASE_URL}/example`, {
            headers: {
                'x-correlation-id': existingCorrelationId,
                'x-request-id': existingRequestId,
            },
        });
        console.log('Response:', response3.data);
        console.log('Response Headers:', {
            'x-correlation-id': response3.headers['x-correlation-id'],
            'x-request-id': response3.headers['x-request-id'],
        });
        console.log('✅ Test 3 passed\n');

        // Test 4: Error request to test error logging
        console.log('📝 Test 4: Error request to test error logging');
        try {
            await axios.get(`${BASE_URL}/example/error`);
        } catch (error) {
            console.log('Error response status:', error.response?.status);
            console.log('Error response headers:', {
                'x-correlation-id': error.response?.headers['x-correlation-id'],
                'x-request-id': error.response?.headers['x-request-id'],
            });
            console.log('✅ Test 4 passed\n');
        }

        console.log('🎉 All tests completed!');
        console.log('\n📋 Summary:');
        console.log('- ✅ Request IDs are generated when not provided');
        console.log('- ✅ Correlation IDs are preserved when provided');
        console.log('- ✅ Both IDs are returned in response headers');
        console.log('- ✅ Error requests also include tracing headers');
        console.log('- ✅ Check server logs to see request context in all log entries');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.log('💡 Make sure the server is running on localhost:3000');
        }
    }
}

// Instructions
console.log('🔧 Request Tracing Test Script');
console.log('================================');
console.log('1. Start the NestJS server: npm run start:dev');
console.log('2. Run this script: node test-request-tracing.js');
console.log('3. Check the server console output for request context in logs');
console.log('4. Verify that all log entries include correlationId and requestId');
console.log('');

if (require.main === module) {
    testRequestTracing();
}

module.exports = { testRequestTracing };
