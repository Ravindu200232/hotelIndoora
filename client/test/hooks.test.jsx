import { describe, it, expect } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAsync } from '../src/hooks/useAsync.jsx';

/**
 * The one loader every list and detail view in the product uses.
 *
 * It has three states and a retry, and every page depends on them being honest:
 * a failure has to arrive as a message a page can show, not as an empty list that
 * reads like "there is nothing here".
 */
describe('loading, ready and failed', () => {
  it('starts loading, then answers with the data', async () => {
    const { result } = renderHook(() => useAsync(async () => ({ room_types: [{ name: 'Garden Double' }] }), []));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBe(null);

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.data.room_types[0].name).toBe('Garden Double');
    expect(result.current.failed).toBe(false);
  });

  it('carries the refusal\'s own message when the call fails', async () => {
    const refusal = Object.assign(new Error('Your account cannot open this'), { status: 403 });
    const { result } = renderHook(() => useAsync(async () => { throw refusal; }, []));

    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.error.message).toBe('Your account cannot open this');
    expect(result.current.error.status).toBe(403);
    expect(result.current.data).toBe(null);
  });

  it('goes back to loading and can succeed when the same load is tried again', async () => {
    let attempt = 0;
    const loader = async () => {
      attempt += 1;
      if (attempt === 1) throw new Error('the list did not come back');
      return { total: 26 };
    };
    const { result } = renderHook(() => useAsync(loader, []));

    await waitFor(() => expect(result.current.failed).toBe(true));

    await act(async () => { await result.current.reload(); });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.data.total).toBe(26);
    expect(result.current.error).toBe(null);
  });
});
