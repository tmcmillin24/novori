import { supabase } from './supabase';

export type ReportReason =
  | 'explicit_content'
  | 'hate'
  | 'harassment'
  | 'spam'
  | 'impersonation'
  | 'other';

export async function submitPostReport(
  postId: string,
  reason: ReportReason
) {
  const {
    data,
    error,
  } = await supabase.rpc(
    'submit_content_report',
    {
      p_target_type: 'post',
      p_target_id: postId,
      p_reason: reason,
    }
  );

  if (error) {
    throw error;
  }

  return data as string;
}


export async function submitCommentReport(
  commentId: string,
  reason: ReportReason
) {
  const {
    data,
    error,
  } = await supabase.rpc(
    'submit_content_report',
    {
      p_target_type: 'comment',
      p_target_id: commentId,
      p_reason: reason,
    }
  );

  if (error) {
    throw error;
  }

  return data as string;
}


export async function submitProfileReport(
  profileId: string,
  reason: ReportReason
) {
  const {
    data,
    error,
  } = await supabase.rpc(
    'submit_content_report',
    {
      p_target_type: 'profile',
      p_target_id: profileId,
      p_reason: reason,
    }
  );

  if (error) {
    throw error;
  }

  return data as string;
}
