import {getAccountEntryRoute} from '../lib/account-entry';
import { Redirect } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { supabase } from '../lib/supabase';

export default function Index() {
  const sequence=useRef(0);
  const [loading, setLoading] = useState(true);
  const [paused,setPaused]=useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const version=++sequence.current;
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted || version!==sequence.current) {
        return;
      }

      const route=session?await getAccountEntryRoute().catch(()=>null):'/auth';
      if(!mounted||version!==sequence.current)return;
      setPaused(route==='/delete-account');
      setSignedIn(Boolean(session)&&route!=='/auth');
      setLoading(false);
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      // Invalidate old checks and leave the Auth lock before querying account state.
      sequence.current++;
      setTimeout(()=>{if(mounted)void loadSession();},0);
    });

    return () => {
      mounted = false;
      sequence.current++;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return null;
  }

  if(paused)return <Redirect href="/delete-account"/>;
  if (signedIn) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/auth" />;
}
