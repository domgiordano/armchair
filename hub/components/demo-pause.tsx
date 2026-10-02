interface DemoPauseProps {
  paused: boolean;
  onToggle: () => void;
  className?: string;
}

/** Play/pause for a looping illustration. Not rendered under reduced motion, which never loops. */
export function DemoPause({ paused, onToggle, className = "" }: DemoPauseProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={paused ? "Play the demo" : "Pause the demo"}
      className={`flex size-11 items-center justify-center rounded-full text-current/70 transition-colors hover:bg-text/10 hover:text-current focus-visible:outline-2 focus-visible:outline-gold active:scale-95 motion-reduce:transition-none ${className}`}
    >
      <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true" fill="currentColor">
        {paused ? <path d="M5 3.5v9l7-4.5z" /> : <path d="M4.5 3h2.5v10H4.5zM9 3h2.5v10H9z" />}
      </svg>
    </button>
  );
}
