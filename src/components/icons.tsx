import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base: IconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true
};

export const icons = {
  dashboard: (p: IconProps) => (
    <svg {...base} {...p}>
      <rect x="3" y="3" width="7" height="8" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="11" width="7" height="10" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  compare: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M12 3v18" />
      <path d="M6 8 3 13h6L6 8Z" />
      <path d="M18 6l-3 5h6l-3-5Z" />
      <path d="M3 13a3 3 0 0 0 6 0" />
      <path d="M15 11a3 3 0 0 0 6 0" />
      <path d="M7 21h10" />
    </svg>
  ),
  opportunity: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M3 17l6-6 4 4 7-7" />
      <path d="M14 8h6v6" />
    </svg>
  ),
  product: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M3 7.5 12 3l9 4.5v9L12 21 3 16.5v-9Z" />
      <path d="M3 7.5 12 12l9-4.5" />
      <path d="M12 12v9" />
    </svg>
  ),
  purchase: (p: IconProps) => (
    <svg {...base} {...p}>
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
      <path d="M2 3h2.2l2.1 12.2a1.5 1.5 0 0 0 1.5 1.3h9.1a1.5 1.5 0 0 0 1.5-1.2L21 7H6" />
    </svg>
  ),
  inventory: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M3 8.5 12 4l9 4.5v7L12 20l-9-4.5v-7Z" />
      <path d="M3 8.5 12 13l9-4.5" />
      <path d="M7.5 6.2v4.5L12 13" />
    </svg>
  ),
  order: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M6 2h9l4 4v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" />
      <path d="M14 2v5h5" />
      <path d="M8.5 13h7" />
      <path d="M8.5 17h5" />
    </svg>
  ),
  accounting: (p: IconProps) => (
    <svg {...base} {...p}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 7h8" />
      <path d="M8 11h3M13 11h3" />
      <path d="M8 15h3M13 15h3" />
      <path d="M8 18.5h3" />
    </svg>
  ),
  jobs: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 4v4h-4" />
    </svg>
  ),
  api: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
      <path d="M7 7h10a1 1 0 0 1 1 1v3a6 6 0 0 1-12 0V8a1 1 0 0 1 1-1Z" />
      <path d="M12 17v4" />
      <path d="M9 21h6" />
    </svg>
  ),
  billing: (p: IconProps) => (
    <svg {...base} {...p}>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 9.5h19" />
      <path d="M6 14.5h4" />
    </svg>
  ),
  audit: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M12 3 5 6v5c0 4.4 3 8.3 7 9.5 4-1.2 7-5.1 7-9.5V6l-7-3Z" />
      <path d="m9.2 11.8 1.9 1.9 3.7-3.9" />
    </svg>
  ),
  // Accent / status icons
  yen: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M7 4l5 7 5-7" />
      <path d="M12 11v9" />
      <path d="M8 14h8" />
      <path d="M8 17.5h8" />
    </svg>
  ),
  spark: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
      <path d="M19 16l.7 2 .8.7-.8.8-.7 2-.7-2-.8-.8.8-.7.7-2Z" />
    </svg>
  ),
  warning: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M10.3 3.8 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  ),
  info: (p: IconProps) => (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </svg>
  ),
  search: (p: IconProps) => (
    <svg {...base} {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  ),
  box: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M3 8.5 12 4l9 4.5v7L12 20l-9-4.5v-7Z" />
      <path d="M3 8.5 12 13l9-4.5M12 13v7" />
    </svg>
  )
} as const;

export type IconName = keyof typeof icons;

export function Icon({ name, ...props }: { name: IconName } & IconProps) {
  const Cmp = icons[name];
  return <Cmp {...props} />;
}
