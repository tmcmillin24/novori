import { useEffect, useState } from 'react';
import { getFeedComposerPreview, loadComposerProfile, type ComposerIdentity, type ComposerProfile } from '../lib/club-composer-preview';
import { supabase } from '../lib/supabase';

export type PostComposerProfile = ComposerProfile;

export default function usePostComposerProfile(previewKey?: string, clubPreview?: ComposerIdentity | null) {
  const [entry] = useState(() => getFeedComposerPreview(previewKey));
  const [initial] = useState(() => clubPreview ?? entry?.identity ?? null);
  const [profile, setProfile] = useState<PostComposerProfile | null>(initial?.profile ?? null);

  useEffect(() => {
    let active = true;
    async function verifyProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!active) return;
        if (user?.id !== initial?.userId) setProfile(null);
        if (!user || (initial?.userId === user.id && initial.profile)) return;
        const warmed = await entry?.pending;
        if (!active) return;
        const next = warmed?.userId === user.id && warmed.profile ? warmed.profile : await loadComposerProfile(user.id);
        if (active) setProfile(next);
      } catch {
        if (active) setProfile(null);
      }
    }
    void verifyProfile();
    return () => { active = false; };
  }, [entry, initial]);
  return profile;
}
