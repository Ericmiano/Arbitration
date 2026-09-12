import { useNavigate } from 'react-router-dom';

export function StubScreen({ title, body }: { title: string; body: string }) {
  const navigate = useNavigate();
  return (
    <div className="bg-sheet border border-ink px-24 py-34 max-w-[640px]">
      <div className="font-mono text-9.5 tracking-[0.12em] text-muted">NOT IN THIS PASS</div>
      <h1 className="mt-10 mb-0 text-20 font-semibold tracking-[-0.02em]">{title}</h1>
      <p className="mt-10 text-13.5 leading-[1.6] text-ink-2">{body}</p>
      <button
        type="button"
        onClick={() => navigate('/dashboard')}
        className="mt-16 bg-transparent border-0 border-b border-ink py-2 text-12.5 cursor-pointer hover:text-red hover:border-red"
      >
        Back to the docket
      </button>
    </div>
  );
}
