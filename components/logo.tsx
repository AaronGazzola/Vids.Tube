export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <polygon points="30,43 3,5 21,5" fill="#FF0000" opacity="0.4" />
      <polygon points="18,43 45,5 27,5" fill="#00FFFF" opacity="0.4" />
      <text
        x="24"
        y="28.5"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="700"
        fontSize="34"
        textAnchor="middle"
        fill="#000000"
      >
        T
      </text>
    </svg>
  );
}
