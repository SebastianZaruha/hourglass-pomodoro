export type IconoGestoId = 'clic' | 'doble' | 'rueda' | 'arrastra' | 'toca' | 'desliza' | 'dobleToque';

const trazo = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** Mismo trazo que los circulitos del menú: 24, sin relleno, grosor 1.6. */
export function IconoGesto({ id }: { readonly id: IconoGestoId }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      {id === 'clic' ? <Clic /> : null}
      {id === 'doble' ? <Doble /> : null}
      {id === 'rueda' ? <Rueda /> : null}
      {id === 'arrastra' ? <Arrastra /> : null}
      {id === 'toca' ? <Toca /> : null}
      {id === 'desliza' ? <Desliza /> : null}
      {id === 'dobleToque' ? <DobleToque /> : null}
    </svg>
  );
}

function Clic() {
  return <path d="M7.2 4.2 17 13.4h-4.4l2.8 6.2-2.6 1.1-2.9-6.3-2.2 2.1Z" {...trazo} />;
}

function Doble() {
  return (
    <>
      <path d="M5.6 5.4 14.2 13.6h-3.8l2.4 5.2-2.3 1-2.5-5.3-1.9 1.8Z" {...trazo} />
      <circle cx="17.6" cy="7.4" r="1.05" {...trazo} />
      <circle cx="17.6" cy="11" r="1.05" {...trazo} />
    </>
  );
}

function Rueda() {
  return (
    <>
      <rect x="7.8" y="3.2" width="8.4" height="17.6" rx="4.2" {...trazo} />
      <path d="M12 7.2v3" {...trazo} />
    </>
  );
}

function Arrastra() {
  return (
    <>
      <path d="M6.2 15.2a6.2 6.2 0 0 1 10.6-4.4" {...trazo} />
      <path d="M14.4 8.2 17.6 11l-3.6 1.2" {...trazo} />
      <path d="M7.4 18.4h6.2" {...trazo} />
    </>
  );
}

function Toca() {
  return (
    <>
      <circle cx="12" cy="9.2" r="2.3" {...trazo} />
      <path d="M7.6 16.2a5.4 5.4 0 0 0 8.8 0" {...trazo} />
    </>
  );
}

function Desliza() {
  return (
    <>
      <path d="M12 5.4v13.2" {...trazo} />
      <path d="M8.4 8.6 12 5l3.6 3.6" {...trazo} />
      <path d="M8.4 15.4 12 19l3.6-3.6" {...trazo} />
    </>
  );
}

function DobleToque() {
  return (
    <>
      <circle cx="12" cy="8.2" r="2.1" {...trazo} />
      <path d="M8.2 14.6a4.8 4.8 0 0 0 7.6 0" {...trazo} />
      <path d="M6.4 17.4a7.2 7.2 0 0 0 11.2 0" {...trazo} />
    </>
  );
}
