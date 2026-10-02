import { useCallback, useEffect, useState } from 'react';

export type AsyncListStatus = 'loading' | 'success' | 'empty' | 'error';

export interface AsyncListState<T> {
  status: AsyncListStatus;
  data: T[];
  error: unknown;
  reload: () => void;
  /** Direct local update (e.g. optimistic edits) without re-fetching or touching status. */
  setData: (updater: T[] | ((prev: T[]) => T[])) => void;
}

/**
 * Wraps a list fetch with loading/empty/error status, so pages don't each
 * reinvent "did this fail or is it just empty" - a resolved empty array is
 * 'empty', a thrown/rejected call is 'error' (with a retry), anything else
 * is 'success'.
 */
export function useAsyncList<T>(fetcher: () => Promise<T[]>, deps: unknown[] = []): AsyncListState<T> {
  const [status, setStatus] = useState<AsyncListStatus>('loading');
  const [data, setData] = useState<T[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    fetcher()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setStatus(result.length === 0 ? 'empty' : 'success');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err);
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  return { status, data, error, reload, setData };
}
