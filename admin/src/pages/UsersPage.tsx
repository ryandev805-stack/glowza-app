import { useCallback } from 'react';
import { listUsers } from '../services/firestoreService';
import type { User } from '../types';
import { useCollection } from '../hooks/useCollection';

export function UsersPage() {
  const loader = useCallback(() => listUsers(), []);
  const { items, loading, error, refresh } = useCollection<User>(loader);

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <span className="eyebrow">Customers</span>
          <h2>Users</h2>
          <p>{items.length} registered phone profiles</p>
        </div>
        <button onClick={refresh}>Refresh</button>
      </div>
      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}
      <div className="user-grid">
        {items.map((user) => (
          <article className="user-card" key={user.id}>
            <div className="avatar">{user.name?.slice(0, 1) || 'U'}</div>
            <div>
              <strong>{user.name || 'Unnamed user'}</strong>
              <span>{user.phone}</span>
              <small>{user.role}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
