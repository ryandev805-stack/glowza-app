import { adminFieldValue, getAdminFirestore } from './_firebase-admin.js';

const firstNames = [
  'Ayesha', 'Fatima', 'Hira', 'Sana', 'Maham', 'Zainab', 'Iqra', 'Maryam', 'Noor', 'Anum',
  'Ali', 'Ahmed', 'Hassan', 'Usman', 'Bilal', 'Hamza', 'Danish', 'Saad', 'Rayan', 'Omar',
];
const lastNames = [
  'Khan', 'Malik', 'Sheikh', 'Raza', 'Butt', 'Qureshi', 'Ahmed', 'Farooq', 'Javed', 'Mirza',
];
const averageComments = [
  'theek hai price k hisab se, khas wow nhi',
  'acha ha bs delivery 1 din late ai',
  'normal cheez hai, kharab b nhi zyada best b nhi',
  'ok ok use ho jati hai daily',
  'pic sy thora diff tha color but chalta hai',
  'mehnga feel hua thora lekin quality theek',
  'packaging theek thi product b theek, average experience',
  '3 star dena banta hai, koi issue nhi bas expectation zyada thi',
  'sahi ha is range mein, dubara soch k order kru gi',
  'theek theek, khas complaint nhi',
  'delivery rider acha tha, product average',
  'use kr liya, chal rha hai abhi tak',
  'hn theek hai, recommend half half',
  'quality ok hai finishing thori normal',
  'price kam hota to 4 star deti, warna 3',
  'gift dia tha cousin ko, unko theek laga',
  'box thora kharab aya andar sab ok tha',
  'fast delivery thi product normal hi hai',
  'acha laga but size chart dekh k order krein',
  'thori smell ai nayi cheez ki, 2 din baad theek',
];
const goodComments = [
  'bht acha hai yaar, same jesa pic mein tha',
  'mujhe bohat pasand aya ❤️ dubara order kru gi',
  'quality zabardast hai, paisay wasool',
  'packaging neat thi, product b original laga',
  '5 star banta hai, recommend krta hun',
  'glowza se pehli dfa order, experience acha rha',
  'wife ko dia pasand a gya, shukriya',
  'delivery jaldi ai, cheez b solid hai',
  'bhai ye wala must buy hai is price mein',
  'bohat pyara color aur stuff soft hai',
  'pic match krta 100%, happy customer',
  'acha product hai, value for money',
  'maza aya use kr k, friends ko b bola hai',
  'satisfied hun, next sale mein phr lunga',
  'quality se zyada expectation thi acha surprise',
  'fast shipping + achi cheez = 5 star',
  'gift wrap acha tha, product b top notch',
  'yaar kamaal hai, 3 pieces order kiye thy sab ok',
  'recommend ✅',
  'bnti hai bilkul, size perfect aya',
  '10/10 is price range mein',
  'hn bht acha',
  'love it',
  'sahi cheez hai glowza',
  'delivery + product dono spot on',
  'mama ko pasand aya, unki taraf se thanks',
  'quality achi hai, dubara order pakka',
  'acha laga, rider b polite tha',
  'worth it hai, mehnga nhi laga end mein',
  'bohat soft material hai, comfy',
  'exact same hai jesa live mein dikha tha',
  'star dena bhool gya warna 5 tha 😅',
  'pkging safe thi, glass item b safe aya',
  'ziada socha tha average hoga, par acha nikla',
];

function pick(list, index) {
  return list[index % list.length];
}

function pickReview(list, productIndex, reviewIndex) {
  return list[(productIndex * 5 + reviewIndex * 13) % list.length];
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
          comment: pickReview(averageComments, productIndex, 0),
          createdAt: new Date(Date.now() - (productIndex + 3) * 86400000).toISOString(),
        },
        {
          customerName: customer(productIndex * 3 + 1),
          rating: 5,
          comment: pickReview(goodComments, productIndex, 1),
          createdAt: new Date(Date.now() - (productIndex + 2) * 86400000).toISOString(),
        },
        {
          customerName: customer(productIndex * 3 + 2),
          rating: 4,
          comment: pickReview(goodComments, productIndex, 2),
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
