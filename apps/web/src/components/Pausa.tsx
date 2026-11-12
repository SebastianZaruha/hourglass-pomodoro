interface Props {
  readonly pista: string | null;
}

/** Fuera del escenario desenfocado, para que el rótulo se lea. */
export function Pausa({ pista }: Props) {
  return (
    <div className="pausa">
      <span className="pausa-palabra">En pausa</span>
      {pista ? <span className="pausa-pista">{pista}</span> : null}
    </div>
  );
}
