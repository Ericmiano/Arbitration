import { FormEvent, useEffect, useState } from 'react';
import { listAuditLogs } from '../api/auditLogs';
import { downloadCsv } from '../lib/csv';
import { AuditLogEntry } from '../types';

export function AuditLogs() {
  const [logs, setLogs] = useState<AuditLogEntry[] | null>(null);
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  function reload(filters: { action?: string; entityType?: string } = {}) {
    listAuditLogs(filters).then(setLogs);
  }

  useEffect(() => reload(), []);

  function handleFilter(event: FormEvent) {
    event.preventDefault();
    reload({ action: action || undefined, entityType: entityType || undefined });
  }

  function handleExport() {
    if (!logs) return;
    downloadCsv(
      `aak-audit-log-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { header: 'Timestamp', value: (l: AuditLogEntry) => l.createdAt },
        { header: 'Action', value: (l: AuditLogEntry) => l.action },
        { header: 'Entity type', value: (l: AuditLogEntry) => l.entityType },
        { header: 'Entity ID', value: (l: AuditLogEntry) => l.entityId },
        { header: 'User', value: (l: AuditLogEntry) => l.userEmail ?? 'system' },
        { header: 'IP address', value: (l: AuditLogEntry) => l.ipAddress ?? '' },
        { header: 'Metadata', value: (l: AuditLogEntry) => (l.metadata ? JSON.stringify(l.metadata) : '') },
      ],
      logs,
    );
  }

  if (!logs) return <p>Loading...</p>;

  return (
    <div className="bg-sheet border border-ink">
      <div className="px-24 pt-22 pb-18 border-b border-ink flex flex-wrap gap-x-16 gap-y-10 items-end">
        <div className="flex-1 min-w-[200px]">
          <h1 className="m-0 text-27 font-semibold tracking-[-0.025em]">Audit log</h1>
          <div className="mt-8 font-mono text-10.5 tracking-[0.1em] text-muted uppercase">
            {logs.length} event{logs.length === 1 ? '' : 's'} · most recent 500
          </div>
        </div>
        <button type="button" onClick={handleExport} className="min-h-[31px] px-12 border border-ink bg-transparent text-12.5 cursor-pointer hover:bg-band">
          Export CSV
        </button>
      </div>

      <form onSubmit={handleFilter} className="px-24 py-14 border-b border-rule bg-band-alt flex flex-wrap gap-8 items-center">
        <input
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="Filter by action (e.g. login)"
          className="flex-[1_1_220px] border-0 border-b border-rule bg-transparent py-4 text-13 outline-none"
        />
        <input
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          placeholder="Entity type (e.g. case, assignment)"
          className="flex-[1_1_220px] border-0 border-b border-rule bg-transparent py-4 text-13 outline-none"
        />
        <button type="submit" className="min-h-[31px] px-14 border border-ink bg-transparent text-12.5 cursor-pointer hover:bg-band">
          Filter
        </button>
      </form>

      {logs.length === 0 ? (
        <p className="px-24 py-20 text-13 text-muted">No matching events.</p>
      ) : (
        logs.map((log) => {
          const isExpanded = expanded === log.id;
          return (
            <div key={log.id} className="border-b border-hairline">
              <button
                type="button"
                onClick={() => setExpanded(isExpanded ? null : log.id)}
                className="w-full text-left px-24 py-12 bg-transparent border-0 cursor-pointer flex flex-wrap gap-x-16 gap-y-4 items-baseline hover:bg-band"
              >
                <span className="flex-[0_0_150px] font-mono text-10.5 text-muted">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
                <span className="flex-[0_0_200px] min-w-0 text-13 font-medium">{log.action.replace(/_/g, ' ')}</span>
                <span className="flex-[0_0_150px] font-mono text-10.5 tracking-[0.04em] text-muted-2 uppercase">
                  {log.entityType} #{log.entityId}
                </span>
                <span className="flex-1 min-w-0 text-12.5 text-ink-2">{log.userEmail ?? 'system'}</span>
                <span className="font-mono text-10.5 text-muted-2">{log.ipAddress ?? '—'}</span>
              </button>
              {isExpanded && (
                <div className="px-24 pb-14 -mt-4">
                  <pre className="m-0 p-10 bg-band border border-rule text-11.5 whitespace-pre-wrap break-words">
                    {log.metadata ? JSON.stringify(log.metadata, null, 2) : 'No additional metadata.'}
                  </pre>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
