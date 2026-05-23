import fs from 'node:fs';
import path from 'node:path';

function readEnv(name) {
  if (process.env[name]) return process.env[name];

  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return undefined;

  const line = fs
    .readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith(`${name}=`));

  return line ? line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '') : undefined;
}

async function deleteBatch(resourceType, publicIds, cloudName, authHeader) {
  if (publicIds.length === 0) return {};

  const formData = new FormData();
  publicIds.forEach((publicId) => formData.append('public_ids[]', publicId));
  formData.append('invalidate', 'true');

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/resources/${resourceType}/upload`, {
    method: 'DELETE',
    headers: { authorization: authHeader },
    body: formData,
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error?.message || `Could not delete ${resourceType} assets`);
  }
  return body.deleted || {};
}

async function deleteInChunks(resourceType, publicIds, cloudName, authHeader) {
  const deleted = {};
  for (let index = 0; index < publicIds.length; index += 100) {
    const chunk = publicIds.slice(index, index + 100);
    Object.assign(deleted, await deleteBatch(resourceType, chunk, cloudName, authHeader));
  }
  return deleted;
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const cloudName = readEnv('CLOUDINARY_CLOUD_NAME');
  const apiKey = readEnv('CLOUDINARY_API_KEY');
  const apiSecret = readEnv('CLOUDINARY_API_SECRET');

  if (!cloudName || !apiKey || !apiSecret) {
    return response.status(500).json({ error: 'Cloudinary server env vars are missing' });
  }

  const assets = Array.isArray(request.body?.assets) ? request.body.assets : [];
  const safeAssets = assets
    .map((asset) => ({
      publicId: String(asset.publicId || ''),
      resourceType: asset.resourceType === 'video' ? 'video' : 'image',
    }))
    .filter((asset) => asset.publicId.startsWith('glowza/'));

  if (safeAssets.length === 0) {
    return response.status(400).json({ error: 'No valid Glowza Cloudinary assets selected' });
  }

  try {
    const authHeader = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`;
    const imageIds = safeAssets.filter((asset) => asset.resourceType === 'image').map((asset) => asset.publicId);
    const videoIds = safeAssets.filter((asset) => asset.resourceType === 'video').map((asset) => asset.publicId);
    const [deletedImages, deletedVideos] = await Promise.all([
      deleteInChunks('image', imageIds, cloudName, authHeader),
      deleteInChunks('video', videoIds, cloudName, authHeader),
    ]);

    return response.status(200).json({
      deleted: { ...deletedImages, ...deletedVideos },
      requested: safeAssets.length,
      batches: Math.ceil(imageIds.length / 100) + Math.ceil(videoIds.length / 100),
    });
  } catch (error) {
    return response.status(500).json({
      error: error instanceof Error ? error.message : 'Could not delete Cloudinary assets',
    });
  }
}
