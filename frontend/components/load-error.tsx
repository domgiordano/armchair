import { SECONDARY } from "@/lib/ui";

interface LoadErrorProps {
  what: string;
  message: string;
  retry: () => void;
}

export function LoadError({ what, message, retry }: LoadErrorProps) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3">
      <p>
        Could not load {what}: {message}
      </p>
      <button type="button" onClick={retry} className={SECONDARY}>
        Try again
      </button>
    </div>
  );
}
