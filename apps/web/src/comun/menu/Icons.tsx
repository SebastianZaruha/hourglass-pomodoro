interface IconProps {
  readonly size?: number;
}

export function SunIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MoonIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M16 4.6A7.4 7.4 0 1 0 19.4 15 5.8 5.8 0 0 1 16 4.6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Claro y oscuro a la vez: el tema sigue al sistema. */
export function AutoThemeIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="7.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 4.8v14.4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function GlobeIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <ellipse cx="12" cy="12" rx="3.4" ry="8" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M4.2 12h15.6M6 8h12M6 16h12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function JarIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M8.5 4.8h7M9.2 4.8v2c0 1.1-.6 1.9-1.4 2.4-.8.5-1.4 1.4-1.4 2.5v4.1c0 1.5 1.1 2.5 2.6 2.5h6c1.5 0 2.6-1 2.6-2.5v-4.1c0-1.1-.6-2-1.4-2.5-.8-.5-1.4-1.3-1.4-2.4v-2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8.4 15.6h7.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function HandIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M8 11.2V6.7a1.3 1.3 0 0 1 2.6 0V11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M10.6 10.5V5.9a1.3 1.3 0 0 1 2.6 0V11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M13.2 11.1V7.5a1.3 1.3 0 0 1 2.6 0V13.8c0 2.6-1.3 4.4-3.6 4.4h-1.4c-1.9 0-3.1-1-3.6-2.1L5.5 13a1.2 1.2 0 0 1 2.1-1.1L8 13.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SpeakerIcon({ size = 18, off = false }: IconProps & { readonly off?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4.5 9.5h3.2L12 5.8v12.4l-4.3-3.7H4.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {off ? (
        <path
          d="M15.5 10l4 4M19.5 10l-4 4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M15.2 9.2a4.2 4.2 0 0 1 0 5.6M17.6 7a7 7 0 0 1 0 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
