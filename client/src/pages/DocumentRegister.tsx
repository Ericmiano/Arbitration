import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { documentDownloadUrl, listAllDocuments } from '../api/documents';
import { downloadCsv } from '../lib/csv';
import { DocumentSummary } from '../types';

export function DocumentRegister() {
  const [documents, setDocuments] = useState<DocumentSummary[] | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    listAllDocuments().then(setDocuments);
  }, []);

  const filtered = useMemo(() => {
    if (!documents) return null;
    const q = query.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter((d) =>
      [d.fileName, d.documentType, d.caseNumber].filter(Boolean).some((field) => String(field).toLowerCase().includes(q)),
    );
  }, [documents, query]);

  function handleExport() {
    if (!filtered) return;
    downloadCsv(
      `aak-documents-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { header: 'File name', value: (d: DocumentSummary) => d.fileName },
        { header: 'Type', value: (d: DocumentSummary) => d.documentType },
        { header: 'Visibility', value: (d: DocumentSummary) => d.visibility },
        { header: 'Case number', value: (d: DocumentSummary) => d.caseNumber ?? '' },
        { header: 'Scan status', value: (d: DocumentSummary) => d.scanStatus },
        { header: 'Uploaded at', value: (d: DocumentSummary) => d.createdAt },
      ],
      filtered,
    );
  }

  if (!documents) return <p>Loading...</p>;

  return (
    <div className="bg-sheet border border-ink">
      <div className="px-24 pt-22 pb-18 border-b border-ink flex flex-wrap gap-x-16 gap-y-14 items-end">
        <div className="flex-1 min-w-[240px]">
          <h1 className="m-0 text-27 font-semibold tracking-[-0.025em]">Documents</h1>
          <div className="mt-8 font-mono text-10.5 tracking-[0.1em] text-muted uppercase">
            {documents.length} document{documents.length === 1 ? '' : 's'} across the register
          </div>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search file name, type, case number"
          className="w-[240px] border-0 border-b border-rule bg-transparent py-4 text-13 outline-none"
        />
        <button type="button" onClick={handleExport} className="min-h-[31px] px-12 border border-ink bg-transparent text-12.5 cursor-pointer hover:bg-band">
          Export CSV
        </button>
      </div>

      {filtered && filtered.length === 0 ? (
        <p className="px-24 py-20 text-13">{query ? 'No documents match this search.' : 'No documents visible to you yet.'}</p>
      ) : (
        filtered?.map((d) => (
          <div key={d.publicId} className="px-24 py-14 border-b border-hairline flex flex-wrap gap-x-16 gap-y-6 items-baseline">
            <span className="flex-[1_1_240px] min-w-0 text-13.5 font-medium">{d.fileName}</span>
            <span className="flex-[0_0_104px] font-mono text-10 tracking-[0.09em] text-muted">
              {d.documentType.replace(/_/g, ' ').toUpperCase()}
            </span>
            <span className="flex-[0_0_132px] font-mono text-10 tracking-[0.09em] text-muted-2">
              {d.visibility.replace(/_/g, ' ').toUpperCase()}
            </span>
            {d.caseId && (
              <Link to={`/cases/${d.caseId}`} className="font-mono text-10.5 tracking-[0.04em]">
                {d.caseNumber}
              </Link>
            )}
            <span className="basis-full text-12 text-muted">
              {new Date(d.createdAt).toLocaleString()} · <a href={documentDownloadUrl(d.publicId)}>Download</a>
            </span>
          </div>
        ))
      )}
    </div>
  );
}
