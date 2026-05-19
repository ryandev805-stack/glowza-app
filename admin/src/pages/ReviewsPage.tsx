import { useCallback, useMemo, useState } from 'react';
import { deleteReview, listProducts, listReviews, updateReviewStatus } from '../services/firestoreService';
import type { Product, Review } from '../types';
import { useCollection } from '../hooks/useCollection';

export function ReviewsPage() {
  const reviews = useCollection<Review>(useCallback(() => listReviews(), []));
  const products = useCollection<Product>(useCallback(() => listProducts(), []));
  const [status, setStatus] = useState('pending');
  const [query, setQuery] = useState('');

  const productById = useMemo(
    () => new Map(products.items.map((product) => [product.id, product])),
    [products.items],
  );
  const filtered = reviews.items.filter((review) => {
    const product = productById.get(review.productId);
    const text = `${review.customerName} ${review.comment} ${product?.name || ''}`.toLowerCase();
    const statusMatches = status === 'all' || review.status === status;
    return statusMatches && text.includes(query.toLowerCase());
  });
  const counts = {
    pending: reviews.items.filter((review) => review.status === 'pending').length,
    approved: reviews.items.filter((review) => review.status === 'approved').length,
    hidden: reviews.items.filter((review) => review.status === 'hidden').length,
  };

  async function changeStatus(review: Review, nextStatus: Review['status']) {
    await updateReviewStatus(review, nextStatus);
    await reviews.refresh();
    await products.refresh();
  }

  async function remove(review: Review) {
    if (!confirm('Delete this review?')) return;
    await deleteReview(review);
    await reviews.refresh();
    await products.refresh();
  }

  return (
    <section className="reviews-page">
      <div className="page-hero compact-hero">
        <div>
          <span className="eyebrow">Reviews</span>
          <h1>Review Moderation</h1>
          <p>Approve delivered-order reviews before they become public in the mobile app.</p>
        </div>
        <button onClick={reviews.refresh}>Refresh</button>
      </div>

      <div className="metric-grid">
        <Metric title="Pending" value={counts.pending} detail="waiting approval" />
        <Metric title="Approved" value={counts.approved} detail="public reviews" />
        <Metric title="Hidden" value={counts.hidden} detail="not visible" />
        <Metric title="Total" value={reviews.items.length} detail="all reviews" />
      </div>

      <section className="panel">
        <div className="toolbar">
          <div>
            <h2>Review Queue</h2>
            <p>{filtered.length} results</p>
          </div>
          <div className="toolbar-controls">
            <input placeholder="Search customer, product, comment" value={query} onChange={(event) => setQuery(event.target.value)} />
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="hidden">Hidden</option>
              <option value="all">All reviews</option>
            </select>
          </div>
        </div>

        {reviews.loading && <p>Loading reviews...</p>}
        {reviews.error && <p className="error">{reviews.error}</p>}

        <div className="review-stack">
          {filtered.map((review) => {
            const product = productById.get(review.productId);
            return (
              <article className="review-card moderation-card" key={review.id}>
                <div className="review-top">
                  <div>
                    <strong>{review.customerName || 'Glowza customer'}</strong>
                    <span>{product?.name || 'Unknown product'} - {review.rating}/5</span>
                  </div>
                  <span className="pill">{review.status}</span>
                </div>
                <p>{review.comment}</p>
                <div className="mini-pills">
                  <span>Order {review.orderId.slice(0, 8)}</span>
                  <span>User {review.userId.slice(0, 8)}</span>
                </div>
                <div className="row-actions">
                  <button disabled={review.status === 'approved'} onClick={() => void changeStatus(review, 'approved')}>Approve</button>
                  <button className="ghost" disabled={review.status === 'hidden'} onClick={() => void changeStatus(review, 'hidden')}>Hide</button>
                  <button className="danger" onClick={() => void remove(review)}>Delete</button>
                </div>
              </article>
            );
          })}
          {filtered.length === 0 && <p className="muted">No reviews match this filter.</p>}
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
