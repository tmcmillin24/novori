import { useEffect, useState } from 'react';
import { getFeedComposerPreview, loadComposerProfile, type ComposerIdentity, type ComposerProfile } from '../lib/club-composer-preview';
import { supabase } from '../lib/supabase';

export type PostComposerProfile = ComposerProfile;

export default function usePostComposerProfile(previewKey?: string, clubPreview?: ComposerIdentity | null) {
  const [initial] = useState(() => clubPreview ?? getFeedComposerPreview(previewKey));
  const [profile, setProfile] = useState<PostComposerProfile | null>(initial?.profile ?? null);

  useEffect(() => {
    let active = true;
    async function verifyProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!active) return;
        if (user?.id !== initial?.userId) setProfile(null);
        if (!user || (initial?.userId === user.id && initial.profile)) return;
        const next = await loadComposerProfile(user.id);
        if (active) setProfile(next);
      } catch {
        if (active) setProfile(null);
      }
    }
    void verifyProfile();
    return () => { active = false; };
  }, [initial]);
  return profile;
}
