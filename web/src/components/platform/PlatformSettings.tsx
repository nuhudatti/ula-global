import { FormEvent, useCallback, useEffect, useState } from 'react';
import { platformApi } from '../../lib/platformApi';

type EmailSettings = {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassSet: boolean;
  smtpFrom: string;
  smtpFromName: string;
  smtpReplyTo: string;
  appPublicUrl: string;
  retryMax: number;
  retryDelayMs: number;
  devOutbox: boolean;
  mirrorOutbox: boolean;
  templates: Record<string, { subject: string; preheader: string }>;
  effective: {
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
    smtpUser: string;
    smtpFrom: string;
    smtpFromName: string;
    smtpReplyTo: string;
    appPublicUrl: string;
    source: string;
  };
  updatedAt: string | null;
};

type EmailStatus = {
  configured: boolean;
  mode: string;
  provider?: string;
  connection?: { ok: boolean; mode?: string; error?: string };
};

export function PlatformSettings() {
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [status, setStatus] = useState<EmailStatus | null>(null);
  const [smtpPass, setSmtpPass] = useState('');
  const [testTo, setTestTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [s, st] = await Promise.all([
      platformApi<EmailSettings>('/api/platform/email/settings'),
      platformApi<EmailStatus>('/api/platform/email/status'),
    ]);
    setSettings(s);
    setStatus(st);
  }, []);

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : 'Failed to load settings'));
  }, [load]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const body: Record<string, unknown> = {
        smtpHost: settings.smtpHost,
        smtpPort: settings.smtpPort,
        smtpSecure: settings.smtpSecure,
        smtpUser: settings.smtpUser,
        smtpFrom: settings.smtpFrom,
        smtpFromName: settings.smtpFromName,
        smtpReplyTo: settings.smtpReplyTo,
        appPublicUrl: settings.appPublicUrl,
        retryMax: settings.retryMax,
        retryDelayMs: settings.retryDelayMs,
        devOutbox: settings.devOutbox,
        mirrorOutbox: settings.mirrorOutbox,
        templates: settings.templates,
      };
      if (smtpPass) body.smtpPass = smtpPass;
      const updated = await platformApi<EmailSettings>('/api/platform/email/settings', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setSettings(updated);
      setSmtpPass('');
      setMessage('Email settings saved. Central delivery applies to all institutions.');
      const st = await platformApi<EmailStatus>('/api/platform/email/status');
      setStatus(st);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function onVerify() {
    setVerifyBusy(true);
    setError('');
    try {
      await platformApi('/api/platform/email/verify', { method: 'POST' });
      setMessage('SMTP connection verified successfully.');
      const st = await platformApi<EmailStatus>('/api/platform/email/status');
      setStatus(st);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setVerifyBusy(false);
    }
  }

  async function onTestSend() {
    if (!testTo.trim()) {
      setError('Enter a recipient email for the test.');
      return;
    }
    setTestBusy(true);
    setError('');
    try {
      const result = await platformApi<{ ok: boolean; mode: string; outboxFile?: string }>('/api/platform/email/test', {
        method: 'POST',
        body: JSON.stringify({ to: testTo.trim() }),
      });
      setMessage(
        result.ok
          ? `Test email sent (${result.mode})${result.outboxFile ? ` — saved to ${result.outboxFile}` : ''}.`
          : 'Test email queued to dev outbox.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test send failed');
    } finally {
      setTestBusy(false);
    }
  }

  function patch<K extends keyof EmailSettings>(key: K, value: EmailSettings[K]) {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  if (!settings) {
    return (
      <div className="max-w-3xl text-sm text-slate-500">
        {error || 'Loading platform settings…'}
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Configuration</p>
        <h2 className="mt-1 text-2xl font-semibold text-slate-900">Platform settings</h2>
        <p className="mt-2 text-sm text-slate-500">
          Central ULA email infrastructure — shared across invitations, activation, password reset, and notifications.
          Institution branding is applied per message; delivery is not tied to individual user accounts.
        </p>
      </header>

      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{message}</div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
      ) : null}

      <section className="ula-platform-kpi space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Email delivery status</h3>
        <dl className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Mode</dt>
            <dd className="mt-0.5 font-medium text-slate-800">{status?.mode || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Provider</dt>
            <dd className="mt-0.5 font-medium text-slate-800">{status?.provider || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Configured</dt>
            <dd className="mt-0.5 font-medium text-slate-800">{status?.configured ? 'Yes' : 'No (dev outbox)'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Connection</dt>
            <dd className="mt-0.5 font-medium text-slate-800">
              {status?.connection?.ok ? 'Verified' : status?.connection?.error || 'Not verified'}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Effective source</dt>
            <dd className="mt-0.5 font-medium text-slate-800">
              {settings.effective.source === 'database' ? 'Platform settings (database)' : 'Environment variables (.env)'}
            </dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            onClick={() => void onVerify()}
            disabled={verifyBusy}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {verifyBusy ? 'Verifying…' : 'Verify SMTP'}
          </button>
        </div>
      </section>

      <form onSubmit={(e) => void onSave(e)} className="ula-platform-kpi space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">SMTP credentials</h3>
          <p className="mt-1 text-xs text-slate-500">Stored at platform level. Empty fields fall back to server environment variables.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">SMTP host</span>
            <input
              value={settings.smtpHost}
              onChange={(e) => patch('smtpHost', e.target.value)}
              placeholder={settings.effective.smtpHost || 'smtp.sendgrid.net'}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Port</span>
            <input
              type="number"
              value={settings.smtpPort}
              onChange={(e) => patch('smtpPort', Number(e.target.value) || 587)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="flex items-center gap-2 text-sm pt-6">
            <input
              type="checkbox"
              checked={settings.smtpSecure}
              onChange={(e) => patch('smtpSecure', e.target.checked)}
            />
            Use TLS/SSL (secure)
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">SMTP user</span>
            <input
              value={settings.smtpUser}
              onChange={(e) => patch('smtpUser', e.target.value)}
              placeholder="apikey"
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">
              SMTP password / API key {settings.smtpPassSet ? '(set — leave blank to keep)' : ''}
            </span>
            <input
              type="password"
              value={smtpPass}
              onChange={(e) => setSmtpPass(e.target.value)}
              placeholder={settings.smtpPassSet ? '••••••••' : 'SendGrid API key or SMTP password'}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
              autoComplete="new-password"
            />
          </label>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-900">Sender information</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-slate-700">From address</span>
              <input
                value={settings.smtpFrom}
                onChange={(e) => patch('smtpFrom', e.target.value)}
                placeholder={settings.effective.smtpFrom || 'noreply@yourdomain.com'}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">From name</span>
              <input
                value={settings.smtpFromName}
                onChange={(e) => patch('smtpFromName', e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Reply-to</span>
              <input
                value={settings.smtpReplyTo}
                onChange={(e) => patch('smtpReplyTo', e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-slate-700">Public app URL (links in emails)</span>
              <input
                value={settings.appPublicUrl}
                onChange={(e) => patch('appPublicUrl', e.target.value)}
                placeholder={settings.effective.appPublicUrl}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-900">Delivery settings</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Retry attempts</span>
              <input
                type="number"
                min={1}
                max={5}
                value={settings.retryMax}
                onChange={(e) => patch('retryMax', Number(e.target.value) || 3)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Retry delay (ms)</span>
              <input
                type="number"
                min={500}
                value={settings.retryDelayMs}
                onChange={(e) => patch('retryDelayMs', Number(e.target.value) || 1000)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.devOutbox}
                onChange={(e) => patch('devOutbox', e.target.checked)}
              />
              Dev outbox when SMTP unavailable
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.mirrorOutbox}
                onChange={(e) => patch('mirrorOutbox', e.target.checked)}
              />
              Mirror sent mail to dev outbox
            </label>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-900">Email templates</h3>
          <p className="mt-1 text-xs text-slate-500">
            Subject line overrides per flow. Institution logos and colors are applied automatically from tenant branding.
          </p>
          <div className="mt-3 space-y-3">
            {Object.entries(settings.templates).map(([key, tpl]) => (
              <div key={key} className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{key.replace(/_/g, ' ')}</p>
                <input
                  value={tpl.subject}
                  onChange={(e) =>
                    patch('templates', {
                      ...settings.templates,
                      [key]: { ...tpl, subject: e.target.value },
                    })
                  }
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Email subject"
                />
              </div>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save email configuration'}
        </button>
      </form>

      <section className="ula-platform-kpi space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Test email</h3>
        <p className="text-xs text-slate-500">Send a test message through the central ULA email service.</p>
        <div className="flex flex-wrap gap-2">
          <input
            type="email"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="recipient@example.com"
            className="min-w-[220px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void onTestSend()}
            disabled={testBusy}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {testBusy ? 'Sending…' : 'Send test'}
          </button>
        </div>
      </section>

      <section className="ula-platform-kpi space-y-2 text-sm text-slate-600">
        <h3 className="text-sm font-semibold text-slate-900">Other platform settings</h3>
        <p>
          <span className="font-semibold text-slate-900">Default institution slug</span> —{' '}
          <code className="text-xs">DEFAULT_INSTITUTION_SLUG</code> for legacy routes.
        </p>
        <p>
          <span className="font-semibold text-slate-900">Security</span> — Platform operators use JWT scope{' '}
          <code className="text-xs">platform</code>; institution users cannot access platform routes.
        </p>
      </section>
    </div>
  );
}
