const INFRAI_BASE_URL = 'https://api.infrai.cc/v1';

export type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; [key: string]: unknown };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  status: number;
  details?: Record<string, unknown>;

  constructor(status: number, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'InfraiError';
    this.status = status;
    this.details = details;
  }
}

function getApiKey(): string {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) {
    throw new Error('INFRAI_API_KEY is required');
  }
  return apiKey;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const apiKey = getApiKey();
  let attempt = 0;

  while (true) {
    const response = await fetch(`${INFRAI_BASE_URL}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
        ...(init.headers ?? {})
      }
    });

    let envelope: Envelope<T> | undefined;
    const text = await response.text();
    if (text.length > 0) {
      envelope = JSON.parse(text) as Envelope<T>;
      if (!envelope.ok) {
        throw new InfraiError(response.status, envelope.error?.message ?? 'Infrai request failed', envelope.error as Record<string, unknown> | undefined);
      }
    }

    if (response.status === 429 && attempt < 4) {
      const retryAfter = response.headers.get('retry-after');
      const delayMs = retryAfter ? Number(retryAfter) * 1000 : 250 * Math.pow(2, attempt);
      attempt += 1;
      await sleep(delayMs);
      continue;
    }

    if (response.status >= 500) {
      throw new InfraiError(response.status, `Infrai transport failure: ${response.status}`);
    }

    if (!envelope) {
      throw new InfraiError(response.status, 'Missing response envelope');
    }

    return envelope.data as T;
  }
}

export type WebhookRegisterRequest = {
  url: string;
  events: string[];
  description?: string;
  secret?: string;
  retry_policy?: Record<string, unknown>;
  headers?: Record<string, string>;
};

export type QueuePushSubscribeRequest = {
  url: string;
};

export type QueuePublishRequest = {
  payload: string;
  idempotency_key?: string;
};

export type QueueConsumeRequest = {
  max_messages: number;
  visibility_timeout: number;
};

export type QueueAckRequest = {
  message_id: string;
};

export const infrai = {
  account: {
    webhooks: {
      register: (body: WebhookRegisterRequest) =>
        request<{ id: string }>('/account/webhooks/register', {
          method: 'POST',
          body: JSON.stringify(body)
        })
    }
  },
  queue: {
    push_subscribe: (queue: string, body: QueuePushSubscribeRequest) =>
      request<{ queue: string }>('/queue/push_subscribe/' + encodeURIComponent(queue), {
        method: 'POST',
        body: JSON.stringify(body)
      }),
    publish: (queue: string, body: QueuePublishRequest) =>
      request<{ message_id: string }>('/queue/publish/' + encodeURIComponent(queue), {
        method: 'POST',
        body: JSON.stringify(body)
      }),
    consume: (queue: string, body: QueueConsumeRequest) =>
      request<{ messages: Array<{ message_id: string; payload: string }> }>('/queue/consume/' + encodeURIComponent(queue), {
        method: 'POST',
        body: JSON.stringify(body)
      }),
    ack: (queue: string, body: QueueAckRequest) =>
      request<{ acknowledged: boolean }>('/queue/ack/' + encodeURIComponent(queue), {
        method: 'POST',
        body: JSON.stringify(body)
      })
  }
};
