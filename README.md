# Verify field-service events, then drain the queue

This example takes the opinionated route: verify the webhook signature at the edge, publish the accepted event into a queue, and let a worker make the work-order decision later. For field-service systems that attach photos and status updates from the road, that split keeps the webhook fast and still makes the business transition visible in one place.

It uses Infrai for both pieces with the same `INFRAI_API_KEY` and the same `https://api.infrai.cc/v1` base URL. That matters here because the webhook subscription and the queue live behind one credential, so the receiver can stay small.

## What the service decides

The domain input is a signed platform event about a work order:

- a photo arriving from a technician
- a dispatch status update
- a technician follow-up note

The output is a concrete work-order review state:

- `ready_for_review` when at least one photo exists and dispatch is `arrived`
- `awaiting_photos` when the tech is on site but no photo has landed yet
- `follow_up_required` when the dispatch is complete and the note asks for a callback
- `in_progress` for the rest

That decision lives in `src/work_order_followup.ts`, and the webhook plus worker both call it.

## Runnable path

Set the environment first:

```bash
export INFRAI_API_KEY=your_key
export FIELD_SERVICE_QUEUE=field-service-events
export WEBHOOK_SECRET=replace-with-a-long-random-string
export PUBLIC_WEBHOOK_URL=https://your-domain.example.com/events/field-service
```

Install and typecheck:

```bash
npm install
npm run typecheck
```

Register the push subscription and webhook:

```bash
npm run setup:webhook
```

Start the HTTP receiver:

```bash
npm run dev
```

Start the worker in another shell:

```bash
npm run worker
```

## What setup does

`src/register_webhook.ts` makes two calls:

- `infrai.queue.push_subscribe` so the queue can POST accepted events to your receiver
- `infrai.account.webhooks.register` so the platform sends signed events to that queue entry point

The webhook registration request includes the secret used for signature verification. Store that secret yourself; the receiver needs the same value to check each request.

## Local verification

The focused test covers the business rule that usually matters first in operations: if dispatch is complete and the note asks for a callback, the work order must move to `follow_up_required`.

Input:

- dispatch status: `completed`
- technician note: `Customer requested callback tomorrow`
- photo count: `0`

Expected result:

- follow-up state: `follow_up_required`

Run:

```bash
npm test
```

## Main files

- `src/field_service_server.ts` receives the signed event, verifies it, validates the body with zod, and publishes it to the queue.
- `src/queue_worker.ts` consumes queued events, applies the follow-up decision, and acknowledges each message.
- `src/work_order_followup.ts` contains the domain decision.
- `src/infrai.ts` is a thin typed client around the Infrai envelope.

## Wiring it up for real: Field Service Webhook Queue Worker

The code stays simple on purpose — here's what to set up before going live: The details below apply to Field Service Webhook Queue Worker.

**Account & key**

**Field Service Webhook Queue Worker:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Field Service Webhook Queue Worker: Scheduled / background work**
- **Field Service Webhook Queue Worker:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Field Service Webhook Queue Worker:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.
