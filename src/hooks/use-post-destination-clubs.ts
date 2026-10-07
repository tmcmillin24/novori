import { useEffect, useState } from 'react';
import { ClubWithMembership, getMyClubs } from '../lib/clubs';

export default function usePostDestinationClubs() {
  const [clubs, setClubs] = useState<ClubWithMembership[]>([]);
  const [loadingClubs, setLoadingClubs] = useState(true);

  useEffect(() => {
    let active = true;
    void getMyClubs()
      .then((result) => { if (active) setClubs(result); })
      .catch((error) => console.warn('Could not load post destinations:', error))
      .finally(() => { if (active) setLoadingClubs(false); });
    return () => { active = false; };
  }, []);

  return { clubs, loadingClubs };
}
