import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useSession } from '../session.jsx';
import { Alert, Ref, Steps } from '../components/index.jsx';
import { ConfirmStatus, ResendPanel } from '../components/auth/ConfirmStatus.jsx';

const clock = (date = new Date()) => date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/**
 * Confirm Your Email: the link in the email is what confirms the address, and a
 * guest cannot book until it is confirmed. This page opens that link, says where
 * the account stands, and sends the email again when it has not arrived — at
 * most five times in any hour.
 */
export function ConfirmEmailPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const { account, refresh, signedIn } = useSession();

  const [email, setEmail] = useState(account?.email ?? location.state?.email ?? '');
  const [state, setState] = useState({ status: 'idle', message: null, at: null, remaining: undefined, retryAt: null });
  const [token, setToken] = useState({ status: 'none', message: null });
  const [checked, setChecked] = useState(null);
  const [confirmed, setConfirmed] = useState(Boolean(account?.email_confirmed));

  useEffect(() => {
    if (account?.email) setEmail((current) => current || account.email);
    setConfirmed(Boolean(account?.email_confirmed));
  }, [account]);

  // The emailed link lands here with its token.
  const token_ = params.get('token');
  useEffect(() => {
    if (!token_) return;
    let live = true;
    setToken({ status: 'checking', message: null });
    api.confirmEmail(token_)
      .then((payload) => {
        if (!live) return;
        setToken({ status: 'confirmed', message: null });
        setConfirmed(true);
        if (payload?.account?.email) setEmail(payload.account.email);
      })
      .catch((error) => {
        if (!live) return;
        setToken({ status: 'refused', message: error.message, code: error.code });
      });
    return () => { live = false; };
  }, [token_]);

  // The registration that just happened may not have reached the guest's inbox,
  // and that is said here rather than only in the log.
  const registrationMail = location.state?.mail;
  useEffect(() => {
    if (registrationMail?.status === 'failed') {
      setState({ status: 'failed', message: registrationMail.error, at: null, remaining: undefined, retryAt: null });
    }
  }, [registrationMail]);

  const checkStatus = useCallback(async () => {
    const fresh = await refresh();
    setChecked(clock());
    if (fresh?.email_confirmed) setConfirmed(true);
    return fresh;
  }, [refresh]);

  const resend = useCallback(async () => {
    if (!email) return;
    setState((current) => ({ ...current, status: 'sending' }));
    try {
      const payload = await api.resendConfirmation(email);
      setState({
        status: 'sent',
        message: null,
        at: clock(),
        remaining: payload?.remaining ?? undefined,
        retryAt: null,
      });
    } catch (error) {
      if (error.status === 429 || error.code === 'resend_limit') {
        setState({
          status: 'limit',
          message: error.message,
          at: null,
          remaining: 0,
          retryAt: error.payload?.retryAt ? clock(new Date(error.payload.retryAt)) : null,
        });
      } else {
        setState({ status: 'failed', message: error.message, at: null, remaining: undefined, retryAt: null });
      }
    }
  }, [email]);

  const sentAt = location.state?.sentAt ?? null;

  return (
    <main id="main">
      <div className="wrap">
        <div className="auth-card auth-card--narrow">
          <div className="auth-card__body">
            <Steps steps={['Account created', 'Confirm your email', 'Book your room']} current={confirmed ? 2 : 1} />

            <h1>Confirm your email</h1>
            <p className="lead">
              We have sent a confirmation email to your address. Open it and select the confirmation link inside, and
              your address is confirmed — then you can book a room.
            </p>

            {email ? <p><Ref>{email}</Ref></p> : (
              <p className="small muted">
                <Link to="/login">Sign in</Link> and your address appears here with its confirmation state.
              </p>
            )}
            <p className="small muted">
              {sentAt ? `Sent at ${sentAt}. ` : ''}
              The link works once and stops working after 24 hours. If it has not arrived, look in your spam folder
              before asking for another.
            </p>

            {token.status === 'refused' ? (
              <Alert kind="error" title={token.code === 'link_expired' ? 'That confirmation link has run out' : 'That confirmation link is not one of ours'}>
                {token.message} Ask for a new email below, and open the link in that one.
              </Alert>
            ) : null}

            {confirmed ? (
              <Alert kind="success" title="Your email address is confirmed">
                Thank you — {email || 'your address'} is confirmed and your account is ready. Continue to your booking
                with the dates and room type you chose.
                <div className="row" style={{ marginTop: 'var(--space-3)' }}>
                  <Link className="btn btn--primary btn--sm" to="/bookings/new">Continue to the booking</Link>
                  <Link className="btn btn--ghost btn--sm" to="/login">Sign in</Link>
                </div>
                <p className="small muted" style={{ marginTop: 'var(--space-3)' }}>
                  Sign in to open Booking Details with your dates and room type still chosen.
                </p>
              </Alert>
            ) : (
              <>
                {email ? (
                  <ConfirmStatus
                    confirmed={confirmed}
                    email={email}
                    lastCheckedAt={checked}
                    checking={false}
                    onCheck={checkStatus}
                  />
                ) : null}
                <ResendPanel
                  email={email || 'your address'}
                  state={state}
                  remaining={state.remaining}
                  retryAt={state.retryAt}
                  onResend={resend}
                />
              </>
            )}

            <p className="small muted" style={{ marginTop: 'var(--space-5)' }}>
              {signedIn ? 'Signed in and confirmed? ' : 'Already confirmed? '}
              <Link to="/login">Sign in</Link> and carry on to your booking.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
