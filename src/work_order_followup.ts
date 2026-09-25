import type { FieldServiceEvent } from './field_service_events';

export type FollowupState = 'ready_for_review' | 'awaiting_photos' | 'follow_up_required' | 'in_progress';

export type WorkOrderDecision = {
  work_order_id: string;
  followup_state: FollowupState;
  summary: string;
};

function needsCallback(note: string): boolean {
  return /callback|call back|call me|contact/i.test(note);
}

export function decideFollowup(event: FieldServiceEvent): WorkOrderDecision {
  if (event.dispatch_status === 'completed' && needsCallback(event.follow_up_note)) {
    return {
      work_order_id: event.work_order_id,
      followup_state: 'follow_up_required',
      summary: 'Dispatch completed and technician requested customer follow-up.'
    };
  }

  if (event.dispatch_status === 'arrived' && event.photos.length > 0) {
    return {
      work_order_id: event.work_order_id,
      followup_state: 'ready_for_review',
      summary: 'Technician arrived on site and uploaded at least one photo.'
    };
  }

  if (event.dispatch_status === 'arrived' && event.photos.length === 0) {
    return {
      work_order_id: event.work_order_id,
      followup_state: 'awaiting_photos',
      summary: 'Technician is on site; waiting for photo evidence.'
    };
  }

  return {
    work_order_id: event.work_order_id,
    followup_state: 'in_progress',
    summary: 'Work order is still moving through dispatch.'
  };
}
