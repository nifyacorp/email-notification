import { sendEmails } from './email.js';
import { render } from './template.js';
import logger from '../utils/logger.js';

// In-memory store for daily notifications
// In production, consider using Redis or another distributed cache
const dailyNotifications = new Map();

export function addDailyNotification(data) {
  const { userId, email, notification } = data;
  
  // Get or create user's notification list
  if (!dailyNotifications.has(userId)) {
    dailyNotifications.set(userId, { email, notifications: [] });
  }
  
  const userData = dailyNotifications.get(userId);
  userData.notifications.push({
    ...notification,
    timestamp: new Date().toISOString()
  });
  
  logger.info('Added notification to daily digest', { 
    userId,
    notificationCount: userData.notifications.length 
  });
}

export async function processDailyDigests() {
  try {
    logger.info('Starting daily digest processing', {
      userCount: dailyNotifications.size
    });

    const emailPromises = [];

    // Process each user's notifications
    for (const [userId, userData] of dailyNotifications.entries()) {
      if (userData.notifications.length === 0) continue;

      // Group notifications by subscription
      const grouped = userData.notifications.reduce((acc, n) => {
        if (!acc[n.subscriptionName]) {
          acc[n.subscriptionName] = [];
        }
        acc[n.subscriptionName].push(n);
        return acc;
      }, {});

      // Generate email content
      const email = {
        to: userData.email,
        subject: `Daily Notification Summary - ${new Date().toLocaleDateString()}`,
        html: await render('daily', {
          notifications: grouped,
          date: new Date().toLocaleDateString(),
          preferencesUrl: `https://app.nifya.com/settings/notifications?userId=${userId}`
        })
      };

      emailPromises.push(sendEmails([email]));
      
      logger.info('Queued daily digest email', { 
        userId,
        notificationCount: userData.notifications.length 
      });
    }

    // Send all emails
    await Promise.all(emailPromises);
    
    // Clear the notifications after successful processing
    dailyNotifications.clear();
    
    logger.info('Completed daily digest processing');
  } catch (error) {
    logger.error('Failed to process daily digests', { error: error.message });
    throw error;
  }
}