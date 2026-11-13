interface Props {
  readonly word: string;
  readonly hint: string | null;
}

/** La pausa publicada: la palabra y la pista, sin tocar el frasco. */
export function Pausa({ word, hint }: Props) {
  return (
    <div className="pause-screen">
      <span className="pause-word">{word}</span>
      {hint ? <span className="pause-hint">{hint}</span> : null}
    </div>
  );
}
