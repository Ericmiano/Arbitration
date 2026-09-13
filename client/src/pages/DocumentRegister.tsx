import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { documentDownloadUrl, listAllDocuments } from '../api/documents';
import { DocumentSummary } from '../types';

export function DocumentRegister() {
  const [documents, setDocuments] = useState<DocumentSummary[] | null>(null);

  useEffect(() => {
    listAllDocuments().then(setDocuments);
  }, []);

  if (!documents) return <p>Loading...</p>;

  return (
    <div className="bg-sheet border border-ink">
      <div className="px-24 pt-22 pb-18 border-b border-ink">
        <h1 className="m-0 text-27 font-semibold tracking-[-0.025em]">Documents</h1>
        <div className="mt-8 font-mono text-10.5 tracking-[0.1em] text-muted uppercase">
          {documents.length} document{documents.length === 1 ? '' : 's'} across the register
        </div>
      </div>

      {documents.length === 0 ? (
        <p className="px-24 py-20 text-13">No documents visible to you yet.</p>
      ) : (
        documents.map((d) => (
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
