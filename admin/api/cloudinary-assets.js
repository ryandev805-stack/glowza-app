import fs from 'node:fs';
import path from 'node:path';

const folder = 'glowza';

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

async function listByType(resourceType, cloudName, authHeader) {
  const resources = [];
  let nextCursor = '';

  do {
    const url = new URL(`https://api.cloudinary.com/v1_1/${cloudName}/resources/${resourceType}/upload`);
    url.searchParams.set('prefix', `${folder}/`);
    url.searchParams.set('max_results', '500');
    if (nextCursor) url.searchParams.set('next_cursor', nextCursor);

    const response = await fetch(url, { headers: { authorization: authHeader } });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.error?.message || `Could not list ${resourceType} assets`);
    }

    resources.push(
      ...(body.resources || []).map((asset) => ({
        publicId: asset.public_id,
        resourceType,
        format: asset.format || '',
        bytes: Number(asset.bytes || 0),
        width: asset.width || 0,
        height: asset.height || 0,
        secureUrl: asset.secure_url,
        createdAt: asset.created_at,
      })),
    );
    nextCursor = body.next_cursor || '';
  } while (nextCursor);

  return resources;
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const cloudName = readEnv('CLOUDINARY_CLOUD_NAME');
  const apiKey = readEnv('CLOUDINARY_API_KEY');
  const apiSecret = readEnv('CLOUDINARY_API_SECRET');

  if (!cloudName || !apiKey || !apiSecret) {
    return response.status(500).json({ error: 'Cloudinary server env vars are missing' });
  }

  try {
    const authHeader = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`;
    const [images, videos] = await Promise.all([
      listByType('image', cloudName, authHeader),
      listByType('video', cloudName, authHeader),
    ]);

    return response.status(200).json({
      folder,
      assets: [...images, ...videos].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
    });
  } catch (error) {
    return response.status(500).json({
      error: error instanceof Error ? error.message : 'Could not list Cloudinary assets',
    });
  }
}
