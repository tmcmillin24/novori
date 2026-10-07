import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type PostComposerProfile = {
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export default function usePostComposerProfile() {
  const [profile, setProfile] = useState<PostComposerProfile | null>(null);

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data, error } = await supabase.from('profiles')
          .select('display_name, username, avatar_url').eq('id', user.id).single();
        if (error) throw error;
        if (active) setProfile(data as PostComposerProfile);
      } catch (error) {
        console.warn('Could not load post author:', error);
      }
    }
    void loadProfile();
    return () => { active = false; };
  }, []);

  return profile;
}
