import nodemailer from 'nodemailer';
import pkg from 'google-auth-library';
const { GoogleAuth, OAuth2Client } = pkg;
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import logger from '../utils/logger.js';

const PROJECT_ID = 'delta-entity-447812-p2';
const secrets = new SecretManagerServiceClient({
  projectId: process.env.GOOGLE_CLOUD_PROJECT || PROJECT_ID
});

async function getSecrets() {
  logger.info('Fetching secrets from Secret Manager');
  try {
    const [clientId] = await secrets.accessSecretVersion({
      name: `projects/${PROJECT_ID}/secrets/GMAIL_CLIENT_ID/versions/latest`
    });
    const [clientSecret] = await secrets.accessSecretVersion({
      name: `projects/${PROJECT_ID}/secrets/GMAIL_CLIENT_SECRET/versions/latest`
    });
    const [refreshToken] = await secrets.accessSecretVersion({
      name: `projects/${PROJECT_ID}/secrets/GMAIL_REFRESH_TOKEN/versions/latest`
    });

    logger.info('Successfully retrieved all secrets');
    return {
      clientId: clientId.payload.data.toString(),
      clientSecret: clientSecret.payload.data.toString(),
      refreshToken: refreshToken.payload.data.toString()
    };
  } catch (error) {
    logger.error('Failed to fetch secrets', { error: error.message, stack: error.stack });
    throw error;
  }
}

async function createTransporter() {
  logger.info('Creating email transporter');
  
  // If we have direct environment variables, use them first
  if (process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN) {
    logger.info('Using environment variables for Gmail credentials');
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
    
    return createTransporterWithCredentials(clientId, clientSecret, refreshToken);
  }
  
  // Otherwise fetch from Secret Manager
  try {
    const { clientId, clientSecret, refreshToken } = await getSecrets();
    return createTransporterWithCredentials(clientId, clientSecret, refreshToken);
  } catch (error) {
    logger.error('Failed to create transporter with secret manager', { error: error.message });
    throw error;
  }
}

async function createTransporterWithCredentials(clientId, clientSecret, refreshToken) {
  logger.info('Initializing OAuth2 client');
  const oauth2Client = new OAuth2Client(
    clientId,
    clientSecret,
    'https://developers.google.com/oauthplayground'
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken
  });

  logger.info('Getting access token');
  const accessToken = await oauth2Client.getAccessToken();

  const user = process.env.GMAIL_USER || 'nifyacorp@gmail.com';
  
  logger.info('Creating nodemailer transport', {
    service: 'gmail',
    user,
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
    hasRefreshToken: !!refreshToken,
    hasAccessToken: !!accessToken?.token
  });

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user,
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