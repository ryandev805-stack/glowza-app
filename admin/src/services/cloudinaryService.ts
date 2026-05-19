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
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
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
  const response = await fetch('/api/cloudinary-upload-url', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ imageUrl }),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || 'Cloudinary URL import failed');
  }
  return body.secureUrl as string;
}
