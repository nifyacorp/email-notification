import nodemailer from 'nodemailer';
import pkg from 'google-auth-library';
const { GoogleAuth, OAuth2Client } = pkg;
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import logger from '../utils/logger.js';

const secrets = new SecretManagerServiceClient({
  projectId: process.env.GOOGLE_CLOUD_PROJECT
});

async function getSecrets() {
  logger.info('Fetching secrets from Secret Manager');
  const [clientId] = await secrets.accessSecretVersion({
    name: 'projects/delta-entity-447812-p2/secrets/GMAIL_CLIENT_ID/versions/latest'
  });
  const [clientSecret] = await secrets.accessSecretVersion({
    name: 'projects/delta-entity-447812-p2/secrets/GMAIL_CLIENT_SECRET/versions/latest'
  });
  const [refreshToken] = await secrets.accessSecretVersion({
    name: 'projects/delta-entity-447812-p2/secrets/GMAIL_REFRESH_TOKEN/versions/latest'
  });

  logger.info('Successfully retrieved all secrets');
  return {
    clientId: clientId.payload.data.toString(),
    clientSecret: clientSecret.payload.data.toString(),
    refreshToken: refreshToken.payload.data.toString()
  };
}

async function createTransporter() {
  logger.info('Creating email transporter');
  const { clientId, clientSecret, refreshToken } = await getSecrets();
  
  logger.info('Initializing OAuth2 client');
  const oauth2Client = new OAuth2Client(
    clientId,
    clientSecret,
    'https://developers.google.com/oauthplayground',
    '415554190254-compute@developer.gserviceaccount.com'
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken
  });

  logger.info('Getting access token');
  const accessToken = await oauth2Client.getAccessToken();

  logger.info('Creating nodemailer transport', {
    service: 'gmail',
    user: process.env.GMAIL_USER,
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
    hasRefreshToken: !!refreshToken,
    hasAccessToken: !!accessToken?.token
  });

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
    logger.info('Attempting to send email', { 
      to: email.to, 
      attempt: retries + 1,
      maxRetries 
    });

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
    const errorDetails = {
      error: error.message,
      stack: error.stack,
      errorName: error.name,
      errorCode: error.code,
      responseCode: error.responseCode,
      command: error.command || 'N/A',
      to: email.to,
      attempt: retries + 1,
      oauthError: error.info?.error,
      oauthErrorDescription: error.info?.error_description
    };
    
    logger.error('Failed to send email', {
      ...errorDetails,
      response: error.response,
      info: error.info
    });
    
    if (retries < maxRetries) {
      logger.info('Retrying email send', { 
        to: email.to, 
        nextAttempt: retries + 2,
        delay: Math.pow(2, retries) * 1000 
      });
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