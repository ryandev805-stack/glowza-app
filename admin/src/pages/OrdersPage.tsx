import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, Clipboard, PackageCheck, Phone, RefreshCcw, Truck } from 'lucide-react';
import { listOrders, updateOrderStatus } from '../services/firestoreService';
import type { Order } from '../types';
import { useCollection } from '../hooks/useCollection';

const statuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

function money(value: number | undefined) {
  return `PKR ${Number(value || 0).toLocaleString('en-PK')}`;
}

function orderTax(order: Order) {
  return Number(order.taxFee || 0);
}

function orderCodHandling(order: Order) {
  return Number(order.codHandlingFee || 0);
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
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const selected = useMemo(
    () => items.find((order) => order.id === orderId) || null,
    [items, orderId],
  );

  const filteredOrders = items.filter((order) => {
    const text = `${order.orderNumber} ${order.customerName} ${order.customerPhone} ${order.city}`.toLowerCase();
    const statusMatches = statusFilter === 'all' || order.status === statusFilter;
    return text.includes(query.toLowerCase()) && statusMatches;
  });
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const pagedOrders = filteredOrders.slice((page - 1) * pageSize, page * pageSize);
  const pending = items.filter((order) => order.status === 'pending').length;
  const revenue = items.reduce((total, order) => total + Number(order.total || 0), 0);
  const statusCounts = statuses.reduce<Record<string, number>>((counts, status) => {
    counts[status] = items.filter((order) => order.status === status).length;
    return counts;
  }, {});

  useEffect(() => {
    if (orderId && !loading && !selected) {
      onBack();
    }
  }, [orderId, loading, selected, onBack]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  async function setStatus(id: string, status: string) {
    await updateOrderStatus(id, status);
    await refresh();
  }

  async function copyOrder(order: Order) {
    const products = (order.products || [])
      .map((product) => `- ${product.name} x ${product.quantity} = ${money(product.price * product.quantity)}`)
      .join('\n');
    await navigator.clipboard?.writeText(
      `${order.orderNumber}\n${order.customerName}\n${order.customerPhone}\n${order.address}, ${order.city}\nArea: ${order.notes || 'None'}\nNearby: ${order.nearbyPlace || 'None'}\n\n${products}\n\nTotal: ${money(order.total)}`,
    );
  }

  return (
    <section className="orders-page">
      <div className="page-hero compact-hero">
        <div>
          <span className="eyebrow">Orders</span>
          <h1>{selected ? selected.orderNumber : 'Order Queue'}</h1>
          <p>Track orders, customer delivery details, products, and fulfillment status.</p>
        </div>
        {selected ? <button className="ghost" onClick={onBack}>Back to Orders</button> : <button onClick={refresh}><RefreshCcw size={17} /> Refresh</button>}
      </div>

      <div className="metric-grid">
        <Metric title="Total Orders" value={items.length} detail={`${pending} pending`} />
        <Metric title="Revenue" value={money(revenue)} detail="all loaded orders" />
        <Metric title="Delivered" value={items.filter((order) => order.status === 'delivered').length} detail="completed orders" />
        <Metric title="Cancelled" value={items.filter((order) => order.status === 'cancelled').length} detail="cancelled orders" />
      </div>

      <section className="panel">
        <div>
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
          <div className="status-filter-row">
            <button className={statusFilter === 'all' ? 'active' : ''} onClick={() => setStatusFilter('all')}>All <span>{items.length}</span></button>
            {statuses.map((status) => (
              <button key={status} className={statusFilter === status ? 'active' : ''} onClick={() => setStatusFilter(status)}>
                {status} <span>{statusCounts[status] || 0}</span>
              </button>
            ))}
          </div>

          {loading && <p>Loading orders...</p>}
          {error && <p className="error">{error}</p>}

          <div className="data-list">
            {pagedOrders.map((order) => (
              <article key={order.id} className={`data-card order-card ${order.id === selected?.id ? 'selected' : ''}`}>
                <div className="status-dot" data-status={order.status} />
                <div className="data-main">
                  <strong>{order.orderNumber}</strong>
                  <span>{order.customerName} - {order.customerPhone}</span>
                  <div className="mini-pills">
                    <span>{money(order.total)}</span>
                    <span>{order.totalItems} items</span>
                    <span>{order.city}</span>
                    {order.nearbyPlace ? <span>{order.nearbyPlace}</span> : null}
                    <span>{order.paymentStatus}</span>
                  </div>
                </div>
                <div className="row-actions">
                  <select value={order.status} onChange={(event) => void setStatus(order.id, event.target.value)}>
                    {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                  <button className="ghost" onClick={() => void copyOrder(order)}><Clipboard size={15} /> Copy</button>
                  <button onClick={() => onView(order.id)}>Manage</button>
                </div>
              </article>
            ))}
          </div>
          <div className="pagination">
            <button className="ghost" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
            <span>Page {page} of {totalPages}</span>
            <button className="ghost" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</button>
          </div>
        </div>

        {selected && (
          <AdminModal onClose={onBack}>
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

            <div className="order-quick-actions">
              <button className="ghost" onClick={() => void setStatus(selected.id, 'confirmed')}><CheckCircle2 size={16} /> Confirm</button>
              <button className="ghost" onClick={() => void setStatus(selected.id, 'processing')}><PackageCheck size={16} /> Process</button>
              <button className="ghost" onClick={() => void setStatus(selected.id, 'shipped')}><Truck size={16} /> Ship</button>
              <button onClick={() => void setStatus(selected.id, 'delivered')}><CheckCircle2 size={16} /> Delivered</button>
            </div>

            <div className="detail-grid">
              <div><span>Customer</span><strong>{selected.customerName}</strong></div>
              <div><span>Phone</span><strong>{selected.customerPhone}</strong></div>
              <div><span>City</span><strong>{selected.city}</strong></div>
              <div><span>Area</span><strong>{selected.notes || 'None'}</strong></div>
              <div><span>Nearby Famous Place</span><strong>{selected.nearbyPlace || 'None'}</strong></div>
              <div><span>Payment</span><strong>{selected.paymentMethod}</strong></div>
              <div><span>Payment Status</span><strong>{selected.paymentStatus}</strong></div>
            </div>

            <section className="detail-block">
              <h3>Delivery Address</h3>
              <p>{selected.address}</p>
              <div className="row-actions order-contact-actions">
                <a className="ghost-link" href={`tel:${selected.customerPhone}`}><Phone size={15} /> Call</a>
                <button className="ghost" onClick={() => void copyOrder(selected)}><Clipboard size={15} /> Copy Order</button>
              </div>
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
              <div><span>Tax</span><strong>{money(orderTax(selected))}</strong></div>
              <div><span>COD handling</span><strong>{money(orderCodHandling(selected))}</strong></div>
              <div><span>Discount</span><strong>{money(selected.discount)}</strong></div>
              <div><span>Total</span><strong>{money(selected.total)}</strong></div>
            </div>
          </AdminModal>
        )}
      </section>
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
