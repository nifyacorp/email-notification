import pg from 'pg';
const { Pool } = pg;
import logger from '../utils/logger.js';

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST || `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`,
  // Enable SSL in production
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
};

const pool = new Pool(config);

/**
 * Get all users who have new unread notifications and have email notifications enabled
 * @returns {Promise<Array>} Array of user objects
 */
export async function getUsersWithNewNotifications() {
  try {
    const query = `
      SELECT DISTINCT
        u.id,
        u.email,
        u.name,
        u.notification_settings->>'language' as language,
        u.notification_settings->>'emailNotifications' as "emailNotifications",
        u.notification_settings->>'notificationEmail' as "notificationEmail",
        u.notification_settings->>'emailFrequency' as "emailFrequency"
      FROM users u
      JOIN notifications n ON n.user_id = u.id
      WHERE
        n.created_at > CURRENT_DATE - INTERVAL '1 day'
        AND n.created_at <= CURRENT_DATE
        AND (u.notification_settings->>'emailNotifications')::boolean = true
        AND NOT n.email_sent
        AND u.email_verified = true;
    `;

    const result = await pool.query(query);
    logger.info(`Found ${result.rows.length} users with new notifications`);
    return result.rows;
  } catch (error) {
    logger.error('Error getting users with new notifications', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Get all unread notifications for a user created in the last 24 hours
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of notification objects
 */
export async function getUserNotifications(userId) {
  try {
    const query = `
      SELECT
        n.id,
        n.title,
        n.content,
        n.source_url,
        n.metadata,
        n.created_at,
        s.name as subscription_name,
        s.type_id
      FROM notifications n
      JOIN subscriptions s ON s.id = n.subscription_id
      WHERE
        n.user_id = $1
        AND n.created_at > CURRENT_DATE - INTERVAL '1 day'
        AND n.created_at <= CURRENT_DATE
        AND NOT n.email_sent
      ORDER BY n.created_at DESC;
    `;

    const result = await pool.query(query, [userId]);
    logger.info(`Found ${result.rows.length} notifications for user ${userId}`);
    return result.rows;
  } catch (error) {
    logger.error('Error getting user notifications', {
      error: error.message,
      userId,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Mark notifications as sent via email
 * @param {Array<string>} notificationIds - Array of notification IDs
 * @returns {Promise<boolean>} Success status
 */
export async function markNotificationsAsSent(notificationIds) {
  if (!notificationIds || notificationIds.length === 0) {
    return true;
  }
  
  try {
    const placeholders = notificationIds.map((_, i) => `$${i + 1}`).join(',');
    const query = `
      UPDATE notifications
      SET 
        email_sent = true,
        email_sent_at = CURRENT_TIMESTAMP
      WHERE id IN (${placeholders})
    `;

    const result = await pool.query(query, notificationIds);
    logger.info(`Marked ${result.rowCount} notifications as sent`);
    return true;
  } catch (error) {
    logger.error('Error marking notifications as sent', {
      error: error.message,
      notificationCount: notificationIds.length,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Check if a user should receive instant notifications
 * @param {string} userId - User ID
 * @returns {Promise<{shouldSend: boolean, email: string|null}>} Result object
 */
export async function shouldReceiveInstantNotifications(userId) {
  try {
    const query = `
      SELECT 
        email,
        notification_settings->>'notificationEmail' as notification_email,
        (notification_settings->>'instantNotifications')::boolean as instant_notifications,
        email = 'nifyacorp@gmail.com' as is_test_user,
        (notification_settings->>'emailNotifications')::boolean as email_notifications
      FROM users
      WHERE id = $1 AND email_verified = true
    `;

    const result = await pool.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return { shouldSend: false, email: null };
    }

    const user = result.rows[0];
    const shouldSend = (user.instant_notifications || user.is_test_user) && user.email_notifications;
    const email = user.notification_email || user.email;

    return { shouldSend, email };
  } catch (error) {
    logger.error('Error checking if user should receive instant notifications', {
      error: error.message,
      userId,
      stack: error.stack
    });
    return { shouldSend: false, email: null };
  }
}

export async function close() {
  await pool.end();
}