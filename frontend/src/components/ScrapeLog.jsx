import { useState } from 'react';
import { format } from 'date-fns';
import { LogsIcon } from './Icons';
import './ScrapeLog.css';

const STATUS_META = {
  success: { label: 'Success', cls: 'badge-green' },
  retried: { label: 'Retried', cls: 'badge-yellow' },
  failed:  { label: 'Failed',  cls: 'badge-red'    },
};

export default function ScrapeLog({ logs }) {
  const [filter, setFilter] = useState('all'); // 'all' | 'success' | 'retried' | 'failed'

  if (!logs?.length) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <LogsIcon size={32} />
        </div>
        <h3>No scrape logs yet</h3>
        <p className="text-muted">Logs appear after the first live scrape attempt.</p>
      </div>
    );
  }

  const filteredLogs = logs.filter((log) => {
    if (filter === 'all') return true;
    return log.status === filter;
  });

  return (
    <div className="scrape-log-wrapper fade-in">
      <div className="scrape-log-header flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`range-chip ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All Logs ({logs.length})
          </button>
          <button
            type="button"
            className={`range-chip ${filter === 'success' ? 'active' : ''}`}
            onClick={() => setFilter('success')}
          >
            Success ({logs.filter((l) => l.status === 'success').length})
          </button>
          <button
            type="button"
            className={`range-chip ${filter === 'retried' ? 'active' : ''}`}
            onClick={() => setFilter('retried')}
          >
            Retried ({logs.filter((l) => l.status === 'retried').length})
          </button>
          <button
            type="button"
            className={`range-chip ${filter === 'failed' ? 'active' : ''}`}
            onClick={() => setFilter('failed')}
          >
            Failed ({logs.filter((l) => l.status === 'failed').length})
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Run ID</th>
              <th>#</th>
              <th>Status</th>
              <th>Duration</th>
              <th>HTTP</th>
              <th>Signature</th>
              <th>Error</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map((log) => {
              const meta = STATUS_META[log.status] ?? { label: log.status, cls: 'badge-muted' };
              return (
                <tr key={log.id} className={`log-row log-row-${log.status}`}>
                  <td>
                    <span className="mono text-xs text-muted" title={log.run_id}>
                      {log.run_id?.slice(0, 8)}…
                    </span>
                  </td>
                  <td className="text-center">{log.attempt_number}</td>
                  <td>
                    <span className={`badge ${meta.cls}`}>{meta.label}</span>
                  </td>
                  <td className="mono">
                    {log.duration_ms != null ? `${log.duration_ms.toLocaleString()} ms` : '—'}
                  </td>
                  <td>
                    {log.http_status != null ? (
                      <span className={`badge ${log.http_status < 400 ? 'badge-green' : 'badge-red'} badge-sm`}>
                        {log.http_status}
                      </span>
                    ) : '—'}
                  </td>
                  <td>
                    {log.structure_signature ? (
                      <span
                        className="badge badge-muted mono"
                        style={{ fontSize: '0.72rem', letterSpacing: '0.02em' }}
                        title={`DOM Structure Signature: ${log.structure_signature}`}
                      >
                        #{log.structure_signature.slice(0, 7)}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="log-error">
                    {log.error_message
                      ? <span className="error-text" title={log.error_message}>{log.error_message}</span>
                      : <span className="text-muted">—</span>}
                  </td>
                  <td className="text-xs text-muted mono">
                    {log.created_at
                      ? format(new Date(log.created_at), 'dd MMM, HH:mm:ss')
                      : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
