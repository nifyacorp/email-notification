import { getUsersWithNewNotifications, getUserNotifications, close as closeDb } from './database/client.js';
import { sendEmails } from './services/email.js';
import { render } from './services/template.js';
import { processBatch } from './utils/batch.js';
import logger from './utils/logger.js';

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

async function main() {
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
    process.exit(1);
  } finally {
    await closeDb();
  }
}

// Run the job
main();