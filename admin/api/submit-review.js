import { adminFieldValue, getAdminFirestore } from './_firebase-admin.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const userId = String(request.body?.userId || '').trim();
  const productId = String(request.body?.productId || '').trim();
  const orderId = String(request.body?.orderId || '').trim();
  const customerName = String(request.body?.customerName || '').trim();
  const comment = String(request.body?.comment || '').trim();
  const rating = Number(request.body?.rating || 0);

  if (!userId || !productId || !orderId || !customerName || comment.length < 8 || rating < 1 || rating > 5) {
    return response.status(400).json({ error: 'Valid review details are required' });
  }

  try {
    const db = getAdminFirestore();
    const orderRef = db.collection('orders').doc(orderId);
    const orderDoc = await orderRef.get();
    if (!orderDoc.exists) {
      return response.status(404).json({ error: 'Order not found' });
    }

    const order = orderDoc.data();
    if (order.userId !== userId) {
      return response.status(403).json({ error: 'This order does not belong to the current user' });
    }
    if (String(order.status || '').toLowerCase() !== 'delivered') {
      return response.status(403).json({ error: 'Review is available after delivery only' });
    }
    const containsProduct = Array.isArray(order.products) && order.products.some((product) => product.productId === productId);
    if (!containsProduct) {
      return response.status(403).json({ error: 'This product was not part of the delivered order' });
    }

    const duplicate = await db
      .collection('reviews')
      .where('userId', '==', userId)
      .get();
    const alreadyReviewed = duplicate.docs.some((doc) => {
      const review = doc.data();
      return review.orderId === orderId && review.productId === productId;
    });
    if (alreadyReviewed) {
      return response.status(409).json({ error: 'You have already reviewed this delivered item' });
    }

    const reviewRef = db.collection('reviews').doc();
    await reviewRef.set({
      userId,
      productId,
      orderId,
      rating,
      comment,
      customerName,
      status: 'pending',
      createdAt: adminFieldValue.serverTimestamp(),
      updatedAt: adminFieldValue.serverTimestamp(),
    });

    return response.status(200).json({ reviewId: reviewRef.id, status: 'pending' });
  } catch (error) {
    return response.status(500).json({
      error: error instanceof Error ? error.message : 'Could not submit review',
    });
  }
}
