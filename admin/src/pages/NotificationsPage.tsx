import { useCallback, useMemo, useState } from 'react';
import { ImageField } from '../components/ImageField';
import { listDeviceTokens, listNotificationCampaigns, listUsers, sendNotificationCampaign } from '../services/firestoreService';
import type { DeviceToken, NotificationCampaign, User } from '../types';
import { useCollection } from '../hooks/useCollection';

const emptyCampaign = {
  title: '',
  body: '',
  image: '',
  targetType: 'all' as NotificationCampaign['targetType'],
  targetValue: '',
};

export function NotificationsPage() {
  const tokens = useCollection<DeviceToken>(useCallback(() => listDeviceTokens(), []));
  const campaigns = useCollection<NotificationCampaign>(useCallback(() => listNotificationCampaigns(), []));
  const users = useCollection<User>(useCallback(() => listUsers(), []));
  const [form, setForm] = useState(emptyCampaign);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');

  const platforms = useMemo(
    () => Array.from(new Set(tokens.items.map((token) => token.platform).filter(Boolean))).sort(),
    [tokens.items],
  );
  const activeTokens = tokens.items.filter((token) => token.isActive);

  async function send() {
    setSending(true);
    setMessage('');
    try {
      const result = await sendNotificationCampaign(form);
      setMessage(`Sent to ${result.sentCount} device${result.sentCount === 1 ? '' : 's'}.`);
      setForm(emptyCampaign);
      await campaigns.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not send notification');
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="notifications-page">
      <div className="page-hero compact-hero">
        <div>
          <span className="eyebrow">Notifications</span>
          <h1>Push Campaigns</h1>
          <p>Send promotional, informational, and order alert style messages through Firebase Cloud Messaging.</p>
        </div>
        <button onClick={() => { void tokens.refresh(); void campaigns.refresh(); }}>Refresh</button>
      </div>

      <div className="metric-grid">
        <Metric title="Active Devices" value={activeTokens.length} detail="registered app installs" />
        <Metric title="Platforms" value={platforms.length} detail={platforms.join(', ') || 'none yet'} />
        <Metric title="Campaigns" value={campaigns.items.length} detail="campaign history" />
        <Metric title="Users" value={users.items.length} detail="registered customers" />
      </div>

      <section className="split-page">
        <div className="panel form">
          <div className="panel-head">
            <div>
              <h2>Create Campaign</h2>
              <p>Server-side Firebase Admin sends the notification. The frontend never stores server keys.</p>
            </div>
            <button disabled={sending || !form.title.trim() || !form.body.trim()} onClick={send}>
              {sending ? 'Sending...' : 'Send Now'}
            </button>
          </div>

          <label>Title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
          <label>Message<textarea value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} /></label>
          <ImageField label="Optional Image" value={form.image} onChange={(image) => setForm({ ...form, image })} />
          <div className="form-grid compact">
            <label>
              Target
              <select
                value={form.targetType}
                onChange={(event) => setForm({ ...form, targetType: event.target.value as NotificationCampaign['targetType'], targetValue: '' })}
              >
                <option value="all">All devices</option>
                <option value="platform">Platform</option>
                <option value="user">Specific user</option>
              </select>
            </label>
            {form.targetType === 'platform' && (
              <label>
                Platform
                <select value={form.targetValue} onChange={(event) => setForm({ ...form, targetValue: event.target.value })}>
                  <option value="">Select platform</option>
                  {platforms.map((platform) => <option key={platform} value={platform}>{platform}</option>)}
                </select>
              </label>
            )}
            {form.targetType === 'user' && (
              <label>
                User
                <select value={form.targetValue} onChange={(event) => setForm({ ...form, targetValue: event.target.value })}>
                  <option value="">Select user</option>
                  {users.items.map((user) => <option key={user.id} value={user.id}>{user.name || user.phone} - {user.phone}</option>)}
                </select>
              </label>
            )}
          </div>
          {message && <p className={message.startsWith('Sent') ? 'success' : 'error'}>{message}</p>}
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <h2>Campaign History</h2>
              <p>{campaigns.items.length} campaigns</p>
            </div>
          </div>
          {campaigns.loading && <p>Loading campaigns...</p>}
          {campaigns.error && <p className="error">{campaigns.error}</p>}
          <div className="data-list">
            {campaigns.items.map((campaign) => (
              <article className="data-card" key={campaign.id}>
                {campaign.image ? <img src={campaign.image} alt="" /> : <div className="empty-thumb">N</div>}
                <div className="data-main">
                  <strong>{campaign.title}</strong>
                  <span>{campaign.body}</span>
                  <div className="mini-pills">
                    <span>{campaign.status}</span>
                    <span>{campaign.sentCount || 0} sent</span>
                    <span>{campaign.targetType}</span>
                  </div>
                </div>
              </article>
            ))}
            {campaigns.items.length === 0 && <p className="muted">No notification campaigns yet.</p>}
          </div>
        </div>
      </section>
    </section>
  );
}

function Metric({ title, value, detail }: { title: string; value: number | string; detail: string }) {
  return (
    <article className="metric-card">
      <span>{title}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}
