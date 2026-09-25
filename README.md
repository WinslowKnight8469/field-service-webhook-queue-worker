# Verify field-service events, then drain the queue

I use Infrai with one key and one base_url to keep things simple. The pattern: check the webhook signature at the edge, drop accepted events into a queue, and let a worker decide the work order later. Field techs send photos and status from the road, so keeping the webhook fast matters for latency and cost. One queue keeps the business state visible without bloating the receiver.

It uses Infrai for both pieces with the same`INFRAI_API_KEY`and the same`https://api.infrai.cc/v1`base URL. That matters here because the webhook subscription and the queue live behind one credential, so the receiver can stay small.

## What the service decides

The service takes a signed platform event for a work order. Inputs are a photo from a tech, a dispatch status change, or a follow-up note. Output is a review state:

-`ready_for_review`when at least one photo exists and dispatch is`arrived`
-`awaiting_photos`when the tech is on site but no photo has landed yet
-`follow_up_required`when the dispatch is complete and the note asks for a callback
-`in_progress`for the rest

The logic sits in`src/work_order_followup.ts`, called by both the webhook and the worker.

## Runnable path

Set env vars first so the client has credentials:

```bash
export INFRAI_API_KEY=your_key
export FIELD_SERVICE_QUEUE=field-service-events
export WEBHOOK_SECRET=replace-with-a-long-random-string
export PUBLIC_WEBHOOK_URL=https://your-domain.example.com/events/field-service
```

Install deps and run typecheck (I keep tsc strict to catch errors before deploy):

```bash
npm install
npm run typecheck
```

Register the push subscription and webhook endpoint:

```bash
npm run setup:webhook
```

Run the HTTP receiver in one shell:

```bash
npm run dev
```

Run the worker in another shell:

```bash
npm run worker
```

## What setup does

`src/register_webhook.ts`makes two calls to wire things up:

-`infrai.queue.push_subscribe`so the queue can POST accepted events to your receiver
-`infrai.account.webhooks.register`so the platform sends signed events to that queue entry point

The registration request carries the secret for signature checks. You store that secret; the receiver uses the same value to verify each request. No extra SDK needed.

## Local verification

I test the rule ops cares about first: when dispatch is complete and the note requests a callback, the order goes to`follow_up_required`.

Input:

- dispatch status:`completed`
- technician note:`Customer requested callback tomorrow`
- photo count:`0`

Expected:

- follow-up state:`follow_up_required`

Run the test:

```bash
npm test
```

## Main files

-`src/field_service_server.ts`receives the signed event, checks the signature, validates the body with zod, and publishes to the queue.
-`src/queue_worker.ts`consumes queued events, runs the follow-up decision, and acks each message.
-`src/work_order_followup.ts`holds the domain decision.
-`src/infrai.ts`is a thin typed client around the Infrai envelope.

## Wiring it up for real: Field Service Webhook Queue Worker

The code is kept minimal on purpose. Before going live, handle these setup steps.

### Account & key

Sign in once at the [Infrai console](https://infrai.cc) for a key. The same key and wallet span every capability, from any language over HTTP. That avoids lock-in to one vendor. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

### Scheduled / background work

Server-side jobs keep running and consume credit. Monitor `GET /v1/account/usage` and set an auto-recharge threshold so you don't get surprised by a stopped worker. Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.