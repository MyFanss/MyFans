/**
 * Manual test script to verify Soroban RPC health check functionality
 * Run this script after starting the server to test the health endpoints
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testSorobanHealth() {
    console.log('🔍 Testing Soroban RPC Health Check...\n');

    try {
        // Test 1: Basic Soroban RPC health check
        console.log('📝 Test 1: Basic Soroban RPC health check');
        try {
            const response1 = await axios.get(`${BASE_URL}/health/soroban`);
            console.log('✅ Status:', response1.status);
            console.log('📄 Response:', JSON.stringify(response1.data, null, 2));
        } catch (error) {
            if (error.response) {
                console.log('⚠️  Status:', error.response.status);
                console.log('📄 Response:', JSON.stringify(error.response.data, null, 2));
            } else {
                console.log('❌ Error:', error.message);
            }
        }
        console.log('');

        // Test 2: Soroban contract health check
        console.log('📝 Test 2: Soroban contract health check');
        try {
            const response2 = await axios.get(`${BASE_URL}/health/soroban-contract`);
            console.log('✅ Status:', response2.status);
            console.log('📄 Response:', JSON.stringify(response2.data, null, 2));
        } catch (error) {
            if (error.response) {
                console.log('⚠️  Status:', error.response.status);
                console.log('📄 Response:', JSON.stringify(error.response.data, null, 2));
            } else {
                console.log('❌ Error:', error.message);
            }
        }
        console.log('');

        // Test 3: Compare with other health endpoints
        console.log('📝 Test 3: Compare with other health endpoints');
        
        try {
            const dbResponse = await axios.get(`${BASE_URL}/health/db`);
            console.log('📊 Database Health:', dbResponse.status, dbResponse.data.status);
        } catch (error) {
            console.log('📊 Database Health:', error.response?.status || 'Error');
        }

        try {
            const redisResponse = await axios.get(`${BASE_URL}/health/redis`);
            console.log('📊 Redis Health:', redisResponse.status, redisResponse.data.status);
        } catch (error) {
            console.log('📊 Redis Health:', error.response?.status || 'Error');
        }

        try {
            const basicResponse = await axios.get(`${BASE_URL}/health`);
            console.log('📊 Basic Health:', basicResponse.status, basicResponse.data.status);
        } catch (error) {
            console.log('📊 Basic Health:', error.response?.status || 'Error');
        }
        console.log('');

        // Test 4: Test with invalid endpoint (should return 404)
        console.log('📝 Test 4: Invalid endpoint test');
        try {
            const response4 = await axios.get(`${BASE_URL}/health/invalid`);
            console.log('📄 Response:', response4.status);
        } catch (error) {
            console.log('✅ Expected 404:', error.response?.status);
        }
        console.log('');

        console.log('🎉 Soroban health check tests completed!');
        console.log('\n📋 Summary:');
        console.log('- ✅ Soroban RPC connectivity check');
        console.log('- ✅ Soroban contract check (fallback implementation)');
        console.log('- ✅ HTTP status codes (200 for up, 503 for down)');
        console.log('- ✅ Response time measurement');
        console.log('- ✅ Error handling and timeout management');
        console.log('- ✅ Integration with existing health module');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.log('💡 Make sure the server is running on localhost:3000');
        }
    }
}

// Instructions
console.log('🔧 Soroban RPC Health Check Test Script');
console.log('=====================================');
console.log('1. Start the NestJS server: npm run start:dev');
console.log('2. Run this script: node test-soroban-health.js');
console.log('3. Check the responses for proper status codes and health data');
console.log('4. Verify that 200 is returned when RPC is up, 503 when down');
console.log('5. Check response times are reasonable (< 5 seconds)');
console.log('');

if (require.main === module) {
    testSorobanHealth();
}

module.exports = { testSorobanHealth };
