import { useCallback, useMemo, useState } from 'react';
import { CheckCircle2, EyeOff, RefreshCcw, Search, Star, Trash2 } from 'lucide-react';
import { deleteReview, listOrders, listProducts, listReviews, listUsers, updateReviewStatus } from '../services/firestoreService';
import type { Order, Product, Review, User } from '../types';
import { useCollection } from '../hooks/useCollection';

const reviewStatuses = ['pending', 'approved', 'hidden', 'all'] as const;

export function ReviewsPage() {
  const reviews = useCollection<Review>(useCallback(() => listReviews(), []));
  const products = useCollection<Product>(useCallback(() => listProducts(), []));
  const orders = useCollection<Order>(useCallback(() => listOrders(), []));
  const users = useCollection<User>(useCallback(() => listUsers(), []));
  const [status, setStatus] = useState<(typeof reviewStatuses)[number]>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');

  const productById = useMemo(() => new Map(products.items.map((product) => [product.id, product])), [products.items]);
  const orderById = useMemo(() => new Map(orders.items.map((order) => [order.id, order])), [orders.items]);
  const userById = useMemo(() => new Map(users.items.map((user) => [user.id, user])), [users.items]);

  const filtered = reviews.items.filter((review) => {
    const product = productById.get(review.productId);
    const order = orderById.get(review.orderId);
    const user = userById.get(review.userId);
    const text = `${review.customerName} ${review.comment} ${product?.name || ''} ${order?.orderNumber || ''} ${user?.phone || ''}`.toLowerCase();
    const statusMatches = status === 'all' || review.status === status;
    return statusMatches && text.includes(query.toLowerCase());
  });
  const selected = reviews.items.find((review) => review.id === selectedId) || filtered[0] || null;
  const selectedProduct = selected ? productById.get(selected.productId) : null;
  const selectedOrder = selected ? orderById.get(selected.orderId) : null;
  const selectedUser = selected ? userById.get(selected.userId) : null;

  const counts = {
    pending: reviews.items.filter((review) => review.status === 'pending').length,
    approved: reviews.items.filter((review) => review.status === 'approved').length,
    hidden: reviews.items.filter((review) => review.status === 'hidden').length,
  };

  async function refreshAll() {
    await Promise.all([reviews.refresh(), products.refresh(), orders.refresh(), users.refresh()]);
  }

  async function changeStatus(review: Review, nextStatus: Review['status']) {
    await updateReviewStatus(review, nextStatus);
    await refreshAll();
  }

  async function remove(review: Review) {
    if (!confirm('Delete this review permanently?')) return;
    await deleteReview(review);
    setSelectedId('');
    await refreshAll();
  }

  return (
    <section className="reviews-page admin-layout">
      <div className="page-hero compact-hero">
        <div>
          <span className="eyebrow">Reviews</span>
          <h1>Review Moderation</h1>
          <p>Moderate delivered-order reviews, inspect context, and sync approved reviews to product ratings.</p>
        </div>
        <button onClick={() => void refreshAll()}><RefreshCcw size={17} /> Refresh</button>
      </div>

      <div className="metric-grid">
        <Metric title="Pending" value={counts.pending} detail="waiting approval" />
        <Metric title="Approved" value={counts.approved} detail="public reviews" />
        <Metric title="Hidden" value={counts.hidden} detail="not visible" />
        <Metric title="Total" value={reviews.items.length} detail="all reviews" />
      </div>

      <div className="management-grid">
      <section className="panel">
        <div className="toolbar">
          <div>
            <h2>All Reviews</h2>
            <p>{filtered.length} of {reviews.items.length} reviews</p>
          </div>
          <div className="toolbar-controls">
            <label className="search-field">
              <Search size={17} />
              <input placeholder="Search review, product, order, phone" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <select value={status} onChange={(event) => setStatus(event.target.value as (typeof reviewStatuses)[number])}>
              <option value="all">All reviews</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="hidden">Hidden</option>
            </select>
          </div>
        </div>

        {reviews.loading && <p>Loading reviews...</p>}
        {reviews.error && <p className="error">{reviews.error}</p>}

        <div className="review-stack">
          {filtered.map((review) => {
            const product = productById.get(review.productId);
            return (
              <button
                className={`review-summary clickable ${selected?.id === review.id ? 'selected' : ''}`}
                key={review.id}
                onClick={() => setSelectedId(review.id)}
              >
                {product?.image ? <img src={product.image} alt="" /> : <div className="empty-thumb"><Star size={20} /></div>}
                <div>
                  <strong>{product?.name || 'Unknown product'}</strong>
                  <span>{review.customerName || 'Glowza customer'} - {review.rating}/5</span>
                  <p>{review.comment}</p>
                  <div className="mini-pills">
                    <span>{review.status}</span>
                    <span>Order {review.orderId?.slice(0, 8)}</span>
                  </div>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && <p className="muted">No reviews match this filter.</p>}
        </div>
      </section>

      <aside className="panel detail-panel">
        {selected ? (
          <>
            <div className="panel-head">
              <div>
                <span className="eyebrow">Review Detail</span>
                <h2>{selected.customerName || selectedUser?.name || 'Glowza customer'}</h2>
                <p>{selected.status} - {selected.rating}/5 rating</p>
              </div>
              <span className={`pill status-pill-${selected.status}`}>{selected.status}</span>
            </div>

            <div className="review-rating">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} size={28} fill={selected.rating >= star ? 'currentColor' : 'none'} />
              ))}
            </div>

            <blockquote className="review-quote">{selected.comment}</blockquote>

            <div className="detail-grid">
              <div><span>Product</span><strong>{selectedProduct?.name || 'Missing product'}</strong></div>
              <div><span>Customer Phone</span><strong>{selectedUser?.phone || selectedOrder?.customerPhone || 'Unknown'}</strong></div>
              <div><span>Order</span><strong>{selectedOrder?.orderNumber || selected.orderId}</strong></div>
              <div><span>Order Status</span><strong>{selectedOrder?.status || 'Unknown'}</strong></div>
            </div>

            {selectedProduct && (
              <article className="data-card">
                {selectedProduct.image ? <img src={selectedProduct.image} alt="" /> : <div className="empty-thumb">P</div>}
                <div className="data-main">
                  <strong>{selectedProduct.name}</strong>
                  <span>{selectedProduct.brand || 'Glowza'} - PKR {Number(selectedProduct.price || 0).toLocaleString('en-PK')}</span>
                  <div className="mini-pills">
                    <span>{selectedProduct.reviewCount || 0} public reviews</span>
                    <span>{Number(selectedProduct.rating || 0).toFixed(1)} rating</span>
                  </div>
                </div>
              </article>
            )}

            <div className="row-actions stacked-actions">
              <button disabled={selected.status === 'approved'} onClick={() => void changeStatus(selected, 'approved')}><CheckCircle2 size={17} /> Approve</button>
              <button className="ghost" disabled={selected.status === 'hidden'} onClick={() => void changeStatus(selected, 'hidden')}><EyeOff size={17} /> Hide</button>
              <button className="danger" onClick={() => void remove(selected)}><Trash2 size={17} /> Delete Review</button>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <Star size={34} />
            <h2>No review selected</h2>
            <p>Select a review from the queue to moderate it.</p>
          </div>
        )}
      </aside>
      </div>
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
