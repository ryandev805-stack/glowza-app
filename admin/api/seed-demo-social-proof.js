import { adminFieldValue, getAdminFirestore } from './_firebase-admin.js';

const firstNames = [
  'Ayesha', 'Fatima', 'Hira', 'Sana', 'Maham', 'Zainab', 'Iqra', 'Maryam', 'Noor', 'Anum',
  'Ali', 'Ahmed', 'Hassan', 'Usman', 'Bilal', 'Hamza', 'Danish', 'Saad', 'Rayan', 'Omar',
  'Areeba', 'Laiba', 'Mehwish', 'Nimra', 'Kinza', 'Amna', 'Esha', 'Komal', 'Rabia', 'Sidra',
  'Haris', 'Talha', 'Fahad', 'Shayan', 'Taha', 'Shahzaib', 'Farhan', 'Imran', 'Asad', 'Zohaib',
  'Aiman', 'Mahnoor', 'Minal', 'Alina', 'Bushra', 'Anaya', 'Hafsa', 'Kiran', 'Rida', 'Muskan',
];

const lastNames = [
  'Khan', 'Malik', 'Sheikh', 'Raza', 'Butt', 'Qureshi', 'Ahmed', 'Farooq', 'Javed', 'Mirza',
  'Chaudhry', 'Ansari', 'Baig', 'Hashmi', 'Siddiqui', 'Abbasi', 'Mughal', 'Nawaz', 'Aslam', 'Iqbal',
  'Yousaf', 'Rehman', 'Akhtar', 'Shah', 'Gill', 'Zafar', 'Hameed', 'Rashid', 'Latif', 'Saleem',
];

const averageComments = [
  'Theek hai price ke hisaab se, bas expectation thori zyada thi.',
  'Acha hai but delivery 1 din late aayi.',
  'Normal product hai, na zyada best na kharab.',
  'Daily use ke liye theek hai.',
  'Color pic se thora different tha but manageable hai.',
  'Quality theek hai lekin price thori high lagi.',
  'Packaging theek thi aur product bhi average tha.',
  '3 star bante hain, overall theek experience.',
  'Is range mein sahi hai, dubara order shayad karun.',
  'Theek thaak product hai, koi major issue nahi.',
  'Delivery rider acha tha, product average nikla.',
  'Use kar liya, abhi tak theek chal raha hai.',
  'Recommend kar sakte hain but full 5 star nahi.',
  'Finishing normal si thi, quality okay hai.',
  'Price thora kam hota to aur acha lagta.',
  'Gift diya tha cousin ko, unko pasand aya.',
  'Box thora damage tha lekin andar product safe tha.',
  'Fast delivery thi but product average laga.',
  'Size chart check karke order karein.',
  'Nayi cheez ki smell thi, 2 din baad theek ho gayi.',
  'Material average hai but use ho jata hai.',
  'Looks ache hain but quality utni premium nahi.',
  'Theek hai casual use ke liye.',
  'Product okay tha, bas packing aur achi ho sakti thi.',
  'Quality expected jaisi nahi thi but manageable hai.',
  'Average experience overall.',
  'Photo mein zyada acha lag raha tha.',
  'Theek product hai, return ki zarurat nahi pari.',
  'Normal quality hai according to price.',
  'Acha tha but wow factor nahi tha.',
  'Color aur better ho sakta tha.',
  'Theek hai but market mein similar cheaper mil jata hai.',
  'Product sahi mila lekin late receive hua.',
  'Soft hai but stitching average lagi.',
  'Use karne ke baad okay feel hua.',
  'Bas theek tha, kuch khaas nahi.',
  'Achi cheez hai but price zyada feel hui.',
  'Delivery quick thi lekin quality average lagi.',
  'Okay for the price.',
  'Expected se thora kam nikla.',
  'Theek hai beginners ke liye.',
  'Normal packing aur normal quality.',
  'Koi issue nahi aya abhi tak.',
  'Useable product hai.',
  'Satisfied but not fully impressed.',
  'Okayish experience.',
  '3 star enough hain iske liye.',
  'Average quality with decent finishing.',
  'Looks ache hain but material average hai.',
  'Worth it nahi but buri bhi nahi.',
];

const goodComments = [
  'Bohat acha hai, bilkul same as shown!',
  'Mujhe bohat pasand aya ❤️ definitely ordering again.',
  'Quality zabardast hai, paisa vasool product.',
  'Packaging neat thi aur product original laga.',
  '5 star bante hain, highly recommended.',
  'Pehli dafa order kiya aur experience bohat acha raha.',
  'Gift diya tha aur sab ko pasand aya.',
  'Delivery jaldi aayi aur product bhi solid nikla.',
  'Must buy hai is price range mein.',
  'Color bohat pyara hai aur material soft hai.',
  'Exactly same as picture, very satisfied.',
  'Value for money product.',
  'Friends ko bhi recommend kiya hai.',
  'Next sale mein phir order karunga.',
  'Expectation se zyada acha nikla.',
  'Fast shipping aur amazing quality.',
  'Gift wrapping bhi bohat achi thi.',
  '3 pieces order kiye thay, sab perfect aaye.',
  'Highly recommended ✅',
  'Size bilkul perfect aya.',
  '10/10 in this budget.',
  'Love it 😍',
  'Delivery aur product dono spot on.',
  'Mama ko bohat pasand aya.',
  'Dubara order pakka.',
  'Rider bhi polite tha aur parcel safe mila.',
  'Worth every rupee.',
  'Material bohat soft aur comfy hai.',
  'Live mein aur bhi acha lagta hai.',
  'Glass item tha phir bhi safely deliver hua.',
  'Expected average but surprisingly amazing nikla.',
  'Quality top notch hai.',
  'Achi finishing aur premium feel.',
  'Best purchase so far.',
  'Customer support bhi bohat cooperative thi.',
  'Exactly wahi mila jo order kiya tha.',
  'Delivery expected time se pehle aa gayi.',
  'Bahut hi pyari cheez hai.',
  'Packaging dekh ke hi premium feel aayi.',
  'Sab kuch perfect tha.',
  'Price ke hisaab se outstanding quality.',
  'Recommend to everyone.',
  'Excellent experience overall.',
  'Bohat acha fabric hai.',
  'Stylish aur comfortable dono hai.',
  'Family ko bhi pasand aya.',
  'Photos se bhi zyada acha nikla.',
  'Perfect gift item.',
  'Quality dekh ke maza aa gaya.',
  'Color bilkul same aya.',
  'Size fitting perfect hai.',
  'Product use karke genuinely acha laga.',
  'Amazing quality and quick delivery.',
  '100% satisfied customer.',
  'Is seller se phir shopping karunga.',
  'Acha experience raha overall.',
  'Trusted seller 👍',
  'Packaging bohat secure thi.',
  'Premium quality at affordable price.',
  'Super soft material.',
  'No defects at all.',
  'Stitching bohat clean hai.',
  'Luxury feel aati hai.',
  'Received exactly as expected.',
  'Har cheez perfect thi.',
  'Bohat smooth shopping experience.',
  'Excellent product quality.',
  'Really impressed by the quality.',
  'Affordable aur stylish.',
  'Design bohat elegant hai.',
  'Sab friends ne compliment kiya.',
  'Happy with my purchase.',
  'Definitely worth buying.',
  'Maza aa gaya honestly.',
  'Achi quality ke saath fast delivery.',
  'Satisfied beyond expectations.',
  'Excellent finishing.',
  'Pure value for money.',
  'Color combination bohat acha hai.',
  'Perfect for daily use.',
  'Lightweight aur comfortable.',
  'Received in perfect condition.',
  'The product feels premium.',
  'Fully recommended from my side.',
  'Quality aur packing dono impressive thay.',
  'Smooth experience from order to delivery.',
  'Customer service bhi responsive thi.',
  'Kamal ki quality hai.',
  'Bahut hi decent product hai.',
  'Budget friendly aur classy.',
  'Everything was exactly perfect.',
  'Excellent craftsmanship.',
  'Order karne ka decision worth it raha.',
  'Looks very elegant.',
  'Comfort level bohat acha hai.',
  'Amazing deal in this price.',
  'Perfectly packed and delivered.',
  'Product exceeded expectations.',
  'One of my best online purchases.',
  'Highly satisfied.',
  'Will shop again soon.',
  'Recommended for sure.',
  'Excellent quality control.',
  'Looks expensive but price reasonable hai.',
  'Stylish aur trendy product.',
  'The finishing is superb.',
  'Love the texture and quality.',
  'Everything arrived safely.',
  'Parcel receive karke bohat khushi hui.',
  '100% original and authentic feel.',
  'Beautifully designed product.',
  'Bohat hi neat finishing.',
  'No complaints at all.',
  'Excellent shopping experience.',
  'Fastest delivery I have received.',
  'Seller deserves 5 stars.',
  'Very impressive quality.',
  'Looks exactly like branded products.',
  'Achi cheez bheji hai seller ne.',
  'Product dekh ke dil khush ho gaya.',
  'Bilkul worth it.',
  'Premium feel with affordable pricing.',
  'Amazing purchase.',
  'Perfect in every way.',
  'Beautiful product ❤️',
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
