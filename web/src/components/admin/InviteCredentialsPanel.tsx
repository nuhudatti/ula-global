import { useState } from 'react';

export function InviteCredentialsPanel({
  fullName,
  email,
  activationUrl,
  oneTimePassword,
  emailSent,
  onDismiss,
}: {
  fullName: string;
  email: string;
  activationUrl: string;
  oneTimePassword: string;
  emailSent: boolean;
  onDismiss?: () => void;
}) {
  const [copied, setCopied] = useState<'otp' | 'link' | null>(null);

  async function copy(value: string, kind: 'otp' | 'link') {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="ula-invite-credentials">
      <div className="ula-invite-credentials__icon" aria-hidden>
        <i className="fa-solid fa-envelope-circle-check" />
      </div>
      <h4 className="ula-invite-credentials__title">Invitation ready for {fullName}</h4>
      <p className="ula-invite-credentials__text">
        {emailSent
          ? `An email was sent to ${email}. You can also copy the one-time password and activation link below if needed.`
          : `Email could not be delivered — share these credentials with ${email} manually.`}
      </p>

      <div className="ula-invite-credentials__otp">
        <p className="ula-invite-credentials__label">One-time password</p>
        <p className="ula-invite-credentials__code">{oneTimePassword}</p>
        <button
          type="button"
          className="ula-invite-credentials__copy"
          onClick={() => void copy(oneTimePassword, 'otp')}
        >
          <i className={`fa-solid ${copied === 'otp' ? 'fa-check' : 'fa-copy'}`} aria-hidden />
          {copied === 'otp' ? 'Copied' : 'Copy password'}
        </button>
      </div>

      <div className="ula-invite-credentials__link">
        <p className="ula-invite-credentials__label">Activation link</p>
        <p className="ula-invite-credentials__url">{activationUrl}</p>
        <button
          type="button"
          className="ula-invite-credentials__copy"
          onClick={() => void copy(activationUrl, 'link')}
        >
          <i className={`fa-solid ${copied === 'link' ? 'fa-check' : 'fa-link'}`} aria-hidden />
          {copied === 'link' ? 'Copied' : 'Copy link'}
        </button>
      </div>

      <p className="ula-invite-credentials__hint">
        The invitee opens the link, enters this one-time password, then chooses a permanent password.
      </p>

      {onDismiss ? (
        <button type="button" className="ula-invite-credentials__done" onClick={onDismiss}>
          Done
        </button>
      ) : null}
    </div>
  );
}
