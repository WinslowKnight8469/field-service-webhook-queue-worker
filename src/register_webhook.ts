import { infrai } from './infrai';

async function main(): Promise<void> {
  const publicWebhookUrl = process.env.PUBLIC_WEBHOOK_URL;
  const queue = process.env.FIELD_SERVICE_QUEUE ?? 'field-service-events';
  const secret = process.env.WEBHOOK_SECRET;

  if (!publicWebhookUrl) {
    throw new Error('PUBLIC_WEBHOOK_URL is required');
  }

  if (!secret) {
    throw new Error('WEBHOOK_SECRET is required');
  }

  const queueSubscription = await infrai.queue.push_subscribe(queue, {
    url: publicWebhookUrl
  });

  const webhook = await infrai.account.webhooks.register({
    url: publicWebhookUrl,
    events: ['work_order.photo_uploaded', 'work_order.dispatch_updated', 'work_order.followup_noted'],
    description: 'Field-service intake for work-order updates',
    secret
  });

  console.log(JSON.stringify({
    queue: queueSubscription.queue,
    webhook_id: webhook.id,
    url: publicWebhookUrl
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
