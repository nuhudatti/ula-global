import { useState } from 'react';

export type InvitationLinkResult = {
  fullName: string;
  email: string;
  inviteUrl?: string;
  activationUrl?: string;
  devActivationUrl?: string;
  emailSent?: boolean;
  emailError?: string | null;
};

function resolveUrl(res: InvitationLinkResult) {
  return res.devActivationUrl || res.activationUrl || (res.inviteUrl ? `${window.location.origin}${res.inviteUrl}` : '');
}

export function InvitationLinkPanel({
  fullName,
  email,
  inviteUrl,
  activationUrl,
  devActivationUrl,
  emailSent,
  emailError,
  roleLabel = 'staff member',
  onDismiss,
}: InvitationLinkResult & {
  roleLabel?: string;
  onDismiss?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const url = resolveUrl({ fullName, email, inviteUrl, activationUrl, devActivationUrl });

  async function copyLink() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
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
          ? `An invitation email was sent to ${email}. They can also use the secure link below.`
          : `Email may not have arrived${emailError ? ` (${emailError})` : ''} — copy and share the invitation link with ${email}.`}
      </p>

      {url ? (
        <div className="ula-invite-credentials__link">
          <p className="ula-invite-credentials__label">Invitation link</p>
          <p className="ula-invite-credentials__url">{url}</p>
          <button type="button" className="ula-invite-credentials__copy" onClick={() => void copyLink()}>
            <i className={`fa-solid ${copied ? 'fa-check' : 'fa-link'}`} aria-hidden />
            {copied ? 'Copied' : 'Copy invitation link'}
          </button>
        </div>
      ) : null}

      <p className="ula-invite-credentials__hint">
        The {roleLabel} opens this link once, sets their password, and gains access to their workspace.
      </p>

      {onDismiss ? (
        <button type="button" className="ula-invite-credentials__done" onClick={onDismiss}>
          Done
        </button>
      ) : null}
    </div>
  );
}
