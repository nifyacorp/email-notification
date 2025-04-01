import express from 'express';
import { sendEmails } from './services/email.js';
import { render } from './services/template.js';
import { startImmediateSubscriber, startDailySubscriber } from './services/pubsub.js';
import { processDailyDigests } from './services/notifications.js';
import { shouldReceiveInstantNotifications, markNotificationsAsSent } from './database/client.js';
import logger from './utils/logger.js';

const app = express();
app.use(express.json());
const port = process.env.PORT || 8080;

// Health check endpoint
app.get('/', (req, res) => {
  res.status(200).send('Email service is running');
});

// Test email endpoint
app.post('/test-email', async (req, res) => {
  try {
    logger.info('Received test email request', {
      body: JSON.stringify(req.body),
      email: req.body?.email,
      contentType: req.headers['content-type']
    });

    // Use email from request, env var, or default
    const recipientEmail = req.body?.email || process.env.TEST_EMAIL || 'nifyacorp@gmail.com';
    
    // Template type can be 'immediate' or 'daily' to test different templates
    const templateType = req.body?.template || 'immediate';
    
    let emailContent;
    
    if (templateType === 'daily') {
      // Test daily digest template
      const notifications = [
        {
          title: 'Test Notification 1',
          content: 'This is a test notification content 1',
          sourceUrl: 'https://nifya.com/notification/1',
          subscriptionName: 'Test Subscription 1',
          timestamp: new Date().toISOString()
        },
        {
          title: 'Test Notification 2',
          content: 'This is a test notification content 2',
          sourceUrl: 'https://nifya.com/notification/2', 
          subscriptionName: 'Test Subscription 2',
          timestamp: new Date().toISOString()
        }
      ];
      
      import { render } from './services/template.js';
      const html = await render('daily', {
        notifications,
        date: new Date().toLocaleDateString()
      });
      
      emailContent = {
        to: recipientEmail,
        subject: 'Daily Digest Test - Nifya Notifications',
        html
      };
    } else {
      // Test immediate notification template
      emailContent = {
        to: recipientEmail,
        subject: 'Test Immediate Notification from Nifya',
        html: `
          <h1>Test Email</h1>
          <p>This is a test email sent from the Nifya Email Service.</p>
          <p>Time sent: ${new Date().toISOString()}</p>
          <p>Environment: ${process.env.NODE_ENV || 'development'}</p>
          <p>Service: Email Notification Service</p>
          <p>Project ID: delta-entity-447812-p2</p>
        `
      };
    }

    await sendEmails([emailContent]);
    res.status(200).json({ 
      message: 'Test email sent successfully',
      details: {
        recipient: recipientEmail,
        template: templateType,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to send test email', {
      error: error.message,
      stack: error.stack,
      code: error.code,
      command: error.command
    });
    res.status(500).json({ error: 'Failed to send test email', details: error.message });
  }
});

// Trigger daily digest processing
app.post('/process-daily', async (req, res) => {
  try {
    await processDailyDigests();
    res.status(200).json({ message: 'Daily digest processing completed successfully' });
  } catch (error) {
    logger.error('Failed to process daily digests', { error: error.message });
    res.status(500).json({ error: 'Failed to process daily digests' });
  }
});

// Handle immediate email notifications
async function handleImmediateNotification(data) {
  try {
    logger.info('Processing immediate notification', { 
      userId: data.userId,
      notificationId: data.notification.id
    });

    // Double-check if the user should receive immediate notifications
    // This ensures the test user always gets notifications and respects user preferences
    const { shouldSend, email } = await shouldReceiveInstantNotifications(data.userId);
    
    if (!shouldSend) {
      logger.info('User should not receive immediate notifications, skipping', { 
        userId: data.userId,
        email: data.email
      });
      return;
    }
    
    // Use the email from the database check if available, otherwise use the one from the message
    const recipientEmail = email || data.email;
    
    if (!recipientEmail) {
      logger.error('No email address available for user', { userId: data.userId });
      return;
    }

    const emailContent = {
      to: recipientEmail,
      subject: data.notification.title,
      html: await render('immediate', {
        title: data.notification.title,
        content: data.notification.content,
        sourceUrl: data.notification.sourceUrl,
        subscriptionName: data.notification.subscriptionName,
        timestamp: new Date(data.timestamp).toLocaleString()
      })
    };

    await sendEmails([emailContent]);
    
    // Mark the notification as sent in the database
    if (data.notification.id) {
      await markNotificationsAsSent([data.notification.id]);
    }
    
    logger.info('Immediate notification email sent successfully', {
      userId: data.userId,
      email: recipientEmail,
      notificationId: data.notification.id
    });
  } catch (error) {
    logger.error('Failed to process immediate notification', {
      error: error.message,
      stack: error.stack,
      userId: data.userId,
      notificationId: data.notification?.id
    });
  }
}

// Start the server
app.listen(port, async () => {
  logger.info(`Email service listening on port ${port}`);

  // Start Pub/Sub subscribers
  await startImmediateSubscriber(handleImmediateNotification);
  await startDailySubscriber();

  logger.info('Pub/Sub subscribers initialized');
});