import { adminFieldValue, getAdminFirestore } from './_firebase-admin.js';

const firstNames = [
  'Ayesha', 'Fatima', 'Hira', 'Sana', 'Maham', 'Zainab', 'Iqra', 'Maryam', 'Noor', 'Anum',
  'Ali', 'Ahmed', 'Hassan', 'Usman', 'Bilal', 'Hamza', 'Danish', 'Saad', 'Rayan', 'Omar',
];
const lastNames = [
  'Khan', 'Malik', 'Sheikh', 'Raza', 'Butt', 'Qureshi', 'Ahmed', 'Farooq', 'Javed', 'Mirza',
];
const averageComments = [
  'Product is okay for the price. Delivery was fine and packaging was acceptable.',
  'Average experience overall. It works, but I expected slightly better finishing.',
  'Decent item for daily use. Not perfect, but fair value in this price range.',
];
const goodComments = [
  'Very good quality and exactly as shown. I am satisfied with this purchase.',
  'Loved the product. Packaging was neat and delivery was smooth.',
  'Great value for money. I would recommend this to other buyers.',
  'Quality is better than expected. Will order again from Glowza.',
  'Nice product, useful and well packed. Good shopping experience.',
];

function pick(list, index) {
  return list[index % list.length];
}

function customer(index) {
  return `${pick(firstNames, index)} ${pick(lastNames, Math.floor(index / firstNames.length))}`;
}

function buildSearchTokens(values) {
  const text = values
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ');
  const words = text
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2);
  const tokens = new Set();
  words.forEach((word) => {
    tokens.add(word);
    if (word.length >= 4) tokens.add(word.slice(0, 4));
    if (word.length >= 6) tokens.add(word.slice(0, 6));
  });
  return {
    searchText: text.replace(/\s+/g, ' ').trim(),
    searchTokens: [...tokens].slice(0, 80),
  };
}

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
    const productSnapshot = await db.collection('products').where('isActive', '==', true).get();
    const products = productSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (products.length === 0) {
      return response.status(400).json({ error: 'No active products found to seed reviews.' });
    }

    const userWrites = [];
    for (let index = 0; index < 1000; index += 1) {
      const userRef = db.collection('users').doc(`demo_user_${String(index + 1).padStart(4, '0')}`);
      userWrites.push((batch) => batch.set(userRef, {
        name: customer(index),
        phone: `+92300${String(1000000 + index).slice(-7)}`,
        role: 'customer',
        isDemo: true,
        createdAt: adminFieldValue.serverTimestamp(),
        updatedAt: adminFieldValue.serverTimestamp(),
      }, { merge: true }));
    }

    const reviewWrites = [];
    products.forEach((product, productIndex) => {
      const publicReviews = [
        {
          customerName: customer(productIndex * 3),
          rating: 3,
          comment: pick(averageComments, productIndex),
          createdAt: new Date(Date.now() - (productIndex + 3) * 86400000).toISOString(),
        },
        {
          customerName: customer(productIndex * 3 + 1),
          rating: 5,
          comment: pick(goodComments, productIndex),
          createdAt: new Date(Date.now() - (productIndex + 2) * 86400000).toISOString(),
        },
        {
          customerName: customer(productIndex * 3 + 2),
          rating: 4,
          comment: pick(goodComments, productIndex + 2),
          createdAt: new Date(Date.now() - (productIndex + 1) * 86400000).toISOString(),
        },
      ];
      const rating = Number((publicReviews.reduce((total, review) => total + review.rating, 0) / publicReviews.length).toFixed(1));
      const productRef = db.collection('products').doc(product.id);

      reviewWrites.push((batch) => batch.update(productRef, {
        ...buildSearchTokens([
          product.name,
          product.description,
          product.brand,
          product.productType,
          product.skinType,
          product.ingredients,
          product.howToUse,
        ]),
        reviews: publicReviews,
        rating,
        reviewCount: publicReviews.length,
        updatedAt: adminFieldValue.serverTimestamp(),
      }));

      publicReviews.forEach((review, reviewIndex) => {
        const reviewRef = db.collection('reviews').doc(`demo_${product.id}_${reviewIndex + 1}`);
        reviewWrites.push((batch) => batch.set(reviewRef, {
          userId: `demo_user_${String((productIndex * 3 + reviewIndex) % 1000 + 1).padStart(4, '0')}`,
          productId: product.id,
          orderId: `demo_order_${product.id}_${reviewIndex + 1}`,
          rating: review.rating,
          comment: review.comment,
          customerName: review.customerName,
          status: 'approved',
          isDemo: true,
          createdAt: adminFieldValue.serverTimestamp(),
          updatedAt: adminFieldValue.serverTimestamp(),
        }, { merge: true }));
      });
    });

    await commitChunks(db, userWrites);
    await commitChunks(db, reviewWrites);

    return response.status(200).json({
      usersCreated: 1000,
      productsUpdated: products.length,
      reviewsCreated: products.length * 3,
    });
  } catch (error) {
    return response.status(500).json({
      error: error instanceof Error ? error.message : 'Could not seed demo users and reviews',
    });
  }
}
