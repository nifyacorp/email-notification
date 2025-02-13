# Nifya Email Service

A Cloud Run job service that sends daily email summaries of notifications to users.

## 🚀 Features

- Daily email summaries of new notifications
- Personalized content per user
- HTML email templates with Handlebars
- Batched processing for efficiency
- Error handling with retry logic
- Email delivery tracking
- Rate limiting support

## 🛠 Tech Stack

- **Runtime**: Node.js 20
- **Database**: PostgreSQL (shared with main service)
- **Email Service**: SendGrid
- **Cloud Services**:
  - Cloud Run Jobs (execution environment)
  - Cloud Scheduler (daily trigger)
  - Cloud SQL (PostgreSQL hosting)
  - Secret Manager (API keys)

## 📋 Prerequisites

- Google Cloud project with:
  - Cloud Run Jobs enabled
  - Cloud Scheduler enabled
  - Secret Manager enabled
  - Cloud SQL configured
- SendGrid account and API key
- Environment variables configured

## 🔧 Configuration

Required environment variables:
```bash
# Database Configuration
DB_NAME=nifya
DB_USER=nifya
DB_PASSWORD=your-password-here

# Google Cloud Configuration
GOOGLE_CLOUD_PROJECT=your-project-id
INSTANCE_CONNECTION_NAME=your-instance-connection

# SendGrid Configuration
SENDGRID_API_KEY_SECRET=projects/PROJECT_ID/secrets/SENDGRID_API_KEY/versions/latest
FROM_EMAIL=notifications@yourdomain.com

# Job Configuration
BATCH_SIZE=100
MAX_RETRIES=3
```

## 🏗 Project Structure

```
.
├── src/
│   ├── database/
│   │   └── client.js       # Database connection and queries
│   ├── services/
│   │   ├── email.js        # Email sending service with retry logic
│   │   └── template.js     # Email template rendering service
│   ├── templates/
│   │   └── daily.html      # Daily summary email template
│   ├── utils/
│   │   ├── logger.js       # Logging utilities
│   │   └── batch.js        # Batch processing helper
│   └── index.js            # Job entry point
├── Dockerfile              # Container configuration
└── package.json           # Project dependencies and scripts
```

## 🚀 Development

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
export DB_NAME=nifya
export DB_USER=nifya
# ... set other required variables
```

3. Run locally:
```bash
npm start
```

## 📦 Deployment

1. Build container:
```bash
gcloud builds submit --tag gcr.io/PROJECT_ID/email-service
```

2. Deploy job:
```bash
gcloud run jobs create email-service \
  --image gcr.io/PROJECT_ID/email-service \
  --region us-central1 \
  --service-account email-service@PROJECT_ID.iam.gserviceaccount.com
```

3. Set up daily scheduler:
```bash
gcloud scheduler jobs create http process-emails \
  --schedule="0 8 * * *" \
  --uri="https://REGION-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/PROJECT_ID/jobs/email-service:run" \
  --http-method=POST \
  --oauth-service-account-email=scheduler@PROJECT_ID.iam.gserviceaccount.com
```

## 📊 Monitoring

Key metrics to watch:
- Emails sent per day
- Delivery success rate
- Processing duration
- Error rate by type
- Open and click rates
- User engagement

## 🐛 Troubleshooting

Common issues and solutions:

1. Email Delivery Failures
   - Check SendGrid API status
   - Verify API key permissions
   - Review email content for spam triggers
   - Check rate limits

2. Database Connection Issues
   - Verify connection string
   - Check IAM permissions
   - Review connection pool settings

3. Processing Errors
   - Check batch size configuration
   - Monitor memory usage
   - Review error logs

## 📄 License

Private and confidential. All rights reserved.