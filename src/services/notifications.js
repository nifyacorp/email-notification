import { sendEmails } from './email.js';
import { render } from './template.js';
import logger from '../utils/logger.js';
import { getUsersWithNewNotifications, getUserNotifications, markNotificationsAsSent } from '../database/client.js';

// In-memory store for daily notifications
// In production, consider using Redis or another distributed cache
const dailyNotifications = new Map();

/**
 * Add a notification to the daily digest queue
 * @param {Object} data - Notification data
 */
export function addDailyNotification(data) {
  const { userId, email, notification } = data;

  // Get or create user's notification list
  if (!dailyNotifications.has(userId)) {
    dailyNotifications.set(userId, { email, notifications: [] });
  }

  const userData = dailyNotifications.get(userId);
  userData.notifications.push({
    ...notification,
    timestamp: notification.timestamp || new Date().toISOString()
  });

  logger.info('Added notification to daily digest', {
    userId,
    notificationCount: userData.notifications.length,
    notificationId: notification.id
  });
}

/**
 * Process daily digests for all users with pending notifications
 * This combines both in-memory notifications and database notifications
 */
export async function processDailyDigests() {
  try {
    // Get users with new notifications from the database
    const usersWithDbNotifications = await getUsersWithNewNotifications();
    
    logger.info('Starting daily digest processing', {
      inMemoryUserCount: dailyNotifications.size,
      databaseUserCount: usersWithDbNotifications.length
    });

    // Combine users from in-memory and database
    const allUserIds = new Set([
      ...dailyNotifications.keys(),
      ...usersWithDbNotifications.map(u => u.id)
    ]);

    logger.info(`Processing daily digests for ${allUserIds.size} users`);
    
    const emailPromises = [];
    const processedUserIds = [];

    // Process each user's notifications
    for (const userId of allUserIds) {
      try {
        // Get user info - prefer database info over in-memory
        const dbUser = usersWithDbNotifications.find(u => u.id === userId);
        const memoryData = dailyNotifications.get(userId);
        
        const userEmail = dbUser?.notificationEmail || dbUser?.email || memoryData?.email;
        
        if (!userEmail) {
          logger.warn('No email found for user, skipping digest', { userId });
          continue;
        }

        // Get notifications from database
        const dbNotifications = await getUserNotifications(userId);
        
        // Combine with in-memory notifications
        const allNotifications = [
          ...(dbNotifications || []).map(n => ({
            id: n.id,
            title: n.title,
            content: n.content,
            sourceUrl: n.source_url,
            subscriptionName: n.subscription_name,
            timestamp: n.created_at
          })),
          ...(memoryData?.notifications || [])
        ];

        if (allNotifications.length === 0) {
          logger.info('No notifications for user, skipping digest', { userId });
          continue;
        }

        // Group notifications by subscription
        const grouped = allNotifications.reduce((acc, n) => {
          const key = n.subscriptionName || 'General';
          if (!acc[key]) {
            acc[key] = [];
          }
          acc[key].push(n);
          return acc;
        }, {});

        // Generate email content
        const email = {
          to: userEmail,
          subject: `Resumen de Notificaciones NIFYA - ${new Date().toLocaleDateString()}`,
          html: await render('daily', {
            notifications: grouped,
            date: new Date().toLocaleDateString(),
            preferencesUrl: `https://app.nifya.com/settings/notifications?userId=${userId}`
          })
        };

        emailPromises.push(sendEmails([email]));
        processedUserIds.push(userId);

        logger.info('Queued daily digest email', {
          userId,
          email: userEmail,
          notificationCount: allNotifications.length
        });
        
        // Mark database notifications as sent
        if (dbNotifications && dbNotifications.length > 0) {
          const notificationIds = dbNotifications.map(n => n.id);
          await markNotificationsAsSent(notificationIds);
          
          logger.info('Marked notifications as sent', {
            userId,
            count: notificationIds.length
          });
        }
      } catch (userError) {
        logger.error('Error processing digest for user', {
          userId,
          error: userError.message
        });
        // Continue with other users
      }
    }

    // Send all emails
    await Promise.all(emailPromises);

    // Clear the processed notifications from memory
    for (const userId of processedUserIds) {
      dailyNotifications.delete(userId);
    }

    logger.info('Completed daily digest processing', {
      processedUsers: processedUserIds.length
    });
  } catch (error) {
    logger.error('Failed to process daily digests', { 
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}