import { useParams } from 'react-router-dom';

export function CaseDetail() {
  const { caseId } = useParams();
  return <h1>Case {caseId}</h1>;
}
