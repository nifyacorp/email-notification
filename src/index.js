import express from 'express';
import { sendEmails } from './services/email.js';
import { render } from './services/template.js';
import { startImmediateSubscriber, startDailySubscriber } from './services/pubsub.js';
import { processDailyDigests } from './services/notifications.js';
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

    if (!req.body || !req.body.email) {
      logger.error('Invalid request - missing email', { body: JSON.stringify(req.body) });
      return res.status(400).json({ error: 'Email address is required' });
    }

    const testEmail = {
      to: req.body.email || process.env.TEST_EMAIL || 'test@nifya.com',
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
    logger.error('Failed to send test email', { 
      error: error.message,
      stack: error.stack,
      code: error.code,
      command: error.command
    });
    res.status(500).json({ error: 'Failed to send test email' });
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
  logger.info('Processing immediate notification', { userId: data.userId });
  
  const email = {
    to: data.email,
    subject: data.notification.title,
    html: await render('immediate', {
      title: data.notification.title,
      content: data.notification.content,
      sourceUrl: data.notification.sourceUrl,
      subscriptionName: data.notification.subscriptionName,
      timestamp: new Date(data.timestamp).toLocaleString()
    })
  };
  
  await sendEmails([email]);
}

// Start the server
app.listen(port, async () => {
  logger.info(`Email service listening on port ${port}`);
  
  // Start Pub/Sub subscribers
  await startImmediateSubscriber(handleImmediateNotification);
  await startDailySubscriber();
  
  logger.info('Pub/Sub subscribers initialized');
});