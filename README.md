# NIFYA Email Notification Service

The Email Notification Service is responsible for sending email notifications to users based on their preferences. It supports both immediate notifications for debugging purposes and daily digest emails that aggregate all notifications for a user.

## Production Service

The service is deployed at: **https://email-notification-415554190254.us-central1.run.app**

## Quick Start

```bash
# 1. Local development
npm install
npm start

# 2. Test with deployed service
curl -X POST https://email-notification-415554190254.us-central1.run.app/test-email -H "Content-Type: application/json" -d '{"email":"ratonxi@gmail.com"}'

# 3. Test daily digest template
curl -X POST https://email-notification-415554190254.us-central1.run.app/test-email -H "Content-Type: application/json" -d '{"email":"ratonxi@gmail.com","template":"daily"}'

# 4. Check service status
curl https://email-notification-415554190254.us-central1.run.app/status

# 5. Cloud setup (Google Cloud Project: delta-entity-447812-p2)
./setup-cloud.sh
```

## Test Scripts

The `scripts` directory contains Node.js scripts for testing all aspects of the email service:

```bash
# Run individual tests
node scripts/status.js
node scripts/test-email.js
node scripts/process-daily.js

# Run all tests in sequence
node scripts/run-all-tests.js
```

See the [scripts README](./scripts/README.md) for detailed documentation.

## Features

- **Daily Digest Emails**: Sends a single email per day containing all notifications for a user
- **Immediate Notifications**: For debugging purposes, sends immediate notifications to the test user (nifyacorp@gmail.com)
- **Email Templates**: Uses Handlebars templates for consistent email formatting
- **PubSub Integration**: Receives notification data from the notification worker via PubSub
- **User Preferences**: Respects user notification preferences stored in the database
- **Secure Email Delivery**: Uses OAuth2 with Gmail for secure email delivery
- **Retry Mechanism**: Implements exponential backoff for transient email delivery failures

## Architecture

The Email Notification Service is part of the NIFYA notification pipeline:

1. The notification worker creates notifications in the database
2. The notification worker publishes messages to PubSub topics:
   - `email-notifications-immediate` for immediate notifications
   - `email-notifications-daily` for daily digest notifications
3. The Email Notification Service subscribes to these topics and processes the messages
4. For immediate notifications, it checks if the user should receive them (test user or user with instant notifications enabled)
5. For daily digests, it aggregates notifications and sends a single email per day

## Setup and Configuration

### Environment Variables

```
# Database
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=nifya
DB_HOST=localhost
INSTANCE_CONNECTION_NAME=your-project:region:instance

# Gmail
GMAIL_USER=your-email@gmail.com
GMAIL_CLIENT_ID=your-client-id
GMAIL_CLIENT_SECRET=your-client-secret
GMAIL_REFRESH_TOKEN=your-refresh-token

# PubSub
GOOGLE_CLOUD_PROJECT=your-project-id

# Service
PORT=8080
NODE_ENV=development
```

### Local Development

1. Install dependencies:
   ```
   npm install
   ```

2. Start the service:
   ```
   npm start
   ```

3. Test the service:
   ```
   curl -X POST http://localhost:8080/test-email -H "Content-Type: application/json" -d '{"email":"test@example.com"}'
   ```

## API Endpoints

- `GET /`: Health check endpoint
- `POST /test-email`: Send a test email
- `POST /process-daily`: Manually trigger daily digest processing

## Deployment

### Build Docker Image

```bash
docker build -t nifya-email-service .
```

### Deploy to Cloud Run

```bash
# Build and push the Docker image
docker build -t gcr.io/delta-entity-447812-p2/nifya-email-service .
docker push gcr.io/delta-entity-447812-p2/nifya-email-service

# Deploy to Cloud Run
gcloud run deploy nifya-email-service \
  --image gcr.io/delta-entity-447812-p2/nifya-email-service \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="GMAIL_USER=YOUR_GMAIL_ADDRESS,NODE_ENV=production"
```

## Scheduled Daily Digest

Set up a Cloud Scheduler job to trigger the daily digest processing:

```bash
gcloud scheduler jobs create http email-daily-digest \
  --schedule="0 8 * * *" \
  --uri="https://nifya-email-service-url/process-daily" \
  --http-method=POST \
  --time-zone="America/New_York"
```

## Monitoring

Monitor the following metrics:

- Email delivery success rate
- Daily digest processing time
- Number of notifications per digest
- PubSub message processing errors

## Troubleshooting

### Common Issues

- **Email Delivery Failures**: Check Gmail API quotas and OAuth2 token validity
- **Database Connection Issues**: Verify database credentials and connectivity
- **PubSub Subscription Errors**: Check subscription existence and permissions

## Project Structure

```
email-notification/
├── src/
│   ├── database/
│   │   └── client.js         # Database connection and queries
│   ├── services/
│   │   ├── email.js          # Email sending functionality
│   │   ├── notifications.js  # Notification processing logic
│   │   ├── pubsub.js         # PubSub subscription handling
│   │   └── template.js       # Email template rendering
│   ├── templates/
│   │   ├── daily.html        # Daily digest email template
│   │   └── immediate.html    # Immediate notification email template
│   ├── utils/
│   │   ├── batch.js          # Batch processing utilities
│   │   └── logger.js         # Logging configuration
│   └── index.js              # Main application entry point
├── package.json
└── README.md
```

## 📄 License

Private and confidential. All rights reserved.