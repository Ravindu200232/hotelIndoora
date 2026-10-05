import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * One loader, three states and a retry.
 *
 * Every list and detail view in the product needs the same thing: it is loading,
 * it has the real data, or it failed and can be tried again. Writing that once
 * keeps every page's loading, empty and error state honest instead of each page
 * inventing its own.
 */
export function useAsync(loader, deps = []) {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const [state, setState] = useState({ status: 'loading', data: null, error: null });

  const run = useCallback(async () => {
    setState({ status: 'loading', data: null, error: null });
    try {
      const data = await loaderRef.current();
      setState({ status: 'ready', data, error: null });
    } catch (error) {
      // The message is the gateway's own: what happened, in the product's words.
      setState({ status: 'error', data: null, error });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { run(); }, [run]);

  return { ...state, reload: run, loading: state.status === 'loading', ready: state.status === 'ready', failed: state.status === 'error' };
}
