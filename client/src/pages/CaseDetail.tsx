import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { listEligibleArbitrators } from '../api/arbitrators';
import {
  completeAssignment,
  createAssignment,
  decideExtension,
  requestExtension,
  withdrawAssignment,
} from '../api/assignments';
import { confirmAgreement, getCase } from '../api/cases';
import { documentDownloadUrl, listDocuments, uploadDocument } from '../api/documents';
import { useAuth } from '../context/AuthContext';
import { Arbitrator, Case, DocumentSummary } from '../types';

export function CaseDetail() {
  const { caseId } = useParams();
  const { user } = useAuth();
  const isStaff = user?.role === 'admin' || user?.role === 'registrar' || user?.role === 'staff';

  const [caseRecord, setCaseRecord] = useState<Case | null>(null);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [eligible, setEligible] = useState<Arbitrator[]>([]);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    if (!caseId) return;
    getCase(caseId).then(setCaseRecord);
    listDocuments(caseId).then(setDocuments);
  }

  useEffect(reload, [caseId]);

  useEffect(() => {
    if (isStaff && caseRecord?.status === 'pending_assignment' && caseId) {
      listEligibleArbitrators(caseId).then(setEligible);
    }
  }, [isStaff, caseRecord?.status, caseId]);

  if (!caseRecord) return <p>Loading...</p>;

  const activeAssignment = caseRecord.assignments[0];
  const isOwningArbitrator = user?.role === 'arbitrator'; // server re-validates ownership on every action

  async function withAsyncAction(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      reload();
    } catch (err) {
      const message = (err as { response?: { data?: { error?: unknown } } }).response?.data?.error;
      setError(typeof message === 'string' ? message : JSON.stringify(message ?? 'Action failed'));
    }
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!caseId) return;
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem('file') as HTMLInputElement;
    const typeInput = form.elements.namedItem('documentType') as HTMLSelectElement;
    const file = fileInput.files?.[0];
    if (!file) return;

    await withAsyncAction(async () => {
      await uploadDocument(caseId, typeInput.value, file);
      form.reset();
    });
  }

  async function handleConfirmAgreement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!caseId) return;
    const form = new FormData(event.currentTarget);
    const publicId = String(form.get('documentPublicId'));
    await withAsyncAction(() => confirmAgreement(caseId, publicId));
  }

  async function handleAssign(arbitratorId: string) {
    if (!caseId) return;
    await withAsyncAction(() => createAssignment(caseId, arbitratorId));
  }

  async function handleRequestExtension(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeAssignment) return;
    const form = new FormData(event.currentTarget);
    await withAsyncAction(() =>
      requestExtension(activeAssignment.id, String(form.get('reason')), String(form.get('requestedDueDate'))),
    );
  }

  async function handleComplete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeAssignment) return;
    const form = new FormData(event.currentTarget);
    await withAsyncAction(() =>
      completeAssignment(activeAssignment.id, {
        outcome: form.get('outcome') as 'award_issued' | 'settled' | 'withdrawn',
        outcomeDetail: String(form.get('outcomeDetail') || ''),
        awardChallenged: false,
      }),
    );
  }

  async function handleWithdraw() {
    if (!activeAssignment) return;
    const reason = window.prompt('Reason for withdrawing this arbitrator?');
    if (!reason) return;
    await withAsyncAction(() => withdrawAssignment(activeAssignment.id, reason));
  }

  const canActOnAssignment =
    activeAssignment && (isStaff || isOwningArbitrator) && ['ongoing', 'overdue', 'escalated'].includes(activeAssignment.status);

  return (
    <div>
      <h1>{caseRecord.case_number}</h1>
      <p>
        Status: <strong>{caseRecord.status}</strong> &middot; SLA tier: {caseRecord.sla_tier} &middot; Due:{' '}
        {caseRecord.due_date ? new Date(caseRecord.due_date).toLocaleDateString() : '-'}
      </p>
      <p>
        {caseRecord.currency} {caseRecord.dispute_value} - {caseRecord.category}
      </p>
      <p>{caseRecord.description}</p>

      {error && (
        <p role="alert" style={{ color: 'crimson' }}>
          {error}
        </p>
      )}

      <section>
        <h2>Parties</h2>
        <ul>
          {caseRecord.case_parties.map((cp) => (
            <li key={cp.party_id}>
              {cp.parties.full_name} ({cp.role})
            </li>
          ))}
        </ul>
      </section>

      {caseRecord.basis === 'mutual_agreement' && caseRecord.status === 'pending_agreement' && isStaff && (
        <section>
          <h2>Confirm submission agreement</h2>
          <p>Upload the signed submission agreement below first, then confirm it here using its document ID.</p>
          <form onSubmit={handleConfirmAgreement}>
            <input name="documentPublicId" placeholder="Document public ID" required style={{ width: 320 }} />
            <button type="submit">Confirm agreement</button>
          </form>
        </section>
      )}

      <section>
        <h2>Assignment</h2>
        {activeAssignment ? (
          <div>
            <p>
              Arbitrator: {activeAssignment.arbitrators.full_name} &middot; Status: {activeAssignment.status}{' '}
              &middot; Due: {new Date(activeAssignment.due_date).toLocaleDateString()}
            </p>

            {canActOnAssignment && (
              <>
                <form onSubmit={handleRequestExtension} style={{ marginTop: '0.5rem' }}>
                  <h3>Request extension</h3>
                  <input name="reason" placeholder="Reason" required style={{ width: 250 }} />
                  <input name="requestedDueDate" type="date" required />
                  <button type="submit">Request</button>
                </form>

                <form onSubmit={handleComplete} style={{ marginTop: '0.5rem' }}>
                  <h3>Complete case</h3>
                  <select name="outcome" required defaultValue="award_issued">
                    <option value="award_issued">Award issued</option>
                    <option value="settled">Settled</option>
                    <option value="withdrawn">Withdrawn</option>
                  </select>
                  <br />
                  <textarea name="outcomeDetail" placeholder="Outcome details" rows={3} style={{ width: '100%' }} />
                  <button type="submit">Mark completed</button>
                </form>
              </>
            )}

            {isStaff && canActOnAssignment && (
              <button type="button" onClick={handleWithdraw} style={{ marginTop: '0.5rem' }}>
                Withdraw arbitrator
              </button>
            )}
          </div>
        ) : (
          <p>No arbitrator assigned yet.</p>
        )}

        {isStaff && caseRecord.status === 'pending_assignment' && (
          <div style={{ marginTop: '1rem' }}>
            <h3>Eligible arbitrators</h3>
            {eligible.length === 0 ? (
              <p>No conflict-free active arbitrators available.</p>
            ) : (
              <table style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={cellStyle}>Name</th>
                    <th style={cellStyle}>Score</th>
                    <th style={cellStyle}>Cases closed</th>
                    <th style={cellStyle}>Flags</th>
                    <th style={cellStyle}></th>
                  </tr>
                </thead>
                <tbody>
                  {eligible.map((a) => (
                    <tr key={a.id}>
                      <td style={cellStyle}>{a.full_name}</td>
                      <td style={cellStyle}>{a.score}</td>
                      <td style={cellStyle}>{a.cases_closed_count}</td>
                      <td style={cellStyle}>
                        {a.priorEngagementFlags && a.priorEngagementFlags.length > 0
                          ? `Prior engagement: ${a.priorEngagementFlags.map((f) => f.caseNumber).join(', ')}`
                          : ''}
                      </td>
                      <td style={cellStyle}>
                        <button type="button" onClick={() => handleAssign(a.id)}>
                          Assign
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </section>

      <section>
        <h2>Documents</h2>
        <form onSubmit={handleUpload}>
          <select name="documentType" defaultValue="evidence">
            <option value="contract_copy">Contract copy</option>
            <option value="evidence">Evidence</option>
            <option value="submission_agreement">Submission agreement</option>
            <option value="correspondence">Correspondence</option>
            <option value="award">Award</option>
            <option value="id_kyc">ID / KYC</option>
            <option value="other">Other</option>
          </select>
          <input name="file" type="file" required />
          <button type="submit">Upload</button>
        </form>

        <table style={{ marginTop: '0.5rem', borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={cellStyle}>File</th>
              <th style={cellStyle}>Type</th>
              <th style={cellStyle}>Visibility</th>
              <th style={cellStyle}>Uploaded</th>
              <th style={cellStyle}></th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.publicId}>
                <td style={cellStyle}>{doc.fileName}</td>
                <td style={cellStyle}>{doc.documentType}</td>
                <td style={cellStyle}>{doc.visibility}</td>
                <td style={cellStyle}>{new Date(doc.createdAt).toLocaleString()}</td>
                <td style={cellStyle}>
                  <a href={documentDownloadUrl(doc.publicId)}>Download</a>
                  {doc.documentType === 'submission_agreement' && (
                    <span style={{ marginLeft: '0.5rem', color: '#666' }}>ID: {doc.publicId}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

const cellStyle = { border: '1px solid #ccc', padding: '0.4rem', textAlign: 'left' as const };
