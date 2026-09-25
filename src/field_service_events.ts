import { z } from 'zod';

export const fieldServiceEventSchema = z.object({
  event_id: z.string().min(1),
  occurred_at: z.string().min(1),
  work_order_id: z.string().min(1),
  technician_id: z.string().min(1),
  dispatch_status: z.enum(['assigned', 'en_route', 'arrived', 'completed']),
  photos: z.array(
    z.object({
      photo_id: z.string().min(1),
      kind: z.enum(['before', 'after', 'issue'])
    })
  ),
  follow_up_note: z.string().default('')
});

export type FieldServiceEvent = z.infer<typeof fieldServiceEventSchema>;
