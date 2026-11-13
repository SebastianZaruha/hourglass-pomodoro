import './pausa.css';

interface Props {
  readonly palabra: string;
  readonly pista: string | null;
}

/** Fuera del escenario desenfocado, para que el rótulo se lea. */
export function Pausa({ palabra, pista }: Props) {
  return (
    <div className="pausa">
      <span className="pausa-palabra">{palabra}</span>
      {pista ? <span className="pausa-pista">{pista}</span> : null}
    </div>
  );
}
