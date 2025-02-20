import { PubSub } from '@google-cloud/pubsub';
import logger from '../utils/logger.js';
import { addDailyNotification } from './notifications.js';

const pubsub = new PubSub({
  projectId: process.env.GOOGLE_CLOUD_PROJECT
});

const IMMEDIATE_SUBSCRIPTION = 'email-notifications-immediate-sub';
const DAILY_SUBSCRIPTION = 'email-notifications-daily-sub';

export async function startImmediateSubscriber(messageHandler) {
  const subscription = pubsub.subscription(IMMEDIATE_SUBSCRIPTION);

  subscription.on('message', async (message) => {
    try {
      logger.info('Received immediate notification message', { messageId: message.id });
      
      const data = JSON.parse(message.data.toString());
      await messageHandler(data);
      
      message.ack();
      logger.info('Successfully processed immediate notification', { messageId: message.id });
    } catch (error) {
      logger.error('Failed to process immediate notification', { 
        messageId: message.id, 
        error: error.message 
      });
      message.nack();
    }
  });

  subscription.on('error', (error) => {
    logger.error('Immediate subscription error', { error: error.message });
  });

  logger.info('Started immediate notification subscriber');
}

export async function startDailySubscriber() {
  const subscription = pubsub.subscription(DAILY_SUBSCRIPTION);

  subscription.on('message', async (message) => {
    try {
      logger.info('Received daily notification message', { messageId: message.id });
      
      const data = JSON.parse(message.data.toString());
      addDailyNotification(data);
      
      message.ack();
      logger.info('Successfully added daily notification', { messageId: message.id });
    } catch (error) {
      logger.error('Failed to process daily notification', { 
        messageId: message.id, 
        error: error.message 
      });
      message.nack();
    }
  });

  subscription.on('error', (error) => {
    logger.error('Daily subscription error', { error: error.message });
  });

  logger.info('Started daily notification subscriber');
}