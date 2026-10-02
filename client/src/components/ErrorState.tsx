export function ErrorState({ onRetry, message }: { onRetry: () => void; message?: string }) {
  return (
    <div className="px-24 py-30 flex flex-col items-center gap-10 text-center">
      <p className="text-13 text-ink-2">{message ?? "Couldn't load this - check your connection and try again."}</p>
      <button
        type="button"
        onClick={onRetry}
        className="min-h-[31px] px-14 border border-ink bg-transparent text-12.5 cursor-pointer hover:bg-band"
      >
        Retry
      </button>
    </div>
  );
}
