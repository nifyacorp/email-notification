const { execSync } = require('child_process');
const fs = require('fs');

// Create test-results directory if it doesn't exist
if (!fs.existsSync('test-results')) {
  fs.mkdirSync('test-results');
}

console.log('===== NIFYA EMAIL SERVICE TEST SUITE =====');
console.log('Running all tests sequentially...');
console.log('Service URL: email-notification-415554190254.us-central1.run.app');
console.log('Test Email: ratonxi@gmail.com');
console.log('========================================');

// Start time
const startTime = new Date();
fs.appendFileSync('test-results/TEST_DETAILS.txt', `
TEST RUN STARTED (${startTime.toISOString()})
========================================
`);

try {
  // Run status check
  console.log('\n[1/4] Checking service status...');
  execSync('node status.js', { stdio: 'inherit' });

  // Run immediate email test
  console.log('\n[2/4] Testing immediate email notification...');
  execSync('node test-email.js immediate', { stdio: 'inherit' });

  // Run daily digest email test
  console.log('\n[3/4] Testing daily digest email notification...');
  execSync('node test-email.js daily', { stdio: 'inherit' });

  // Run process-daily test
  console.log('\n[4/4] Testing daily digest processing...');
  execSync('node process-daily.js', { stdio: 'inherit' });

  // End time
  const endTime = new Date();
  const duration = (endTime - startTime) / 1000; // Convert to seconds

  console.log('\n===== TEST SUMMARY =====');
  console.log(`All tests completed successfully!`);
  console.log(`Duration: ${duration.toFixed(2)} seconds`);
  console.log(`Detailed results saved in test-results/TEST_DETAILS.txt`);
  
  fs.appendFileSync('test-results/TEST_DETAILS.txt', `
TEST RUN COMPLETED (${endTime.toISOString()})
==========================================
Duration: ${duration.toFixed(2)} seconds
Status: SUCCESS
All tests were executed successfully.
`);

} catch (error) {
  // End time
  const endTime = new Date();
  const duration = (endTime - startTime) / 1000; // Convert to seconds

  console.error('\n===== TEST FAILURE =====');
  console.error(`One or more tests failed!`);
  console.error(`Duration: ${duration.toFixed(2)} seconds`);
  console.error(`Error: ${error.message}`);
  console.error(`Detailed results saved in test-results/TEST_DETAILS.txt`);
  
  fs.appendFileSync('test-results/TEST_DETAILS.txt', `
TEST RUN COMPLETED WITH ERRORS (${endTime.toISOString()})
=========================================================
Duration: ${duration.toFixed(2)} seconds
Status: FAILED
Error: ${error.message}
`);
}