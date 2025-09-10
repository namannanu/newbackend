require('dotenv').config();
const { getSignedImageUrl, checkObjectExists, getMultipleSignedUrls, s3 } = require('./s3-signed-url.service');

async function testS3Service() {
  console.log('🚀 Starting S3 Signed URL Service Tests\n');
  const testResults = [];

  // Test setup
  const testImageKey = `public/test-${Date.now()}.jpg`;
  const testImageBuffer = Buffer.from('Test image content');

  try {
    // Test 1: Upload test image
    console.log('📤 Test 1: Uploading test image...');
    try {
      await s3.putObject({
        Bucket: "nfacialimagescollections",
        Key: testImageKey,
        Body: testImageBuffer,
        ContentType: 'image/jpeg'
      }).promise();
      console.log('✅ Test 1 Passed: Image uploaded successfully');
      testResults.push({ name: 'Upload Image', status: 'PASSED' });
    } catch (error) {
      console.error('❌ Test 1 Failed:', error.message);
      testResults.push({ name: 'Upload Image', status: 'FAILED', error: error.message });
    }
    console.log();

    // Test 2: Check if object exists
    console.log('🔍 Test 2: Checking if image exists...');
    try {
      const exists = await checkObjectExists(testImageKey);
      console.log('Object exists:', exists);
      if (exists) {
        console.log('✅ Test 2 Passed: Object existence check successful');
        testResults.push({ name: 'Check Object Exists', status: 'PASSED' });
      } else {
        throw new Error('Object not found');
      }
    } catch (error) {
      console.error('❌ Test 2 Failed:', error.message);
      testResults.push({ name: 'Check Object Exists', status: 'FAILED', error: error.message });
    }
    console.log();

    // Test 3: Get signed URL
    console.log('🔗 Test 3: Getting signed URL...');
    try {
      const signedUrl = await getSignedImageUrl(testImageKey);
      console.log('Signed URL:', signedUrl);
      if (signedUrl && signedUrl.includes('nfacialimagescollections')) {
        console.log('✅ Test 3 Passed: Signed URL generated successfully');
        testResults.push({ name: 'Get Signed URL', status: 'PASSED' });
      } else {
        throw new Error('Invalid signed URL');
      }
    } catch (error) {
      console.error('❌ Test 3 Failed:', error.message);
      testResults.push({ name: 'Get Signed URL', status: 'FAILED', error: error.message });
    }
    console.log();

    // Test 4: Get multiple signed URLs
    console.log('🔗 Test 4: Getting multiple signed URLs...');
    try {
      const urls = await getMultipleSignedUrls(testImageKey);
      console.log('Short URL (15m):', urls.short.url);
      console.log('Medium URL (1h):', urls.medium.url);
      console.log('Long URL (24h):', urls.long.url);
      
      if (urls.short.url && urls.medium.url && urls.long.url) {
        console.log('✅ Test 4 Passed: Multiple URLs generated successfully');
        testResults.push({ name: 'Get Multiple URLs', status: 'PASSED' });
      } else {
        throw new Error('One or more URLs missing');
      }
    } catch (error) {
      console.error('❌ Test 4 Failed:', error.message);
      testResults.push({ name: 'Get Multiple URLs', status: 'FAILED', error: error.message });
    }
    console.log();

    // Test 5: Check non-existent object
    console.log('❓ Test 5: Testing non-existent object...');
    try {
      const nonExistentKey = 'public/non-existent-image.jpg';
      const exists = await checkObjectExists(nonExistentKey);
      console.log('Non-existent object check:', !exists);
      if (!exists) {
        console.log('✅ Test 5 Passed: Non-existent object check successful');
        testResults.push({ name: 'Check Non-existent Object', status: 'PASSED' });
      } else {
        throw new Error('Non-existent object reported as existing');
      }
    } catch (error) {
      console.error('❌ Test 5 Failed:', error.message);
      testResults.push({ name: 'Check Non-existent Object', status: 'FAILED', error: error.message });
    }
    console.log();

    // Cleanup
    console.log('🧹 Cleaning up test data...');
    try {
      await s3.deleteObject({
        Bucket: "nfacialimagescollections",
        Key: testImageKey
      }).promise();
      console.log('✅ Cleanup successful');
    } catch (error) {
      console.error('❌ Cleanup failed:', error.message);
    }

  } catch (error) {
    console.error('💥 Test suite failed:', error.message);
  }

  // Print test summary
  console.log('\n📊 Test Summary:');
  testResults.forEach(test => {
    const icon = test.status === 'PASSED' ? '✅' : '❌';
    console.log(`${icon} ${test.name}: ${test.status}`);
    if (test.error) {
      console.log(`   Error: ${test.error}`);
    }
  });
}

// Run tests
console.log('=== S3 Signed URL Service Test Suite ===\n');
testS3Service().then(() => {
  console.log('\n🏁 Test suite completed');
}).catch(error => {
  console.error('\n💥 Fatal error:', error.message);
});
