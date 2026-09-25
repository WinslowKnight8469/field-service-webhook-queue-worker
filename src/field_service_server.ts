import express from 'express';
import { infrai, InfraiError } from './infrai';
import { fieldServiceEventSchema } from './field_service_events';
import { verifySignature } from './webhook_signature';

const app = express();
const port = Number(process.env.PORT ?? '3000');
const queue = process.env.FIELD_SERVICE_QUEUE ?? 'field-service-events';
const secret = process.env.WEBHOOK_SECRET;

if (!secret) {
  throw new Error('WEBHOOK_SECRET is required');
}

app.use(express.text({ type: 'application/json' }));

app.post('/events/field-service', async (req, res) => {
  const rawBody = typeof req.body === 'string' ? req.body : '';
  const signature = req.header('x-webhook-signature');

  if (!verifySignature(secret, rawBody, signature)) {
    res.status(401).json({ accepted: false, reason: 'invalid signature' });
    return;
  }

  const parsed = fieldServiceEventSchema.safeParse(JSON.parse(rawBody));
  if (!parsed.success) {
    res.status(400).json({ accepted: false, reason: 'invalid event body', issues: parsed.error.flatten() });
    return;
  }

  try {
    await infrai.queue.publish(queue, {
      payload: JSON.stringify(parsed.data),
      idempotency_key: parsed.data.event_id
    });

    res.status(202).json({ accepted: true, event_id: parsed.data.event_id });
  } catch (error) {
    if (error instanceof InfraiError && error.status >= 400 && error.status < 500) {
      res.status(400).json({ accepted: false, reason: error.message, details: error.details });
      return;
    }

    res.status(502).json({ accepted: false, reason: 'queue publish failed' });
  }
});

app.listen(port, () => {
  console.log(`field-service receiver listening on http://localhost:${port}/events/field-service`);
});
