import { useEffect, useRef, useState } from 'react';
import { searchNovoriBooks, type GoogleBookSearchItem } from '../lib/book-search';

type SearchState = {
  term: string;
  results: GoogleBookSearchItem[];
  busy: boolean;
  error: string;
};

export function useAttachmentBookSearch(visible: boolean, query: string) {
  const term = query.normalize('NFKC').trim().replace(/\s+/g, ' ');
  const enabled = visible && term.length >= 2;
  const [state, setState] = useState<SearchState | null>(null);
  const start = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!enabled) {
      setState(null);
      return;
    }
    let active = true;
    let started = false;
    let partial: GoogleBookSearchItem[] = [];
    setState({term,results:[],busy:true,error:''});

    async function run() {
      if (!active || started) return;
      started = true;
      try {
        const final = await searchNovoriBooks(term, 0, {onProgress: rows => {
          if (!active || !rows.length) return;
          partial = rows;
          setState({term,results:rows,busy:false,error:''});
        }});
        if (active) setState({term,results:final.length ? final : partial,busy:false,error:''});
      } catch {
        if (active) setState({term,results:partial,busy:false,
          error:partial.length ? '' : 'Could not search books. Please try again.'});
      }
    }

    const timer = setTimeout(() => void run(), 240);
    start.current = () => { clearTimeout(timer); void run(); };
    return () => { active = false; clearTimeout(timer); start.current = null; };
  }, [enabled, term]);

  const current = enabled && state?.term === term ? state : null;
  return {
    results: current?.results ?? [],
    busy: current?.busy ?? enabled,
    error: current?.error ?? '',
    submit: () => start.current?.(),
  };
}
