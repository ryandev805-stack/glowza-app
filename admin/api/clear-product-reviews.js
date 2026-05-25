import { adminFieldValue, getAdminFirestore } from './_firebase-admin.js';

async function commitChunks(db, writes) {
  let committed = 0;
  for (let index = 0; index < writes.length; index += 450) {
    const batch = db.batch();
    writes.slice(index, index + 450).forEach((write) => write(batch));
    await batch.commit();
    committed += Math.min(450, writes.length - index);
  }
  return committed;
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const db = getAdminFirestore();
    const productSnapshot = await db.collection('products').get();
    const products = productSnapshot.docs;

    if (products.length === 0) {
      return response.status(200).json({ productsUpdated: 0 });
    }

    const writes = products.map((productDoc) => (batch) => batch.update(productDoc.ref, {
      reviews: [],
      rating: 0,
      reviewCount: 0,
      updatedAt: adminFieldValue.serverTimestamp(),
    }));

    await commitChunks(db, writes);

    return response.status(200).json({
      productsUpdated: products.length,
    });
  } catch (error) {
    return response.status(500).json({
      error: error instanceof Error ? error.message : 'Could not clear product reviews',
    });
  }
}
