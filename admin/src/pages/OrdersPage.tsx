import { useCallback, useEffect, useMemo, useState } from 'react';
import { listOrders, updateOrderStatus } from '../services/firestoreService';
import type { Order } from '../types';
import { useCollection } from '../hooks/useCollection';

const statuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

function money(value: number | undefined) {
  return `PKR ${Number(value || 0).toLocaleString('en-PK')}`;
}

export function OrdersPage({
  orderId,
  onView,
  onBack,
}: {
  orderId?: string;
  onView: (id: string) => void;
  onBack: () => void;
}) {
  const loader = useCallback(() => listOrders(), []);
  const { items, loading, error, refresh } = useCollection<Order>(loader);
  const [statusFilter, setStatusFilter] = useState('all');
  const [query, setQuery] = useState('');
  const selected = useMemo(
    () => items.find((order) => order.id === orderId) || null,
    [items, orderId],
  );

  const filteredOrders = items.filter((order) => {
    const text = `${order.orderNumber} ${order.customerName} ${order.customerPhone} ${order.city}`.toLowerCase();
    const statusMatches = statusFilter === 'all' || order.status === statusFilter;
    return text.includes(query.toLowerCase()) && statusMatches;
  });
  const pending = items.filter((order) => order.status === 'pending').length;
  const revenue = items.reduce((total, order) => total + Number(order.total || 0), 0);

  useEffect(() => {
    if (orderId && !loading && !selected) {
      onBack();
    }
  }, [orderId, loading, selected, onBack]);

  async function setStatus(id: string, status: string) {
    await updateOrderStatus(id, status);
    await refresh();
  }

  return (
    <section className="orders-page">
      <div className="page-hero compact-hero">
        <div>
          <span className="eyebrow">Orders</span>
          <h1>{selected ? selected.orderNumber : 'Order Queue'}</h1>
          <p>Track COD orders, customer delivery details, products, and fulfillment status.</p>
        </div>
        {selected ? <button className="ghost" onClick={onBack}>Back to Orders</button> : <button onClick={refresh}>Refresh</button>}
      </div>

      <div className="metric-grid">
        <Metric title="Total Orders" value={items.length} detail={`${pending} pending`} />
        <Metric title="Revenue" value={money(revenue)} detail="all loaded orders" />
        <Metric title="Delivered" value={items.filter((order) => order.status === 'delivered').length} detail="completed orders" />
        <Metric title="Cancelled" value={items.filter((order) => order.status === 'cancelled').length} detail="cancelled orders" />
      </div>

      <section className={selected ? 'orders-layout' : 'panel'}>
        <div className={selected ? 'panel' : ''}>
          <div className="toolbar">
            <div>
              <h2>Orders</h2>
              <p>{filteredOrders.length} results</p>
            </div>
            <div className="toolbar-controls">
              <input placeholder="Search order, customer, phone, city" value={query} onChange={(event) => setQuery(event.target.value)} />
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">All statuses</option>
                {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
          </div>

          {loading && <p>Loading orders...</p>}
          {error && <p className="error">{error}</p>}

          <div className="data-list">
            {filteredOrders.map((order) => (
              <article key={order.id} className={`data-card order-card ${order.id === selected?.id ? 'selected' : ''}`}>
                <div className="status-dot" data-status={order.status} />
                <div className="data-main">
                  <strong>{order.orderNumber}</strong>
                  <span>{order.customerName} - {order.customerPhone}</span>
                  <div className="mini-pills">
                    <span>{money(order.total)}</span>
                    <span>{order.totalItems} items</span>
                    <span>{order.city}</span>
                  </div>
                </div>
                <div className="row-actions">
                  <select value={order.status} onChange={(event) => void setStatus(order.id, event.target.value)}>
                    {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                  <button onClick={() => onView(order.id)}>Detail</button>
                </div>
              </article>
            ))}
          </div>
        </div>

        {selected && (
          <aside className="panel detail-panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">Order Detail</span>
                <h2>{selected.orderNumber}</h2>
                <p>{selected.status} - {selected.paymentMethod}</p>
              </div>
              <select value={selected.status} onChange={(event) => void setStatus(selected.id, event.target.value)}>
                {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>

            <div className="detail-grid">
              <div><span>Customer</span><strong>{selected.customerName}</strong></div>
              <div><span>Phone</span><strong>{selected.customerPhone}</strong></div>
              <div><span>City</span><strong>{selected.city}</strong></div>
              <div><span>Area/Notes</span><strong>{selected.notes || 'None'}</strong></div>
              <div><span>Payment</span><strong>{selected.paymentMethod}</strong></div>
              <div><span>Payment Status</span><strong>{selected.paymentStatus}</strong></div>
            </div>

            <section className="detail-block">
              <h3>Delivery Address</h3>
              <p>{selected.address}</p>
            </section>

            <section className="detail-block">
              <h3>Products</h3>
              <div className="order-products">
                {(selected.products || []).map((product) => (
                  <div key={`${product.productId}-${product.name}`} className="order-product">
                    {product.image ? <img src={product.image} alt="" /> : <div className="empty-thumb">P</div>}
                    <div>
                      <strong>{product.name}</strong>
                      <p>{money(product.price)} x {product.quantity}</p>
                    </div>
                    <span>{money(product.price * product.quantity)}</span>
                  </div>
                ))}
              </div>
            </section>

            <div className="totals">
              <div><span>Subtotal</span><strong>{money(selected.subtotal)}</strong></div>
              <div><span>Shipping</span><strong>{money(selected.shippingFee)}</strong></div>
              <div><span>Discount</span><strong>{money(selected.discount)}</strong></div>
              <div><span>Total</span><strong>{money(selected.total)}</strong></div>
            </div>
          </aside>
        )}
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
