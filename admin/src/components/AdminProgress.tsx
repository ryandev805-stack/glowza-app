import { Loader2 } from 'lucide-react';

export type ProgressState = {
  label: string;
  detail?: string;
  current?: number;
  total?: number;
  percent?: number;
  indeterminate?: boolean;
};

export function AdminProgress({ progress }: { progress: ProgressState | null }) {
  if (!progress) return null;
  const hasCount = typeof progress.current === 'number' && typeof progress.total === 'number' && progress.total > 0;
  const percent = Math.max(
    0,
    Math.min(100, Math.round(progress.percent ?? (hasCount ? (progress.current! / progress.total!) * 100 : 0))),
  );

  return (
    <div className={`admin-progress ${progress.indeterminate ? 'indeterminate' : ''}`} role="status" aria-live="polite">
      <div className="admin-progress-head">
        <div>
          <strong><Loader2 size={15} /> {progress.label}</strong>
          {progress.detail && <span>{progress.detail}</span>}
        </div>
        <b>{progress.indeterminate ? 'Working' : `${percent}%`}</b>
      </div>
      <div className="admin-progress-track">
        <i style={{ width: progress.indeterminate ? '42%' : `${percent}%` }} />
      </div>
      {hasCount && <p>{progress.current} of {progress.total} completed</p>}
    </div>
  );
}
