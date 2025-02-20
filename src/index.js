import express from 'express';
import { getUsersWithNewNotifications, getUserNotifications, close as closeDb } from './database/client.js';
import { sendEmails } from './services/email.js';
import { render } from './services/template.js';
import { processBatch } from './utils/batch.js';
import logger from './utils/logger.js';

const app = express();
const port = process.env.PORT || 8080;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE, 10) || 100;

async function processUserNotifications(user, notifications) {
  // Group notifications by subscription
  const grouped = notifications.reduce((acc, n) => {
    if (!acc[n.subscription_name]) {
      acc[n.subscription_name] = [];
    }
    acc[n.subscription_name].push(n);
    return acc;
  }, {});

  // Generate email content
  const content = await render('daily', {
    user,
    notifications: grouped,
    date: new Date().toLocaleDateString(user.language),
    preferencesUrl: `https://app.nifya.com/settings/notifications?userId=${user.id}`
  });

  return {
    to: user.notificationEmail || user.email,
    subject: `Daily Notification Summary - ${new Date().toLocaleDateString()}`,
    html: content
  };
}

async function processEmails() {
  try {
    // Get users with new notifications
    const users = await getUsersWithNewNotifications();
    logger.info(`Processing notifications for ${users.length} users`);

    // Process each user's notifications
    const emailBatch = [];
    for (const user of users) {
      const notifications = await getUserNotifications(user.id);
      if (notifications.length > 0) {
        const email = await processUserNotifications(user, notifications);
        emailBatch.push(email);
      }
    }

    // Send emails in batches
    await processBatch(emailBatch, BATCH_SIZE, sendEmails);
    
    logger.info('Email processing completed successfully');
  } catch (error) {
    logger.error('Failed to process emails', { error: error.message });
    throw error;
  }
}

// Health check endpoint
app.get('/', (req, res) => {
  res.status(200).send('Email service is running');
});

// Trigger email processing
app.post('/process', async (req, res) => {
  try {
    await processEmails();
    res.status(200).json({ message: 'Email processing completed successfully' });
  } catch (error) {
    logger.error('Failed to process emails', { error: error.message });
    res.status(500).json({ error: 'Failed to process emails' });
  }
});

// Test email endpoint
app.post('/test-email', async (req, res) => {
  try {
    const testEmail = {
      to: process.env.TEST_EMAIL || 'test@nifya.com',
      subject: 'Test Email from Nifya Email Service',
      html: `
        <h1>Test Email</h1>
        <p>This is a test email sent from the Nifya Email Service.</p>
        <p>Time sent: ${new Date().toISOString()}</p>
      `
    };
    
    await sendEmails([testEmail]);
    res.status(200).json({ message: 'Test email sent successfully' });
  } catch (error) {
    logger.error('Failed to send test email', { error: error.message });
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

// Start the server
app.listen(port, () => {
  logger.info(`Email service listening on port ${port}`);
});