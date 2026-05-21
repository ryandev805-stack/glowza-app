export async function uploadToCloudinary(file: File): Promise<string> {
  const signatureResponse = await fetch('/api/cloudinary-signature', {
    method: 'POST',
  });
  const signatureBody = await signatureResponse.json();
  if (!signatureResponse.ok) {
    throw new Error(signatureBody.error || 'Cloudinary signature failed');
  }

  const { cloudName, apiKey, timestamp, signature, folder } = signatureBody as {
    cloudName: string;
    apiKey: string;
    timestamp: number;
    signature: string;
    folder: string;
  };

  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', apiKey);
  formData.append('timestamp', String(timestamp));
  formData.append('signature', signature);
  formData.append('folder', folder);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
    {
      method: 'POST',
      body: formData,
    },
  );
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error?.message || 'Cloudinary upload failed');
  }
  return body.secure_url as string;
}

export async function importImageUrlToCloudinary(imageUrl: string): Promise<string> {
  return importMediaUrlToCloudinary(imageUrl);
}

export async function importMediaUrlToCloudinary(mediaUrl: string): Promise<string> {
  const response = await fetch('/api/cloudinary-upload-url', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mediaUrl }),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || 'Cloudinary media import failed');
  }
  return body.secureUrl as string;
}

export type CloudinaryAsset = {
  publicId: string;
  resourceType: 'image' | 'video';
  format: string;
  bytes: number;
  width: number;
  height: number;
  secureUrl: string;
  createdAt: string;
};

export async function listCloudinaryAssets(): Promise<CloudinaryAsset[]> {
  const response = await fetch('/api/cloudinary-assets');
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || 'Could not load Cloudinary assets');
  }
  return body.assets || [];
}

export async function deleteCloudinaryAssets(assets: Array<Pick<CloudinaryAsset, 'publicId' | 'resourceType'>>) {
  const response = await fetch('/api/cloudinary-delete-assets', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ assets }),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || 'Could not delete Cloudinary assets');
  }
  return body as { requested: number; deleted: Record<string, string> };
}
