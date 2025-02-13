import nodemailer from 'nodemailer';
import { google } from 'google-auth-library';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import logger from '../utils/logger.js';

const secrets = new SecretManagerServiceClient({
  projectId: process.env.GOOGLE_CLOUD_PROJECT
});

async function getSecrets() {
  const [clientId] = await secrets.accessSecretVersion({
    name: 'projects/delta-entity-447812-p2/secrets/GMAIL_CLIENT_ID/versions/latest'
  });
  const [clientSecret] = await secrets.accessSecretVersion({
    name: 'projects/delta-entity-447812-p2/secrets/GMAIL_CLIENT_SECRET/versions/latest'
  });
  const [refreshToken] = await secrets.accessSecretVersion({
    name: 'projects/delta-entity-447812-p2/secrets/GMAIL_REFRESH_TOKEN/versions/latest'
  });

  return {
    clientId: clientId.payload.data.toString(),
    clientSecret: clientSecret.payload.data.toString(),
    refreshToken: refreshToken.payload.data.toString()
  };
}

async function createTransporter() {
  const { clientId, clientSecret, refreshToken } = await getSecrets();
  
  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    'https://developers.google.com/oauthplayground',
    '415554190254-compute@developer.gserviceaccount.com'
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken
  });

  const accessToken = await oauth2Client.getAccessToken();

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: process.env.GMAIL_USER,
      clientId,
      clientSecret,
      refreshToken,
      accessToken: accessToken.token
    }
  });
}

async function sendWithRetry(email, retries = 0) {
  const maxRetries = parseInt(process.env.MAX_RETRIES, 10) || 3;
  try {
    const transporter = await createTransporter();
    
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: email.to,
      subject: email.subject,
      html: email.html
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