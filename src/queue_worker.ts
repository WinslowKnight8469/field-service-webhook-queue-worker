import { infrai, InfraiError } from './infrai';
import { fieldServiceEventSchema } from './field_service_events';
import { decideFollowup } from './work_order_followup';

const queue = process.env.FIELD_SERVICE_QUEUE ?? 'field-service-events';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run(): Promise<void> {
  console.log(`worker polling queue ${queue}`);

  for (;;) {
    try {
      const result = await infrai.queue.consume(queue, {
        max_messages: 10,
        visibility_timeout: 60
      });

      const messages = result.messages ?? [];
      if (messages.length === 0) {
        await sleep(1000);
        continue;
      }

      for (const message of messages) {
        const payload = JSON.parse(message.payload);
        const event = fieldServiceEventSchema.parse(payload);
        const decision = decideFollowup(event);

        console.log(JSON.stringify({
          work_order_id: decision.work_order_id,
          followup_state: decision.followup_state,
          summary: decision.summary
        }));

        await infrai.queue.ack(queue, { message_id: message.message_id });
      }
    } catch (error) {
      if (error instanceof InfraiError && error.status >= 400 && error.status < 500) {
        console.error(`worker rejected request: ${error.message}`);
      } else {
        console.error('worker retrying after transient failure');
      }
      await sleep(1500);
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
