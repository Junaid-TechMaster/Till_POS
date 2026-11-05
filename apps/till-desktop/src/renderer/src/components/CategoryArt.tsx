export function CategoryArt({ id }: { id: string }) {
  const common = { viewBox: "0 0 64 64", "aria-hidden": true as const };
  switch (id) {
    case "fruit":
      return (
        <svg {...common}>
          <circle cx="24" cy="38" r="14" fill="#e74c3c" />
          <circle cx="42" cy="36" r="13" fill="#f1c40f" />
          <path d="M30 22c6-10 16-8 16-2" fill="none" stroke="#1e8449" strokeWidth="3" />
          <circle cx="46" cy="18" r="4" fill="#27ae60" />
        </svg>
      );
    case "grocery":
      return (
        <svg {...common}>
          <rect x="14" y="26" width="36" height="24" rx="3" fill="#f5cba7" />
          <path d="M18 26c2-10 26-10 28 0" fill="#e67e22" />
          <rect x="28" y="18" width="8" height="8" rx="2" fill="#d35400" />
        </svg>
      );
    case "household":
      return (
        <svg {...common}>
          <rect x="16" y="14" width="22" height="36" rx="4" fill="#5dade2" />
          <rect x="30" y="28" width="18" height="22" rx="3" fill="#f7dc6f" />
          <rect x="20" y="18" width="14" height="6" fill="#1a5276" />
        </svg>
      );
    case "pet":
      return (
        <svg {...common}>
          <circle cx="22" cy="22" r="6" fill="#f5b041" />
          <circle cx="42" cy="22" r="6" fill="#f5b041" />
          <circle cx="16" cy="36" r="6" fill="#f5b041" />
          <circle cx="48" cy="36" r="6" fill="#f5b041" />
          <ellipse cx="32" cy="40" rx="10" ry="8" fill="#af601a" />
        </svg>
      );
    case "cards":
      return (
        <svg {...common}>
          <rect x="12" y="16" width="28" height="36" rx="3" fill="#f1948a" transform="rotate(-8 26 34)" />
          <rect x="24" y="14" width="28" height="36" rx="3" fill="#58d68d" />
          <path d="M38 28c4 4 4 8 0 10 4-2 8-6 0-10z" fill="#e74c3c" />
        </svg>
      );
    case "drinks":
      return (
        <svg {...common}>
          <rect x="18" y="16" width="12" height="34" rx="3" fill="#5b2c6f" />
          <rect x="34" y="22" width="12" height="28" rx="2" fill="#1abc9c" />
          <rect x="20" y="12" width="8" height="6" fill="#f7dc6f" />
        </svg>
      );
    case "stationery":
      return (
        <svg {...common}>
          <rect x="14" y="18" width="26" height="32" rx="2" fill="#f9e79f" />
          <path d="M18 28h18M18 36h18M18 44h12" stroke="#2471a3" strokeWidth="2" />
          <rect x="36" y="14" width="8" height="36" rx="1" fill="#2e86c1" transform="rotate(12 40 32)" />
        </svg>
      );
    case "lottery":
      return (
        <svg {...common}>
          <circle cx="32" cy="32" r="18" fill="#f4d03f" />
          <circle cx="32" cy="32" r="10" fill="#f7f9f9" />
          <path d="M32 16v6M32 42v6M16 32h6M42 32h6" stroke="#b7950b" strokeWidth="3" />
        </svg>
      );
    case "bills":
      return (
        <svg {...common}>
          <rect x="14" y="16" width="36" height="28" rx="3" fill="#d5f5e3" />
          <path d="M18 40h28v6H18z" fill="#148f77" />
          <path d="M20 24h16M20 30h10" stroke="#0e6655" strokeWidth="2" />
        </svg>
      );
    case "topups":
      return (
        <svg {...common}>
          <rect x="22" y="10" width="20" height="40" rx="3" fill="#00acc1" />
          <rect x="26" y="16" width="12" height="20" fill="#e8f8f9" />
          <circle cx="32" cy="44" r="2" fill="white" />
        </svg>
      );
    case "bakery":
      return (
        <svg {...common}>
          <ellipse cx="32" cy="40" rx="18" ry="10" fill="#e59866" />
          <path d="M16 38c4-16 28-16 32 0" fill="#f5cba7" />
          <path d="M24 30c2 4 6 4 8 0M34 28c2 4 6 4 8 0" stroke="#d35400" strokeWidth="2" fill="none" />
        </svg>
      );
    case "frozen":
      return (
        <svg {...common}>
          <rect x="16" y="18" width="32" height="30" rx="4" fill="#85c1e9" />
          <path d="M32 22v22M22 32h20M24 24l16 16M40 24L24 40" stroke="white" strokeWidth="2" />
        </svg>
      );
    case "snacks":
      return (
        <svg {...common}>
          <path d="M18 26h28l-4 24H22z" fill="#e74c3c" />
          <path d="M22 26c2-8 18-8 20 0" fill="#f5b041" />
          <circle cx="28" cy="38" r="2" fill="#f9e79f" />
          <circle cx="36" cy="42" r="2" fill="#f9e79f" />
        </svg>
      );
    case "news":
      return (
        <svg {...common}>
          <rect x="12" y="14" width="40" height="36" rx="2" fill="#f4f6f7" />
          <rect x="16" y="18" width="18" height="12" fill="#5d6d7e" />
          <path d="M16 34h32M16 40h24M16 46h20" stroke="#2c3e50" strokeWidth="2" />
        </svg>
      );
    case "alcohol":
      return (
        <svg {...common}>
          <path d="M26 12h12v14c0 8-12 8-12 0z" fill="#6c3483" />
          <rect x="30" y="26" width="4" height="16" fill="#d2b4de" />
          <rect x="24" y="42" width="16" height="6" rx="1" fill="#4a235a" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect x="16" y="16" width="32" height="32" rx="8" fill="#1abc9c" />
          <path d="M24 34c4 6 12 6 16 0" stroke="white" strokeWidth="3" fill="none" />
          <circle cx="26" cy="28" r="2" fill="white" />
          <circle cx="38" cy="28" r="2" fill="white" />
        </svg>
      );
  }
}
