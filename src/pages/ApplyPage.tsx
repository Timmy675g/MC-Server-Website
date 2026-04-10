import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';

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

  const nextUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}${window.location.pathname}?applied=1`;
  }, []);

  const isFileProtocol = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.location.protocol === 'file:';
  }, []);

  const formAction = 'https://formsubmit.co/timothytimmy351@gmail.com';

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
      setError('Please open this page through a web server (http://localhost:...) because FormSubmit does not work on file:// pages.');
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

    try {
      sessionStorage.setItem(APPLY_SUBMIT_FLAG, '1');
      localStorage.setItem(APPLY_LAST_SUBMIT_KEY, String(nowMs()));
    } catch {
      // Ignore storage errors.
    }

    setSubmitting(true);

    try {
      const response = await fetch(formAction, {
        method: 'POST',
        body: formData,
        headers: {
          Accept: 'application/json',
        },
        mode: 'cors',
      });

      console.log('[apply] FormSubmit response:', response);

      if (response.status !== 200) {
        try {
          const errorBody = await response.json();
          console.error('[apply] FormSubmit error body:', errorBody);
        } catch {
          console.error('[apply] FormSubmit returned a non-JSON error response.');
        }

        setError('Submission failed. Please try again in a moment.');
        setSubmitting(false);
        return;
      }

      window.location.assign(nextUrl);
    } catch {
      setError('Network error while submitting your application. Please try again.');
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
        method="POST"
        action={formAction}
        onSubmit={onSubmit}
      >
        <input type="hidden" name="_subject" value="SurvivalKendy - New Whitelist Application" />
        <input type="hidden" name="_template" value="table" />
        <input type="hidden" name="_captcha" value="false" />
        <input type="hidden" name="_url" value="https://survivalkendy.systems" />
        <input type="hidden" name="_next" id="apply-next-url" value={nextUrl} />
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
          Minecraft Username (add "." in front if Bedrock, normal username if Java)
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
          Discord Username (for contact if approved)
          <Input className="field" type="text" name="discord_username" placeholder="username or username#1234" required />
        </label>
        <label>
          Invited By
          <Input className="field" type="text" name="invited_by" placeholder="Friend username / who invited you" required />
        </label>
        <label>
          Reasons why you want to join
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

      <div id="apply-success-popup" className={`apply-popup-backdrop ${showSuccess ? 'is-open' : ''}`} hidden={!showSuccess} onClick={(event) => {
          if (event.target === event.currentTarget) setShowSuccess(false);
        }}>
          <article className="apply-popup" role="dialog" aria-modal="true" aria-labelledby="apply-success-title" aria-describedby="apply-success-message">
            <h2 id="apply-success-title">Thank you for Applying!</h2>
            <p id="apply-success-message">A Team of Verificator will Verify and Check the Form you gave us, please wait up to 1 - 2 Hours, if you haven't been contacted by our team in 24 Hours, feel free to contact the owner via the owner Social Media link in the Footer below! Or ask a friend that you know about this server!</p>
            <Button id="apply-success-close" className="btn btn-primary" type="button" style={{ border: 'none', cursor: 'pointer' }} onClick={() => setShowSuccess(false)}>
              Close
            </Button>
          </article>
      </div>
    </main>
  );
}
