# NIFYA Email Notification Service Documentation

**Deployed URL**: https://email-notification-415554190254.us-central1.run.app

## Service Overview

The Email Notification Service is a critical component of the NIFYA notification infrastructure. It is responsible for:

1. Receiving notification data via Google Cloud PubSub
2. Processing notifications according to user preferences
3. Formatting emails using templates
4. Sending emails using Gmail's OAuth2 authentication

## API Endpoints

### Health Check
```
GET /
```
Returns a simple response to confirm the service is running.

### Service Status
```
GET /status
```
Returns detailed information about the service configuration including environment, PubSub topics, and available endpoints.

Example response:
```json
{
  "service": "Email Notification Service",
  "version": "1.0.0",
  "timestamp": "2025-04-01T10:15:30.123Z",
  "environment": "production",
  "projectId": "delta-entity-447812-p2",
  "pubsub": {
    "immediateSubscription": "email-notifications-immediate-sub",
    "dailySubscription": "email-notifications-daily-sub"
  },
  "endpoints": {
    "testEmail": "/test-email",
    "processDaily": "/process-daily"
  }
}
```

### Test Email
```
POST /test-email
```

Sends a test email to verify the service is working correctly.

Request body:
```json
{
  "email": "recipient@example.com",
  "template": "immediate"
}
```

Parameters:
- `email`: (required) The recipient's email address
- `template`: (optional) The template to use - "immediate" or "daily" (default: "immediate")

Example curl command:
```bash
curl -X POST https://email-notification-415554190254.us-central1.run.app/test-email \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com"}'
```

### Process Daily Digests
```
POST /process-daily
```

Manually triggers the processing of daily digest emails.

Example curl command:
```bash
curl -X POST https://email-notification-415554190254.us-central1.run.app/process-daily
```

## Architecture

### PubSub Integration

The service subscribes to two PubSub topics:
- `email-notifications-immediate`: For immediate notifications
- `email-notifications-daily`: For daily digest notifications

### Email Templates

Two Handlebars templates are used:
- `immediate.html`: For single notification emails
- `daily.html`: For daily digest emails with multiple notifications

### Authentication

Gmail OAuth2 authentication is used for secure email delivery. The service uses the following secrets from Google Cloud Secret Manager:
- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`

## Database Integration

The service connects to the NIFYA database to:
- Check user notification preferences
- Mark notifications as sent
- Retrieve user email addresses

## Deployment Details

### Project Information
- **Google Cloud Project**: delta-entity-447812-p2
- **Service Name**: nifya-email-service
- **Region**: us-central1

### Required Environment Variables
- `GMAIL_USER`: Gmail address used for sending emails
- `NODE_ENV`: Environment (production/development)
- `GOOGLE_CLOUD_PROJECT`: Google Cloud Project ID

### Secrets
Secrets are stored in Google Cloud Secret Manager:
- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`

## Monitoring

The service uses structured logging with Pino to capture:
- Email delivery status
- PubSub message processing
- Error details
- Performance metrics

## Code Structure

```
email-notification/
├── src/
│   ├── database/
│   │   └── client.js         # Database connection and queries
│   ├── services/
│   │   ├── email.js          # Email sending with OAuth2
│   │   ├── notifications.js  # Notification processing logic
│   │   ├── pubsub.js         # PubSub subscription handling
│   │   └── template.js       # Handlebars template rendering
│   ├── templates/
│   │   ├── daily.html        # Daily digest email template
│   │   └── immediate.html    # Immediate notification email template
│   ├── utils/
│   │   ├── batch.js          # Batch processing utilities
│   │   └── logger.js         # Pino logging configuration
│   └── index.js              # Express server and main entry point
├── Dockerfile                # Container configuration
├── package.json              # Dependencies and scripts
└── setup-cloud.sh            # Cloud setup script
```