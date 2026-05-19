import { useEffect, useState } from 'react';
import { importImageUrlToCloudinary, uploadToCloudinary } from '../services/cloudinaryService';

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

export function ImageField({ label, value, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [draftUrl, setDraftUrl] = useState(value);
  const [error, setError] = useState('');

  useEffect(() => {
    setDraftUrl(value);
  }, [value]);

  async function upload(file?: File) {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      onChange(await uploadToCloudinary(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function importUrl() {
    if (!draftUrl.trim()) return;
    setImporting(true);
    setError('');
    try {
      const cloudinaryUrl = await importImageUrlToCloudinary(draftUrl.trim());
      onChange(cloudinaryUrl);
      setDraftUrl(cloudinaryUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'URL import failed');
    } finally {
      setImporting(false);
    }
  }

  return (
    <label>
      {label}
      <div className="media-input">
        <input
          value={draftUrl}
          onChange={(event) => {
            setDraftUrl(event.target.value);
            if (event.target.value.includes('res.cloudinary.com')) {
              onChange(event.target.value);
            }
          }}
          placeholder="Paste image URL, then import"
        />
        <button type="button" className="ghost" disabled={importing || !draftUrl.trim()} onClick={importUrl}>
          {importing ? 'Importing...' : 'Import URL'}
        </button>
      </div>
      <input type="file" accept="image/*" onChange={(event) => void upload(event.target.files?.[0])} />
      {uploading && <small>Uploading to Cloudinary...</small>}
      {error && <small className="error">{error}</small>}
    </label>
  );
}
