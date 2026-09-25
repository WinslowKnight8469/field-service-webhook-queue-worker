import { createHmac, timingSafeEqual } from 'node:crypto';

export function computeSignature(secret: string, rawBody: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

export function verifySignature(secret: string, rawBody: string, providedSignature: string | undefined): boolean {
  if (!providedSignature) {
    return false;
  }

  const expected = Buffer.from(computeSignature(secret, rawBody), 'utf8');
  const received = Buffer.from(providedSignature, 'utf8');

  if (expected.length !== received.length) {
    return false;
  }

  return timingSafeEqual(expected, received);
}
