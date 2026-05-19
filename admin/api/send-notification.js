import { adminFieldValue, getAdminFirestore, getAdminMessaging } from './_firebase-admin.js';

const validTargets = new Set(['all', 'platform', 'user']);

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const title = String(request.body?.title || '').trim();
  const body = String(request.body?.body || '').trim();
  const image = String(request.body?.image || '').trim();
  const targetType = String(request.body?.targetType || 'all');
  const targetValue = String(request.body?.targetValue || '').trim();

  if (!title || !body) {
    return response.status(400).json({ error: 'Title and message are required' });
  }
  if (!validTargets.has(targetType)) {
    return response.status(400).json({ error: 'Invalid target type' });
  }

  try {
    const db = getAdminFirestore();
    const campaignRef = db.collection('notification_campaigns').doc();
    let query = db.collection('device_tokens').where('isActive', '==', true);
    if (targetType === 'platform') {
      query = query.where('platform', '==', targetValue);
    }
    if (targetType === 'user') {
      query = query.where('userId', '==', targetValue);
    }

    const tokenSnapshot = await query.get();
    const tokens = tokenSnapshot.docs
      .map((doc) => doc.data().token)
      .filter(Boolean);

    if (tokens.length === 0) {
      await campaignRef.set({
        title,
        body,
        image,
        targetType,
        targetValue,
        status: 'failed',
        sentCount: 0,
        createdAt: adminFieldValue.serverTimestamp(),
        sentAt: adminFieldValue.serverTimestamp(),
      });
      return response.status(400).json({ error: 'No active device tokens found for this target' });
    }

    const messaging = getAdminMessaging();
    let sentCount = 0;
    for (let index = 0; index < tokens.length; index += 500) {
      const batch = tokens.slice(index, index + 500);
      const result = await messaging.sendEachForMulticast({
        tokens: batch,
        notification: { title, body, ...(image ? { imageUrl: image } : {}) },
        data: {
          type: 'campaign',
          targetType,
          targetValue,
        },
        android: {
          notification: {
            channelId: 'glowza_promotions',
            imageUrl: image || undefined,
          },
        },
        apns: image
          ? {
              payload: { aps: { mutableContent: true } },
              fcmOptions: { imageUrl: image },
            }
          : undefined,
      });
      sentCount += result.successCount;
    }

    await campaignRef.set({
      title,
      body,
      image,
      targetType,
      targetValue,
      status: 'sent',
      sentCount,
      createdAt: adminFieldValue.serverTimestamp(),
      sentAt: adminFieldValue.serverTimestamp(),
    });

    return response.status(200).json({ campaignId: campaignRef.id, sentCount });
  } catch (error) {
    return response.status(500).json({
      error: error instanceof Error ? error.message : 'Could not send notification',
    });
  }
}
