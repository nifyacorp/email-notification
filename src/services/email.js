import sgMail from '@sendgrid/mail';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import logger from '../utils/logger.js';

const secrets = new SecretManagerServiceClient();

async function getApiKey() {
  const [version] = await secrets.accessSecretVersion({
    name: process.env.SENDGRID_API_KEY_SECRET
  });
  return version.payload.data.toString();
}

// Initialize SendGrid with API key
const apiKey = await getApiKey();
sgMail.setApiKey(apiKey);

async function sendWithRetry(email, retries = 0) {
  const maxRetries = parseInt(process.env.MAX_RETRIES, 10) || 3;
  try {
    await sgMail.send({
      to: email.to,
      from: process.env.FROM_EMAIL,
      subject: email.subject,
      html: email.html,
      trackingSettings: {
        clickTracking: { enable: true },
        openTracking: { enable: true }
      }
    });

    logger.info('Email sent successfully', {
      to: email.to,
      subject: email.subject
    });
  } catch (error) {
    logger.error('Failed to send email', {
      error: error.message,
      to: email.to,
      attempt: retries + 1
    });
    
    if (retries < maxRetries) {
      const delay = Math.pow(2, retries) * 1000; // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
      return sendWithRetry(email, retries + 1);
    }
    
    throw error;
  }
}

export async function sendEmails(batch) {
  for (const email of batch) {
    await sendWithRetry(email);
  }
}