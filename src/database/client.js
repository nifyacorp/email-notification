import pg from 'pg';
const { Pool } = pg;

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

export async function getUsersWithNewNotifications() {
  const query = `
    SELECT DISTINCT
      u.id,
      u.email,
      u.name,
      u.preferences->>'language' as language,
      u.notification_settings->>'emailNotifications' as "emailNotifications",
      u.notification_settings->>'notificationEmail' as "notificationEmail"
    FROM users u
    JOIN notifications n ON n.user_id = u.id
    WHERE 
      n.created_at > CURRENT_DATE - INTERVAL '1 day'
      AND n.created_at <= CURRENT_DATE
      AND (u.notification_settings->>'emailNotifications')::boolean = true
      AND NOT n.read;
  `;
  
  const result = await pool.query(query);
  return result.rows;
}

export async function getUserNotifications(userId) {
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
      AND NOT n.read
    ORDER BY n.created_at DESC;
  `;
  
  const result = await pool.query(query, [userId]);
  return result.rows;
}

export async function close() {
  await pool.end();
}