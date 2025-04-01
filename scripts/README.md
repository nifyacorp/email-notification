# Email Service Test Scripts

This directory contains Node.js scripts to test the NIFYA Email Notification Service.

## Service URL
```
https://email-notification-415554190254.us-central1.run.app
```

## Available Scripts

### 1. Test Email Notifications
```bash
node test-email.js [template]
```
Sends a test email to `ratonxi@gmail.com` using the specified template.
- `template`: Optional parameter, either `immediate` (default) or `daily`

### 2. Check Service Status
```bash
node status.js
```
Retrieves and displays the current status of the email service, including environment information, PubSub configuration, and available endpoints.

### 3. Process Daily Digests
```bash
node process-daily.js
```
Triggers the processing of daily digest emails manually.

### 4. Run All Tests
```bash
node run-all-tests.js
```
Executes all test scripts in sequence and provides a summary of the results.

## Output

All scripts create a `test-results` directory containing:
- `TEST_DETAILS.txt`: Cumulative log of all test runs with timestamps
- JSON files with raw and formatted responses from each endpoint

## Example Usage

```bash
# From the scripts directory
cd scripts

# Run a single test
node status.js

# Or run all tests
node run-all-tests.js
```

## Curl Commands

For quick testing without running the scripts:

```bash
# Test immediate email
curl -X POST https://email-notification-415554190254.us-central1.run.app/test-email -H "Content-Type: application/json" -d '{"email":"ratonxi@gmail.com"}'

# Test daily digest email
curl -X POST https://email-notification-415554190254.us-central1.run.app/test-email -H "Content-Type: application/json" -d '{"email":"ratonxi@gmail.com","template":"daily"}'

# Check status
curl https://email-notification-415554190254.us-central1.run.app/status

# Process daily digests
curl -X POST https://email-notification-415554190254.us-central1.run.app/process-daily
```