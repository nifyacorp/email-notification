#!/bin/bash
# Setup script for NIFYA Email Notification Service on Google Cloud

# Set variables
PROJECT_ID="delta-entity-447812-p2"
REGION="us-central1"
SERVICE_NAME="nifya-email-service"

# Ensure the script exits on error
set -e

echo "Setting up Google Cloud environment for the NIFYA Email Notification Service..."
echo "Project ID: $PROJECT_ID"

# 1. Enable required APIs
echo "Enabling required APIs..."
gcloud services enable secretmanager.googleapis.com --project=$PROJECT_ID
gcloud services enable pubsub.googleapis.com --project=$PROJECT_ID
gcloud services enable run.googleapis.com --project=$PROJECT_ID

# 2. Create PubSub topics and subscriptions if they don't exist
echo "Setting up PubSub topics and subscriptions..."

# Check and create immediate notification topic
if ! gcloud pubsub topics describe email-notifications-immediate --project=$PROJECT_ID &>/dev/null; then
  echo "Creating PubSub topic: email-notifications-immediate"
  gcloud pubsub topics create email-notifications-immediate --project=$PROJECT_ID
else
  echo "PubSub topic email-notifications-immediate already exists"
fi

# Check and create daily notification topic
if ! gcloud pubsub topics describe email-notifications-daily --project=$PROJECT_ID &>/dev/null; then
  echo "Creating PubSub topic: email-notifications-daily"
  gcloud pubsub topics create email-notifications-daily --project=$PROJECT_ID
else
  echo "PubSub topic email-notifications-daily already exists"
fi

# Check and create immediate notification subscription
if ! gcloud pubsub subscriptions describe email-notifications-immediate-sub --project=$PROJECT_ID &>/dev/null; then
  echo "Creating PubSub subscription: email-notifications-immediate-sub"
  gcloud pubsub subscriptions create email-notifications-immediate-sub \
    --topic=email-notifications-immediate \
    --ack-deadline=60 \
    --project=$PROJECT_ID
else
  echo "PubSub subscription email-notifications-immediate-sub already exists"
fi

# Check and create daily notification subscription
if ! gcloud pubsub subscriptions describe email-notifications-daily-sub --project=$PROJECT_ID &>/dev/null; then
  echo "Creating PubSub subscription: email-notifications-daily-sub"
  gcloud pubsub subscriptions create email-notifications-daily-sub \
    --topic=email-notifications-daily \
    --ack-deadline=60 \
    --project=$PROJECT_ID
else
  echo "PubSub subscription email-notifications-daily-sub already exists"
fi

echo "PubSub setup complete!"

# 3. Instructions for setting up Gmail OAuth credentials
echo ""
echo "===== Gmail OAuth Setup Instructions ====="
echo "To configure Gmail with OAuth2, follow these steps:"
echo ""
echo "1. Go to Google Cloud Console: https://console.cloud.google.com/apis/credentials"
echo "2. Create OAuth 2.0 Client ID credentials"
echo "3. Configure the OAuth consent screen if not already done"
echo "4. Add these credentials to Secret Manager:"
echo ""
echo "   For Client ID:"
echo "   gcloud secrets create GMAIL_CLIENT_ID --replication-policy=\"automatic\" --project=$PROJECT_ID"
echo "   echo -n \"YOUR_CLIENT_ID\" | gcloud secrets versions add GMAIL_CLIENT_ID --data-file=- --project=$PROJECT_ID"
echo ""
echo "   For Client Secret:"
echo "   gcloud secrets create GMAIL_CLIENT_SECRET --replication-policy=\"automatic\" --project=$PROJECT_ID"
echo "   echo -n \"YOUR_CLIENT_SECRET\" | gcloud secrets versions add GMAIL_CLIENT_SECRET --data-file=- --project=$PROJECT_ID"
echo ""
echo "   For Refresh Token:"
echo "   gcloud secrets create GMAIL_REFRESH_TOKEN --replication-policy=\"automatic\" --project=$PROJECT_ID"
echo "   echo -n \"YOUR_REFRESH_TOKEN\" | gcloud secrets versions add GMAIL_REFRESH_TOKEN --data-file=- --project=$PROJECT_ID"
echo ""
echo "5. To get a refresh token, visit https://developers.google.com/oauthplayground"
echo "   - Set up your own OAuth credentials in the settings (gear icon)"
echo "   - Select the Gmail API v1 scope: https://mail.google.com/"
echo "   - Exchange authorization code for a refresh token"
echo ""

# 4. Instructions for deployment
echo "===== Deployment Instructions ====="
echo "After setting up the secrets, deploy the service with:"
echo ""
echo "   # Build and push the Docker image"
echo "   docker build -t gcr.io/$PROJECT_ID/$SERVICE_NAME ."
echo "   docker push gcr.io/$PROJECT_ID/$SERVICE_NAME"
echo ""
echo "   # Deploy to Cloud Run"
echo "   gcloud run deploy $SERVICE_NAME \\"
echo "     --image gcr.io/$PROJECT_ID/$SERVICE_NAME \\"
echo "     --platform managed \\"
echo "     --region $REGION \\"
echo "     --allow-unauthenticated \\"
echo "     --set-env-vars=\"GMAIL_USER=YOUR_GMAIL_ADDRESS,NODE_ENV=production\""
echo ""

echo "===== Testing Instructions ====="
echo "After deployment, test the service with:"
echo ""
echo "   # Test with curl"
echo "   curl -X POST https://<your-service-url>/test-email \\"
echo "     -H \"Content-Type: application/json\" \\"
echo "     -d '{\"email\":\"your-email@example.com\"}'"
echo ""
echo "   # Test with different template"
echo "   curl -X POST https://<your-service-url>/test-email \\"
echo "     -H \"Content-Type: application/json\" \\"
echo "     -d '{\"email\":\"your-email@example.com\", \"template\":\"daily\"}'"
echo ""

echo "Setup instructions completed!"