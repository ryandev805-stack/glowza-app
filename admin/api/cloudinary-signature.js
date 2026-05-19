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

  const contents = fs.readFileSync(envPath, 'utf8');
  const line = contents
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith(`${name}=`));

  if (!line) {
    return undefined;
  }

  return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');
}

export default function handler(request, response) {
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

  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
  const signature = crypto
    .createHash('sha1')
    .update(`${paramsToSign}${apiSecret}`)
    .digest('hex');

  return response.status(200).json({
    cloudName,
    apiKey,
    timestamp,
    signature,
    folder,
  });
}
