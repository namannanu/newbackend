const fetch = require('node-fetch');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({
    path: path.join(__dirname, '../config/config.env'),
});

// Configuration
const API_BASE_URL = 'https://correct-eight.vercel.app';
const TEST_USER_ID = '68a8571f4bc1651c29c1b39e'; // The user ID you're testing with
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || 'your_auth_token_here';

async function testPresignedUrls() {
    console.log('🔍 Testing Pre-signed URLs API');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
        // 1. First test the basic API endpoint
        console.log('1️⃣ Testing basic API connectivity...');
        const testResponse = await fetch(`${API_BASE_URL}/api/users/test`);
        const testData = await testResponse.json();
        console.log('Basic API Response:', testData);
        console.log('Status:', testResponse.ok ? '✅ Success' : '❌ Failed');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // 2. Test pre-signed URLs endpoint
        console.log(`2️⃣ Testing pre-signed URLs for user: ${TEST_USER_ID}`);
        const response = await fetch(
            `${API_BASE_URL}/api/users/${TEST_USER_ID}/presigned-urls`,
            {
                headers: {
                    'Authorization': `Bearer ${AUTH_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('Response Status:', response.status);
        console.log('Response Status Text:', response.statusText);

        const responseText = await response.text();
        try {
            const data = JSON.parse(responseText);
            console.log('Response Data:', JSON.stringify(data, null, 2));
            
            if (data.success) {
                console.log('✅ Pre-signed URLs generated successfully');
                console.log('📸 Uploaded Photo URL:', data.urls.uploadedPhoto ? 'Present' : 'Not present');
                console.log('📄 Aadhaar Photo URL:', data.urls.aadhaarPhoto ? 'Present' : 'Not present');
            } else {
                console.log('❌ Failed to generate pre-signed URLs');
                console.log('Error Message:', data.message);
            }
        } catch (parseError) {
            console.log('❌ Failed to parse JSON response');
            console.log('Raw Response:', responseText);
        }

    } catch (error) {
        console.error('❌ Test failed with error:', error);
    }
}

// Run the test
testPresignedUrls().then(() => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🏁 Test completed');
});
