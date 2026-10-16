import { supabase } from './supabase';

export type BookArtworkReason = 'wrong_cover' | 'blurry_cover' | 'missing_cover';

export async function submitBookArtworkReport(bookId: string, reason: BookArtworkReason, coverUrl: string | null) {
  const { data, error } = await supabase.rpc('submit_book_artwork_report', {
    p_book_id: bookId, p_reason: reason, p_cover_url: coverUrl,
  });
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883')
      throw new Error('Book reporting is not available on this server yet. Please try again after the beta update.');
    throw new Error(error.message || 'Please try again.');
  }
  return data as string;
}

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
