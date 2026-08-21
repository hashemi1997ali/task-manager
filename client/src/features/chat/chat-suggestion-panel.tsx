export function ChatSuggestionPanel({
  suggestions,
  onSelect,
}: {
  suggestions: readonly string[];
  onSelect: (suggestion: string) => void;
}) {
  if (suggestions.length === 0) return null;

  return (
    <div className="chat-message-stream absolute inset-0 z-30 flex flex-col overflow-hidden">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onSelect(suggestion)}
            className="focus-ring block min-h-11 w-full whitespace-pre-wrap rounded-[1.25rem] border bg-[var(--surface)] p-4 text-left text-sm leading-6 shadow-[0_8px_24px_rgb(34_28_76_/_0.05)] transition-colors hover:border-[var(--primary)]"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
