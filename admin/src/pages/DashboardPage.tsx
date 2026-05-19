import { useCallback } from 'react';
import { listCategories, listOrders, listProducts, listUsers } from '../services/firestoreService';
import type { Category, Order, Product, User } from '../types';
import { useCollection } from '../hooks/useCollection';

function money(value: number) {
  return `PKR ${value.toLocaleString('en-PK')}`;
}

export function DashboardPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const products = useCollection<Product>(useCallback(() => listProducts(), []));
  const categories = useCollection<Category>(useCallback(() => listCategories(), []));
  const orders = useCollection<Order>(useCallback(() => listOrders(), []));
  const users = useCollection<User>(useCallback(() => listUsers(), []));

  const revenue = orders.items.reduce((total, order) => total + Number(order.total || 0), 0);
  const pending = orders.items.filter((order) => order.status === 'pending').length;
  const lowStock = products.items.filter((product) => Number(product.stock || 0) <= 5).length;

  return (
    <section className="dashboard">
      <div className="page-hero">
        <div>
          <span className="eyebrow">Overview</span>
          <h1>Glowza operations</h1>
          <p>Manage catalogue, orders, customers and reviews from one Firestore-backed admin panel.</p>
        </div>
        <div className="hero-actions">
          <button onClick={() => onNavigate('/products/new')}>Add Product</button>
          <button className="ghost" onClick={() => onNavigate('/orders')}>View Orders</button>
        </div>
      </div>

      <div className="metric-grid">
        <Metric title="Products" value={products.items.length} detail={`${lowStock} low stock`} />
        <Metric title="Categories" value={categories.items.length} detail="storefront groups" />
        <Metric title="Orders" value={orders.items.length} detail={`${pending} pending`} />
        <Metric title="Revenue" value={money(revenue)} detail={`${users.items.length} users`} />
      </div>

      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>Recent Orders</h2>
            <p>Latest Firestore orders</p>
          </div>
          <button className="ghost" onClick={() => onNavigate('/orders')}>Open Orders</button>
        </div>
        <div className="mobile-list">
          {orders.items.slice(0, 6).map((order) => (
            <article className="simple-row clickable" key={order.id} onClick={() => onNavigate(`/orders/${order.id}`)}>
              <div>
                <strong>{order.orderNumber}</strong>
                <span>{order.customerName} - {order.status}</span>
              </div>
              <strong>{money(order.total)}</strong>
            </article>
          ))}
        </div>
      </div>

      <div className="quick-grid">
        <button className="quick-action" onClick={() => onNavigate('/products')}>
          <strong>Catalogue</strong>
          <span>Edit products, pricing, stock and media</span>
        </button>
        <button className="quick-action" onClick={() => onNavigate('/categories')}>
          <strong>Categories</strong>
          <span>Manage storefront navigation groups</span>
        </button>
        <button className="quick-action" onClick={() => onNavigate('/banners')}>
          <strong>Banners</strong>
          <span>Control home slider images and links</span>
        </button>
        <button className="quick-action" onClick={() => onNavigate('/reviews')}>
          <strong>Reviews</strong>
          <span>Moderate product reviews and ratings</span>
        </button>
        <button className="quick-action" onClick={() => onNavigate('/notifications')}>
          <strong>Notifications</strong>
          <span>Send promotional and service alerts</span>
        </button>
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
