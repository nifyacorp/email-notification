const https = require('https');
const fs = require('fs');

// Define request options
const options = {
  hostname: 'email-notification-415554190254.us-central1.run.app',
  port: 443,
  path: '/process-daily',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

console.log('Sending process-daily request to:', options.hostname + options.path);

// Create the request
const req = https.request(options, (res) => {
  console.log('Status Code:', res.statusCode);
  console.log('Headers:', JSON.stringify(res.headers, null, 2));
  
  let data = '';
  
  // Collect data as it comes in
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  // Process the complete response
  res.on('end', () => {
    console.log('Response received');
    
    // Create test-results directory if it doesn't exist
    if (!fs.existsSync('test-results')) {
      fs.mkdirSync('test-results');
    }
    
    // Save raw response to file
    fs.writeFileSync('test-results/process_daily_raw.json', data);
    console.log('Raw response saved to test-results/process_daily_raw.json');
    
    try {
      // Parse the JSON response
      const parsedData = JSON.parse(data);
      
      // Add results to TEST_DETAILS.txt
      const detailsEntry = `
PROCESS DAILY TEST RESULTS (${new Date().toISOString()})
=============================================
Status: ${res.statusCode === 200 ? 'SUCCESS' : 'FAILED'}
Response Status Code: ${res.statusCode}
Response: ${JSON.stringify(parsedData, null, 2)}
`;
      fs.appendFileSync('test-results/TEST_DETAILS.txt', detailsEntry);
      console.log('Test results appended to test-results/TEST_DETAILS.txt');
      
      // Save formatted JSON for easier reading
      fs.writeFileSync('test-results/process_daily_response.json', JSON.stringify(parsedData, null, 2));
      console.log('Formatted response saved to test-results/process_daily_response.json');
      
    } catch (error) {
      console.error('Error parsing response:', error.message);
      fs.appendFileSync('test-results/TEST_DETAILS.txt', `
PROCESS DAILY TEST RESULTS (${new Date().toISOString()})
=============================================
Status: ERROR
Reason: Failed to parse response
Error: ${error.message}
Response Status Code: ${res.statusCode}
Raw Response: ${data}
`);
    }
  });
});

// Handle request errors
req.on('error', (error) => {
  console.error('Request error:', error.message);
  
  // Create test-results directory if it doesn't exist
  if (!fs.existsSync('test-results')) {
    fs.mkdirSync('test-results');
  }
  
  fs.appendFileSync('test-results/TEST_DETAILS.txt', `
PROCESS DAILY TEST RESULTS (${new Date().toISOString()})
=============================================
Status: ERROR
Reason: Request failed
Error: ${error.message}
`);
});

req.end();

console.log('Process daily request sent, waiting for response...');