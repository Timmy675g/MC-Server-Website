import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { apiUrl } from '../lib/api-base';

const APPLY_SUBMIT_FLAG = 'sk_apply_submitted';
const APPLY_LAST_SUBMIT_KEY = 'sk_apply_last_submit_ms';
const APPLY_RATE_LIMIT_MS = 90 * 1000;
const APPLY_MIN_FILL_MS = 4000;
function nowMs(): number {
  return Date.now();
}

export default function ApplyPage() {
  const [startedAt] = useState<number>(nowMs());
  const [error, setError] = useState<string>('');
  const [statusError, setStatusError] = useState<string>('');
  const [statusLookupUsername, setStatusLookupUsername] = useState<string>('');
  const [statusLookupBusy, setStatusLookupBusy] = useState<boolean>(false);
  const [submittedUsername, setSubmittedUsername] = useState<string>('');
  const [currentStatus, setCurrentStatus] = useState<string>('');
  const [showSuccess, setShowSuccess] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;

    const params = new URLSearchParams(window.location.search);
    const isApplied = params.get('applied') === '1';
    if (!isApplied) return false;

    try {
      return sessionStorage.getItem(APPLY_SUBMIT_FLAG) === '1';
    } catch {
      return false;
    }
  });
  const [submitting, setSubmitting] = useState(false);

  const isFileProtocol = (() => {
    if (typeof window === 'undefined') return false;
    return window.location.protocol === 'file:';
  })();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isApplied = params.get('applied') === '1';

    let submittedFromSession = false;
    try {
      submittedFromSession = sessionStorage.getItem(APPLY_SUBMIT_FLAG) === '1';
    } catch {
      submittedFromSession = false;
    }

    if (isApplied && submittedFromSession) {
      try {
        sessionStorage.removeItem(APPLY_SUBMIT_FLAG);
      } catch {
        // Ignore storage errors.
      }
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (isApplied) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!showSuccess) return;

    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowSuccess(false);
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onEsc);

    const timer = window.setTimeout(() => setShowSuccess(false), 25000);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onEsc);
      window.clearTimeout(timer);
    };
  }, [showSuccess]);

  const pullApplicationStatus = async (username: string) => {
    const safeUsername = String(username || '').trim();
    if (!safeUsername) {
      setStatusError('Please enter a Minecraft Username to check status.');
      return;
    }

    setStatusLookupBusy(true);
    setStatusError('');

    try {
      const response = await fetch(apiUrl(`/status/${encodeURIComponent(safeUsername)}`), {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatusError(String(payload?.error || 'Unable to fetch status right now.'));
        return;
      }

      setSubmittedUsername(String(payload?.username || safeUsername));
      setCurrentStatus(String(payload?.status || 'Pending'));
    } catch {
      setStatusError('Network error while checking status. Please try again.');
    } finally {
      setStatusLookupBusy(false);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);

    setError('');

    const honey = String(formData.get('website') || '').trim();
    if (honey) {
      setError('Spam check failed. Please refresh the page and try again.');
      return;
    }

    if (isFileProtocol) {
      setError('Please open this page through a web server (http://localhost:...) because API requests do not work on file:// pages.');
      return;
    }

    const elapsed = nowMs() - startedAt;
    if (elapsed < APPLY_MIN_FILL_MS) {
      setError('Please review your form for a few seconds before submitting.');
      return;
    }

    try {
      const lastSubmitTs = Number(localStorage.getItem(APPLY_LAST_SUBMIT_KEY) || '0');
      if (lastSubmitTs > 0 && nowMs() - lastSubmitTs < APPLY_RATE_LIMIT_MS) {
        const waitSec = Math.ceil((APPLY_RATE_LIMIT_MS - (nowMs() - lastSubmitTs)) / 1000);
        setError(`Please wait ${waitSec}s before submitting another application.`);
        return;
      }
    } catch {
      // Ignore storage errors.
    }

    const username = String(formData.get('mc_username') || '').trim();
    const discordTag = String(formData.get('discord_username') || '').trim();
    const grade = String(formData.get('grade') || '').trim();
    const school = String(formData.get('school') || '').trim();
    const invitedBy = String(formData.get('invited_by') || '').trim();
    const reason = String(formData.get('motivation') || '').trim();
    const agreementConfirmed = formData.get('agreement_confirmed') === 'on';

    if (!username || !discordTag || !grade || !school || !invitedBy || !reason) {
      setError('Please fill out all required fields before submitting.');
      return;
    }

    if (!agreementConfirmed) {
      setError('You must accept the server rules acknowledgment to submit.');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(apiUrl('/apply'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          username,
          discord_tag: discordTag,
          grade,
          school,
          invited_by: invitedBy,
          reason,
          agreement_confirmed: agreementConfirmed,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (response.redirected) {
        setError('Submission was redirected unexpectedly. Please stay on this page and try again.');
        setSubmitting(false);
        return;
      }

      if (!response.ok) {
        const message = String(payload?.error || 'Unable to submit your application right now. Please try again later.');
        setError(message);
        setSubmitting(false);
        return;
      }

      try {
        sessionStorage.setItem(APPLY_SUBMIT_FLAG, '1');
        localStorage.setItem(APPLY_LAST_SUBMIT_KEY, String(nowMs()));
      } catch {
        // Ignore storage errors.
      }

      setSubmittedUsername(username);
      setCurrentStatus(String(payload?.status || 'Pending'));
      setStatusLookupUsername(username);

      setShowSuccess(true);
      form.reset();
    } catch {
      setError('Network error while submitting. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="container section stack reveal in-view">
      <h1>Whitelist Application</h1>

      <article className="card">
        <p>Requirements: Age 10+, Respectful Communication, and No Cheat Client.</p>
      </article>

      {isFileProtocol ? (
        <article className="card apply-server-warning" id="apply-server-warning">
          <p><strong>Form unavailable in file mode.</strong> Open this page via a web server URL like http://localhost:5173/apply/ instead of file://.</p>
        </article>
      ) : null}

      <form
        className="card stack"
        id="apply-form"
        onSubmit={onSubmit}
      >
        <input type="hidden" name="apply_started_at" id="apply-started-at" value={String(startedAt)} />
        <input
          type="text"
          name="website"
          id="apply-honey"
          tabIndex={-1}
          autoComplete="off"
          className="apply-honey-field"
          aria-label="Leave this field empty"
        />

        <label>
          Minecraft Username
          <Input className="field" type="text" name="mc_username" placeholder=".BedrockName or JavaName" required />
        </label>
        <label>
          Grade
          <Input className="field" type="text" name="grade" required />
        </label>
        <label>
          School
          <Input className="field" type="text" name="school" required />
        </label>
        <label>
          Discord Username
          <Input className="field" type="text" name="discord_username" placeholder="username or username#1234" required />
        </label>
        <label>
          Invited By
          <Input className="field" type="text" name="invited_by" placeholder="Friend username / who invited you" required />
        </label>
        <label>
          Reason Why You Want To Join
          <Textarea className="field" rows={4} name="motivation" required />
        </label>

        <label className="apply-agreement-row">
          <input type="checkbox" name="agreement_confirmed" required />
          <span>I understand that SurvivalKendy is a community based server and cheating, hacking and illegal activities will result in a permanent Hardware ban.</span>
        </label>

        {error ? <p id="apply-form-error" className="apply-form-error" role="alert">{error}</p> : null}
        <Button className="btn btn-primary" type="submit" style={{ border: 'none', cursor: 'pointer' }} disabled={submitting}>
          {submitting ? 'Submitting...' : 'Apply'}
        </Button>
      </form>

      {(submittedUsername || currentStatus) ? (
        <article className="card stack">
          <h3>Application Received</h3>
          <p>Your whitelist application will be reviewed by our team.</p>
          <p><strong>Username:</strong> {submittedUsername || '--'}</p>
          <p><strong>Current Status:</strong> {currentStatus || 'Pending'}</p>
        </article>
      ) : null}

      <article className="card stack">
        <h3>Check Application Status</h3>
        <label>
          Minecraft Username
          <Input
            className="field"
            type="text"
            value={statusLookupUsername}
            onChange={(event) => setStatusLookupUsername(event.target.value)}
            placeholder="Enter your Minecraft Username"
          />
        </label>
        {statusError ? <p className="apply-form-error" role="alert">{statusError}</p> : null}
        <Button
          className="btn btn-secondary"
          type="button"
          style={{ border: 'none', cursor: 'pointer' }}
          disabled={statusLookupBusy}
          onClick={() => {
            void pullApplicationStatus(statusLookupUsername);
          }}
        >
          {statusLookupBusy ? 'Checking...' : 'Check Status'}
        </Button>
      </article>

      <div id="apply-success-popup" className={`apply-popup-backdrop ${showSuccess ? 'is-open' : ''}`} hidden={!showSuccess} onClick={(event) => {
          if (event.target === event.currentTarget) setShowSuccess(false);
        }}>
          <article className="apply-popup" role="dialog" aria-modal="true" aria-labelledby="apply-success-title" aria-describedby="apply-success-message">
            <h2 id="apply-success-title">Thank you for Applying!</h2>
            <p id="apply-success-message">Your application has been submitted and will be reviewed by our verification team. You can check your latest status on this page.</p>
            <Button id="apply-success-close" className="btn btn-primary" type="button" style={{ border: 'none', cursor: 'pointer' }} onClick={() => setShowSuccess(false)}>
              Close
            </Button>
          </article>
      </div>
    </main>
  );
}
