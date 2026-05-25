import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { BadgeCheck, Ban, RefreshCcw, Save, Search, ShoppingBag, Sparkles, UserRound } from 'lucide-react';
import { listOrders, listUsers, seedDemoSocialProof, updateUserProfile } from '../services/firestoreService';
import type { Order, User } from '../types';
import { useCollection } from '../hooks/useCollection';

function money(value: number | undefined) {
  return `PKR ${Number(value || 0).toLocaleString('en-PK')}`;
}

function formatDate(value: User['createdAt']) {
  if (!value) return 'Not available';
  if ('toDate' in value) return value.toDate().toLocaleDateString();
  return new Date(value).toLocaleDateString();
}

export function UsersPage() {
  const users = useCollection<User>(useCallback(() => listUsers(), []));
  const orders = useCollection<Order>(useCallback(() => listOrders(), []));
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedId, setSelectedId] = useState('');
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const selected = users.items.find((user) => user.id === selectedId) || null;
  const selectedOrders = useMemo(
    () => selected ? orders.items.filter((order) => order.userId === selected.id) : [],
    [orders.items, selected],
  );
  const statsByUser = useMemo(() => {
    const map = new Map<string, { orders: number; spend: number; lastOrder?: string }>();
    orders.items.forEach((order) => {
      const current = map.get(order.userId) || { orders: 0, spend: 0 };
      current.orders += 1;
      current.spend += Number(order.total || 0);
      current.lastOrder = order.orderNumber;
      map.set(order.userId, current);
    });
    return map;
  }, [orders.items]);

  const filtered = users.items.filter((user) => {
    const text = `${user.name || ''} ${user.phone || ''} ${user.role || ''}`.toLowerCase();
    const roleMatches = roleFilter === 'all' || user.role === roleFilter || (roleFilter === 'blocked' && user.isBlocked);
    return roleMatches && text.includes(query.toLowerCase());
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pagedUsers = filtered.slice((page - 1) * pageSize, page * pageSize);
  const customers = users.items.filter((user) => user.role !== 'admin').length;
  const blocked = users.items.filter((user) => user.isBlocked).length;
  const repeatCustomers = users.items.filter((user) => (statsByUser.get(user.id)?.orders || 0) > 1).length;

  useEffect(() => {
    setPage(1);
  }, [query, roleFilter]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  async function saveUser(input: Partial<Pick<User, 'name' | 'role' | 'isBlocked'>>) {
    if (!selected) return;
    setSaving(true);
    try {
      await updateUserProfile(selected.id, input);
      await users.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function seedDemoData() {
    const confirmed = confirm('Create 1000 demo users and 3 approved demo reviews on every active product? Existing demo docs will be overwritten.');
    if (!confirmed) return;
    setSeeding(true);
    setMessage('');
    setError('');
    try {
      const result = await seedDemoSocialProof();
      setMessage(`Seeded ${result.usersCreated} users and ${result.reviewsCreated} reviews across ${result.productsUpdated} products.`);
      await Promise.all([users.refresh(), orders.refresh()]);
    } catch (seedError) {
      setError(seedError instanceof Error ? seedError.message : 'Could not seed demo data.');
    } finally {
      setSeeding(false);
    }
  }

  return (
    <section className="users-page admin-layout">
      <div className="page-hero compact-hero">
        <div>
          <span className="eyebrow">Customers</span>
          <h1>User Management</h1>
          <p>Inspect customer profiles, role state, order value, and delivery history from Firestore.</p>
        </div>
        <div className="actions">
          <button className="ghost" disabled={seeding} onClick={() => void seedDemoData()}><Sparkles size={17} /> {seeding ? 'Seeding...' : 'Seed Demo Reviews'}</button>
          <button onClick={() => { void users.refresh(); void orders.refresh(); }}><RefreshCcw size={17} /> Refresh</button>
        </div>
      </div>

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}

      <div className="metric-grid">
        <Metric title="Users" value={users.items.length} detail={`${customers} customers`} />
        <Metric title="Repeat" value={repeatCustomers} detail="more than one order" />
        <Metric title="Blocked" value={blocked} detail="restricted profiles" />
        <Metric title="Orders" value={orders.items.length} detail="all customer orders" />
      </div>

      <section className="panel">
        <div className="toolbar">
          <div>
            <h2>Customer Directory</h2>
            <p>{filtered.length} matching profiles</p>
          </div>
          <div className="toolbar-controls">
            <label className="search-field">
              <Search size={17} />
              <input placeholder="Search name, phone, role" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
              <option value="all">All users</option>
              <option value="customer">Customers</option>
              <option value="admin">Admins</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>
        </div>

        {users.loading && <p>Loading users...</p>}
        {users.error && <p className="error">{users.error}</p>}

        <div className="user-grid">
          {pagedUsers.map((user) => {
            const stats = statsByUser.get(user.id) || { orders: 0, spend: 0 };
            return (
              <button
                key={user.id}
                className={`user-card clickable ${selected?.id === user.id ? 'selected' : ''}`}
                onClick={() => setSelectedId(user.id)}
              >
                <div className="avatar">{user.name?.slice(0, 1).toUpperCase() || <UserRound size={22} />}</div>
                <div>
                  <strong>{user.name || 'Unnamed user'}</strong>
                  <span>{user.phone || 'No phone'}</span>
                  <div className="mini-pills">
                    <span>{user.isBlocked ? 'Blocked' : user.role || 'customer'}</span>
                    <span>{stats.orders} orders</span>
                    <span>{money(stats.spend)}</span>
                  </div>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && <p className="muted">No users match this filter.</p>}
        </div>
        <div className="pagination">
          <button className="ghost" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
          <span>Page {page} of {totalPages}</span>
          <button className="ghost" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</button>
        </div>
      </section>

      {selected && (
      <AdminModal onClose={() => setSelectedId('')}>
        {selected ? (
          <>
            <div className="panel-head">
              <div>
                <span className="eyebrow">Profile Detail</span>
                <h2>{selected.name || 'Unnamed user'}</h2>
                <p>{selected.phone}</p>
              </div>
              <span className={`pill ${selected.isBlocked ? 'danger-pill' : 'success-pill'}`}>
                {selected.isBlocked ? 'Blocked' : 'Active'}
              </span>
            </div>

            <div className="detail-grid">
              <div><span>Role</span><strong>{selected.role || 'customer'}</strong></div>
              <div><span>Joined</span><strong>{formatDate(selected.createdAt)}</strong></div>
              <div><span>Orders</span><strong>{selectedOrders.length}</strong></div>
              <div><span>Total Spend</span><strong>{money(selectedOrders.reduce((total, order) => total + Number(order.total || 0), 0))}</strong></div>
            </div>

            <section className="editor-section">
              <div className="section-title">
                <span><BadgeCheck size={16} /></span>
                <div>
                  <h3>Profile Controls</h3>
                  <p>These fields update the Firestore user document.</p>
                </div>
              </div>
              <label>Name<input defaultValue={selected.name || ''} onBlur={(event) => {
                if (event.target.value !== selected.name) void saveUser({ name: event.target.value });
              }} /></label>
              <label>
                Role
                <select value={selected.role || 'customer'} onChange={(event) => void saveUser({ role: event.target.value })}>
                  <option value="customer">customer</option>
                  <option value="admin">admin</option>
                  <option value="support">support</option>
                </select>
              </label>
              <button className={selected.isBlocked ? '' : 'danger'} disabled={saving} onClick={() => void saveUser({ isBlocked: !selected.isBlocked })}>
                {selected.isBlocked ? <Save size={17} /> : <Ban size={17} />}
                {selected.isBlocked ? 'Unblock User' : 'Block User'}
              </button>
            </section>

            <section className="detail-block">
              <h3>Recent Orders</h3>
              <div className="data-list">
                {selectedOrders.slice(0, 6).map((order) => (
                  <article className="simple-row" key={order.id}>
                    <div>
                      <strong>{order.orderNumber}</strong>
                      <span>{order.status} - {order.city}</span>
                    </div>
                    <strong>{money(order.total)}</strong>
                  </article>
                ))}
                {selectedOrders.length === 0 && <p className="muted">This user has not placed orders yet.</p>}
              </div>
            </section>
          </>
        ) : (
          <div className="empty-state">
            <ShoppingBag size={34} />
            <h2>No user selected</h2>
            <p>Select a customer from the directory to manage their profile.</p>
          </div>
        )}
      </AdminModal>
      )}
    </section>
  );
}

function AdminModal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
      <div className="admin-modal-panel">
        <button className="admin-modal-close ghost" onClick={onClose}>Close</button>
        {children}
      </div>
    </div>
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
