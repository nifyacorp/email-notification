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

// Service status endpoint
app.get('/status', (req, res) => {
  const status = {
    service: 'Email Notification Service',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    projectId: process.env.GOOGLE_CLOUD_PROJECT || 'delta-entity-447812-p2',
    pubsub: {
      immediateSubscription: 'email-notifications-immediate-sub',
      dailySubscription: 'email-notifications-daily-sub'
    },
    endpoints: {
      testEmail: '/test-email',
      processDaily: '/process-daily'
    }
  };
  
  res.status(200).json(status);
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
    
    // Template type can be 'immediate', 'daily', or 'test'
    const templateType = req.body?.template || 'test';
    
    let emailContent;
    
    if (templateType === 'daily') {
      // Test daily digest template
      const notifications = [
        {
          title: 'Test Notification 1',
          content: 'This is a test notification content with details about an important event or update from your subscribed source.',
          sourceUrl: 'https://nifya.com/notification/1',
          subscriptionName: 'Test Subscription 1',
          timestamp: new Date().toISOString()
        },
        {
          title: 'Test Notification 2',
          content: 'Another test notification with different content to demonstrate how multiple notifications appear in the daily digest email template.',
          sourceUrl: 'https://nifya.com/notification/2', 
          subscriptionName: 'Test Subscription 2',
          timestamp: new Date().toISOString()
        }
      ];
      
      const html = await render('daily', {
        notifications,
        date: new Date().toLocaleDateString(),
        preferencesUrl: 'https://nifya.com/preferences'
      });
      
      emailContent = {
        to: recipientEmail,
        subject: 'Daily Digest Test - Nifya Notifications',
        html
      };
    } else if (templateType === 'immediate') {
      // Test immediate notification template
      const notification = {
        title: 'Immediate Test Notification',
        content: 'This is a test of an immediate notification that would be sent as soon as it is received by the system.',
        sourceUrl: 'https://nifya.com/notification/immediate-test',
        subscriptionName: 'Test Immediate Source',
        timestamp: new Date().toLocaleString()
      };
      
      const html = await render('immediate', notification);
      
      emailContent = {
        to: recipientEmail,
        subject: notification.title,
        html
      };
    } else {
      // Default test template
      const html = await render('test', {
        timestamp: new Date().toLocaleString(),
        environment: process.env.NODE_ENV || 'development'
      });
      
      emailContent = {
        to: recipientEmail,
        subject: 'Test Email from NIFYA Email Service',
        html
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