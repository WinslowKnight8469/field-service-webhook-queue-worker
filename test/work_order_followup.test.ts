import { describe, expect, it } from 'vitest';
import { decideFollowup } from '../src/work_order_followup';

describe('decideFollowup', () => {
  it('marks a completed work order with a callback note as follow_up_required', () => {
    const result = decideFollowup({
      event_id: 'evt_100',
      occurred_at: '2026-01-15T12:00:00Z',
      work_order_id: 'wo_42',
      technician_id: 'tech_9',
      dispatch_status: 'completed',
      photos: [],
      follow_up_note: 'Customer requested callback tomorrow'
    });

    expect(result).toEqual({
      work_order_id: 'wo_42',
      followup_state: 'follow_up_required',
      summary: 'Dispatch completed and technician requested customer follow-up.'
    });
  });
});
