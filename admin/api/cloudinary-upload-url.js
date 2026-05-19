import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const folder = 'glowza';

function readEnv(name) {
  if (process.env[name]) {
    return process.env[name];
  }

  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    return undefined;
  }

  const line = fs
    .readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith(`${name}=`));

  if (!line) {
    return undefined;
  }

  return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');
}

function sign(params, secret) {
  const paramsToSign = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  return crypto.createHash('sha1').update(`${paramsToSign}${secret}`).digest('hex');
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

  const imageUrl = String(request.body?.imageUrl || '').trim();
  if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) {
    return response.status(400).json({ error: 'Valid image URL is required' });
  }

  const timestamp = Math.round(Date.now() / 1000);
  const params = { folder, timestamp };
  const signature = sign(params, apiSecret);
  const formData = new FormData();
  formData.append('file', imageUrl);
  formData.append('folder', folder);
  formData.append('timestamp', String(timestamp));
  formData.append('api_key', apiKey);
  formData.append('signature', signature);

  const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  });
  const body = await uploadResponse.json();

  if (!uploadResponse.ok) {
    return response.status(uploadResponse.status).json({
      error: body.error?.message || 'Cloudinary URL import failed',
    });
  }

  return response.status(200).json({ secureUrl: body.secure_url });
}
