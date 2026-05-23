export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <polygon points="24,43 3,5 17,5" fill="currentColor" opacity="0.8" />
      <polygon points="24,43 45,5 31,5" fill="currentColor" opacity="0.8" />
      <rect x="17" y="5" width="14" height="4.5" rx="1" fill="currentColor" />
      <rect
        x="21.75"
        y="5"
        width="4.5"
        height="24"
        rx="1"
        fill="currentColor"
      />
    </svg>
  );
}
