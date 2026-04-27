import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { apiUrl } from '../lib/api-base';

const APPLY_SUBMIT_FLAG = 'sk_apply_submitted';
const APPLY_LAST_SUBMIT_KEY = 'sk_apply_last_submit_ms';
const APPLY_RATE_LIMIT_MS = 90 * 1000;
const APPLY_MIN_FILL_MS = 4000;

const CONSENT_ITEMS = [
  'I hereby consent to the collection of anonymized gameplay telemetry for the Link-26 Research Project (RMPV 1.2.1).',
  'I agree to participate in brief periodic surveys regarding collaborative dynamics and social interactions within the SurvivalKendy ecosystem.',
  'I acknowledge that I am a voluntary participant and reserve the right to withdraw from the research study at any time without penalty.',
  'I agree to abide by the System Integrity Protocol, which strictly prohibits the use of third-party exploits, hacks, or unauthorized scripts.',
] as const;

function nowMs(): number {
  return Date.now();
}

function normalizePath(path: string): string {
  if (!path) return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

function toApiPrefixedPath(path: string): string {
  const normalized = normalizePath(path);
  if (normalized === '/api') return '/api';
  if (normalized.startsWith('/api/')) return normalized;
  return `/api${normalized}`;
}

function buildFailoverEndpoints(path: string): string[] {
  const normalized = normalizePath(path);
  const apiPath = toApiPrefixedPath(normalized);

  const candidates = [
    // Prefer same-origin website server path first for lower-latency local routing.
    apiPath,
    apiUrl(apiPath),
    apiUrl(normalized),
  ];

  return Array.from(new Set(candidates.filter(Boolean)));
}

async function readJsonSafe(response: Response): Promise<Record<string, unknown>> {
  return response.json().catch(() => ({} as Record<string, unknown>));
}

export default function ApplyPage() {
  const [startedAt] = useState<number>(nowMs());
  const [error, setError] = useState<string>('');
  const [statusError, setStatusError] = useState<string>('');
  const [statusLookupUsername, setStatusLookupUsername] = useState<string>('');
  const [statusLookupBusy, setStatusLookupBusy] = useState<boolean>(false);
  const [submittedUsername, setSubmittedUsername] = useState<string>('');
  const [currentStatus, setCurrentStatus] = useState<string>('');
  const [consents, setConsents] = useState<boolean[]>(() => CONSENT_ITEMS.map(() => false));
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

  const allConsentsChecked = consents.every(Boolean);

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
      const endpoints = buildFailoverEndpoints(`/status/${encodeURIComponent(safeUsername)}`);
      let finalPayload: Record<string, unknown> = {};
      let success = false;

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            method: 'GET',
            headers: { Accept: 'application/json' },
          });

          const payload = await readJsonSafe(response);
          finalPayload = payload;

          if (!response.ok) {
            // Keep trying fallback endpoints for route misses and transient server failures.
            if (
              response.status === 404
              || response.status === 405
              || response.status >= 500
              || response.status === 502
              || response.status === 503
              || response.status === 504
            ) {
              continue;
            }

            setStatusError(String(payload?.error || 'Unable to fetch status right now.'));
            return;
          }

          setSubmittedUsername(String(payload?.username || safeUsername));
          setCurrentStatus(String(payload?.status || 'Pending'));
          success = true;
          break;
        } catch {
          // Try next fallback endpoint.
        }
      }

      if (!success) {
        setStatusError(String(finalPayload?.error || 'Network error while checking status. Please try again.'));
      }
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
    const agreementConfirmed = allConsentsChecked;

    if (!username || !discordTag || !grade || !school || !invitedBy || !reason) {
      setError('Please fill out all required fields before submitting.');
      return;
    }

    if (!agreementConfirmed) {
      setError('You must accept all consent checkboxes before submitting.');
      return;
    }

    setSubmitting(true);

    try {
      const payloadBody = JSON.stringify({
        username,
        discord_tag: discordTag,
        grade,
        school,
        invited_by: invitedBy,
        reason,
        agreement_confirmed: agreementConfirmed,
      });

      const endpoints = buildFailoverEndpoints('/apply');
      let payload: Record<string, unknown> = {};
      let submitted = false;

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: payloadBody,
          });

          payload = await readJsonSafe(response);

          if (response.redirected) {
            // Skip redirected endpoint and try fallback route.
            continue;
          }

          if (!response.ok) {
            // Retry on route misses/transient gateway errors; stop on validation/auth errors.
            if (
              response.status === 404
              || response.status === 405
              || response.status >= 500
              || response.status === 502
              || response.status === 503
              || response.status === 504
            ) {
              continue;
            }

            const message = String(payload?.error || 'Unable to submit your application right now. Please try again later.');
            setError(message);
            return;
          }

          submitted = true;
          break;
        } catch {
          // Try next fallback endpoint.
        }
      }

      if (!submitted) {
        const message = String(payload?.error || 'Unable to submit your application right now. Please try again later.');
        setError(message);
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
      setConsents(CONSENT_ITEMS.map(() => false));

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
        className="card stack apply-form"
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

        <label className="apply-field">
          Minecraft Username
          <Input className="field" type="text" name="mc_username" placeholder=".BedrockName or JavaName" required />
        </label>
        <label className="apply-field">
          Grade
          <Input className="field" type="text" name="grade" required />
        </label>
        <label className="apply-field">
          School
          <Input className="field" type="text" name="school" required />
        </label>
        <label className="apply-field">
          Discord Username
          <Input className="field" type="text" name="discord_username" placeholder="username or username#1234" required />
        </label>
        <label className="apply-field">
          Invited By
          <Input className="field" type="text" name="invited_by" placeholder="Friend username / who invited you" required />
        </label>
        <label className="apply-field apply-field-wide">
          Reason Why You Want To Join
          <Textarea className="field" rows={4} name="motivation" required />
        </label>

        <article className="card apply-doc-links">
          <p style={{ marginBottom: '0.5rem' }}>
            Please read these documents before confirming consent:
          </p>
          <p>
            <Link className="link-arrow" to="/research-consent" target="_blank" rel="noreferrer">
              Research Consent -&gt;
            </Link>
          </p>
          <p>
            <Link className="link-arrow" to="/terms-fair-play" target="_blank" rel="noreferrer">
              Terms of Service &amp; Fair Play -&gt;
            </Link>
          </p>
        </article>

        <section className="stack apply-consent-list" style={{ gap: '0.65rem' }} aria-label="Research consent checkboxes">
          {CONSENT_ITEMS.map((text, index) => (
            <label key={text} className="apply-agreement-row">
              <input
                type="checkbox"
                checked={consents[index]}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setConsents((prev) => prev.map((value, i) => (i === index ? checked : value)));
                }}
                required
              />
              <span>{text}</span>
            </label>
          ))}
        </section>

        {error ? <p id="apply-form-error" className="apply-form-error" role="alert">{error}</p> : null}
        <Button className="btn btn-primary apply-submit" type="submit" style={{ border: 'none', cursor: 'pointer' }} disabled={submitting || !allConsentsChecked}>
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
