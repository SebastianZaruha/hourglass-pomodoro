import {
  CYCLE_LIMITS,
  CYCLE_PRESETS,
  DURATION_STEPS_MIN,
  MINUTE_MS,
  activeCycleConfig,
  languageShort,
  languageSpoken,
  nearestStepIndex,
  nextInCycle,
  samePlan,
  sessionPlanFor,
  stepMinutes,
  stepRounds,
  stepToDuration,
  themeSpoken,
  LANGUAGE_CYCLE,
  THEME_CYCLE,
  type CyclePresetId,
  type Language,
  type Messages,
  type Settings,
} from '@reloj/core';
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';

import { HojaDia } from '../dia/HojaDia';
import type { ArenaDia } from '../dia/dia';
import { useHojaVidrio } from '../estilo/vidrio-liquido';
import { HojaGestos } from '../paneles/gestos/HojaGestos';
import { AutoThemeIcon, HandIcon, JarIcon, MoonIcon, SpeakerIcon, SunIcon } from './Icons';

const QUICK_TIMES_MIN = [5, 10, 15, 25, 45, 60] as const;

interface EscenaMenu {
  readonly id: string;
  readonly nombre: { readonly es: string; readonly en: string };
}

interface Props {
  readonly open: boolean;
  readonly settings: Settings;
  readonly t: Messages;
  readonly onChange: (
    patch:
      | Partial<Omit<Settings, 'version' | 'updatedAt'>>
      | ((current: Settings) => Partial<Omit<Settings, 'version' | 'updatedAt'>>),
  ) => void;
  readonly onClose: () => void;
  readonly escenas?: readonly EscenaMenu[];
  readonly escenaId?: string;
  readonly idioma?: Language;
  readonly onEscena?: (id: string) => void;
  readonly arenaDia?: ArenaDia;
  /** Solo si el plan (duración o sesión) cambia. Modo, idioma y sonido no lo llaman. */
  readonly alReiniciar?: () => void;
}

export function SettingsSheet({
  open,
  settings,
  t,
  onChange,
  onClose,
  escenas = [],
  escenaId = '',
  idioma = 'es',
  onEscena = () => undefined,
  arenaDia,
  alReiniciar = () => undefined,
}: Props) {
  const cycles = settings.sessionMode === 'cycles';
  const cycle = activeCycleConfig(settings);
  const lastMin = Math.round(settings.lastDurationMs / MINUTE_MS);
  const onPreset = (QUICK_TIMES_MIN as readonly number[]).includes(lastMin);
  const [singleCustom, setSingleCustom] = useState(() => !onPreset);
  const customOn = singleCustom || !onPreset;
  /** Minutos del control personalizado mientras se arrastra o se mantiene una tecla. Aún no es el plan. */
  const [borrador, setBorrador] = useState<number | null>(null);
  const indiceDuracion = borrador ?? nearestStepIndex(settings.lastDurationMs);
  const hoja = useRef<HTMLDivElement>(null);
  const [desborda, setDesborda] = useState(false);

  useEffect(() => {
    if (!onPreset) setSingleCustom(true);
  }, [onPreset]);

  useEffect(() => {
    if (!open || !customOn) setBorrador(null);
  }, [open, customOn]);

  const cerrarBorrador = (index: number) => {
    setBorrador(null);
    const ms = stepToDuration(index);
    if (ms === settings.lastDurationMs) return;
    aplicar({ sessionMode: 'single', lastDurationMs: ms });
  };

  useEffect(() => {
    const el = hoja.current;
    if (!el) return;
    const medir = () => setDesborda(el.scrollHeight > el.clientHeight + 1);
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    window.addEventListener('resize', medir);
    return () => {
      obs.disconnect();
      window.removeEventListener('resize', medir);
    };
  }, [open, settings, cycles, customOn, escenas.length]);

  const aplicar = (
    patch:
      | Partial<Omit<Settings, 'version' | 'updatedAt'>>
      | ((current: Settings) => Partial<Omit<Settings, 'version' | 'updatedAt'>>),
  ) => {
    const parcial = typeof patch === 'function' ? patch(settings) : patch;
    const siguiente: Settings = { ...settings, ...parcial };
    if (!samePlan(sessionPlanFor(settings), sessionPlanFor(siguiente))) alReiniciar();
    onChange(patch);
  };

  const chooseCustom = () => {
    const seed = settings.cyclePreset === 'custom' ? settings.customCycle : activeCycleConfig(settings);
    aplicar({ sessionMode: 'cycles', cyclePreset: 'custom', customCycle: seed });
  };

  useHojaVidrio(hoja);
  const [gestos, setGestos] = useState(false);
  const [racha, setRacha] = useState(false);
  useEffect(() => {
    if (!open) {
      setGestos(false);
      setRacha(false);
    }
  }, [open]);
  const esMenu = (idioma ?? 'es') === 'es';
  const temaTxt = themeSpoken(t, settings.theme);
  const idiomaTxt = languageSpoken(t, settings.language);
  const sonidoTxt = settings.sound ? t.sound : esMenu ? 'Sonido apagado' : 'Sound off';
  const rachaTxt = esMenu ? 'Racha de hoy' : "Today's streak";

  return (
    <>
    <div
      ref={hoja}
      className={['sheet', 'hoja', 'vidrio', 'vidrio-liquido', open ? 'open' : '', desborda ? 'desborda' : '']
        .filter(Boolean)
        .join(' ')}
      role="dialog"
      aria-modal="true"
      aria-hidden={!open}
      aria-label={t.settings}
      inert={!open}
      onMouseDown={(event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('input, textarea, [contenteditable="true"]')) return;
        if (event.detail > 1) event.preventDefault();
        window.getSelection()?.removeAllRanges();
      }}
    >
      <div className="sheet-head">
        <h2>{t.settings}</h2>
        <button
          type="button"
          className="control redondo sheet-close"
          aria-label={t.closeSettings}
          onClick={onClose}
        >
          ×
        </button>
      </div>

      {escenas.length > 1 ? (
        <div
          className="scene-row"
          role="radiogroup"
          aria-label={t.settings}
          style={{ ['--escenas' as string]: escenas.length }}
        >
          {escenas.map((escena) => (
            <button
              key={escena.id}
              type="button"
              role="radio"
              aria-checked={escena.id === escenaId}
              className="control"
              onClick={() => onEscena(escena.id)}
            >
              {escena.nombre[idioma]}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mode-row" role="radiogroup" aria-label={t.sessionType}>
        <button
          type="button"
          role="radio"
          aria-checked={!cycles}
          className="control"
          onClick={() => aplicar({ sessionMode: 'single' })}
        >
          {t.single}
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={cycles}
          className="control"
          onClick={() => aplicar({ sessionMode: 'cycles' })}
        >
          {t.cycles}
        </button>
      </div>

      {cycles ? (
        <>
          <div className="chip-row" role="radiogroup" aria-label={t.cycle}>
            {CYCLE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                role="radio"
                aria-checked={settings.cyclePreset === preset.id}
                className="control"
                aria-label={t.presetSpoken(preset.config.workMin, preset.config.breakMin)}
                onClick={() => aplicar({ sessionMode: 'cycles', cyclePreset: preset.id })}
              >
                {preset.config.workMin}/{preset.config.breakMin}
              </button>
            ))}
            <button
              type="button"
              role="radio"
              aria-checked={settings.cyclePreset === 'custom'}
              className="control"
              onClick={chooseCustom}
            >
              {t.custom}
            </button>
          </div>
          {settings.cyclePreset === 'custom' ? (
            <div className="stepper-row">
              <Stepper
                label={t.work}
                value={`${cycle.workMin} min`}
                spoken={t.minutes(cycle.workMin)}
                decLabel={t.less}
                incLabel={t.more}
                canDec={cycle.workMin > CYCLE_LIMITS.minMinutes}
                canInc={cycle.workMin < CYCLE_LIMITS.maxMinutes}
                onStep={(d) =>
                  aplicar((current) => {
                    const next = activeCycleConfig(current);
                    return {
                      sessionMode: 'cycles',
                      cyclePreset: 'custom' as CyclePresetId,
                      customCycle: { ...next, workMin: stepMinutes(next.workMin, d) },
                    };
                  })
                }
              />
              <Stepper
                label={t.break}
                value={`${cycle.breakMin} min`}
                spoken={t.minutes(cycle.breakMin)}
                decLabel={t.less}
                incLabel={t.more}
                canDec={cycle.breakMin > CYCLE_LIMITS.minMinutes}
                canInc={cycle.breakMin < CYCLE_LIMITS.maxMinutes}
                onStep={(d) =>
                  aplicar((current) => {
                    const next = activeCycleConfig(current);
                    return {
                      sessionMode: 'cycles',
                      cyclePreset: 'custom',
                      customCycle: { ...next, breakMin: stepMinutes(next.breakMin, d) },
                    };
                  })
                }
              />
              <Stepper
                label={t.rounds}
                value={String(cycle.rounds)}
                spoken={t.roundsCount(cycle.rounds)}
                decLabel={t.less}
                incLabel={t.more}
                canDec={cycle.rounds > CYCLE_LIMITS.minRounds}
                canInc={cycle.rounds < CYCLE_LIMITS.maxRounds}
                onStep={(d) =>
                  aplicar((current) => {
                    const next = activeCycleConfig(current);
                    return {
                      sessionMode: 'cycles',
                      cyclePreset: 'custom',
                      customCycle: { ...next, rounds: stepRounds(next.rounds, d) },
                    };
                  })
                }
              />
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="chip-row" role="radiogroup" aria-label={t.quickTimes}>
            {QUICK_TIMES_MIN.map((min) => (
              <button
                key={min}
                type="button"
                role="radio"
                aria-checked={!customOn && lastMin === min}
                className="control"
                aria-label={t.minutes(min)}
                onClick={() => {
                  setSingleCustom(false);
                  aplicar({ sessionMode: 'single', lastDurationMs: min * MINUTE_MS });
                }}
              >
                {min}
              </button>
            ))}
            <button
              type="button"
              role="radio"
              aria-checked={customOn}
              className="control"
              onClick={() => setSingleCustom(true)}
            >
              {t.custom}
            </button>
          </div>
          {customOn ? (
            <div className="stepper-row">
              <Stepper
                label={t.session}
                value={`${DURATION_STEPS_MIN[indiceDuracion] ?? lastMin} min`}
                spoken={t.minutes(DURATION_STEPS_MIN[indiceDuracion] ?? lastMin)}
                decLabel={t.less}
                incLabel={t.more}
                canDec={indiceDuracion > 0}
                canInc={indiceDuracion < DURATION_STEPS_MIN.length - 1}
                scrubIndex={indiceDuracion}
                scrubMax={DURATION_STEPS_MIN.length - 1}
                onStep={(d) => {
                  setBorrador(null);
                  aplicar((current) => ({
                    sessionMode: 'single',
                    lastDurationMs: stepToDuration(nearestStepIndex(current.lastDurationMs) + d),
                  }));
                }}
                onScrubIndex={setBorrador}
                onScrubEnd={cerrarBorrador}
              />
            </div>
          ) : null}
        </>
      )}

      <div className="pref-row">
        <button
          type="button"
          className="control redondo"
          aria-label={temaTxt}
          title={temaTxt}
          onClick={() => aplicar((current) => ({ theme: nextInCycle(THEME_CYCLE, current.theme) }))}
        >
          <IconoTema theme={settings.theme} />
        </button>
        <button
          type="button"
          className="control redondo"
          aria-label={idiomaTxt}
          title={idiomaTxt}
          onClick={() => aplicar((current) => ({ language: nextInCycle(LANGUAGE_CYCLE, current.language) }))}
        >
          <span className="pref-marca" aria-hidden="true">
            {languageShort(t, settings.language)}
          </span>
        </button>
        <button
          type="button"
          className="control redondo"
          role="switch"
          aria-checked={settings.sound}
          aria-label={sonidoTxt}
          title={sonidoTxt}
          onClick={() => aplicar((current) => ({ sound: !current.sound }))}
        >
          <SpeakerIcon size={20} off={!settings.sound} />
        </button>
        <button
          type="button"
          className="control redondo"
          aria-label={t.showGestures}
          title={t.gestures}
          onClick={() => setGestos(true)}
        >
          <HandIcon size={20} />
        </button>
        {arenaDia ? (
          <button
            type="button"
            className="control redondo"
            aria-label={rachaTxt}
            title={rachaTxt}
            onClick={() => setRacha(true)}
          >
            <JarIcon size={20} />
          </button>
        ) : null}
      </div>
    </div>
    <HojaGestos abierta={open && gestos} lang={idioma ?? 'es'} alCerrar={() => setGestos(false)} />
    {arenaDia ? (
      <HojaDia
        abierta={open && racha}
        arena={arenaDia}
        lang={idioma ?? 'es'}
        alCerrar={() => setRacha(false)}
      />
    ) : null}
    </>
  );
}

function IconoTema({ theme }: { readonly theme: Settings['theme'] }) {
  if (theme === 'dark') return <MoonIcon size={20} />;
  if (theme === 'system') return <AutoThemeIcon size={20} />;
  return <SunIcon size={20} />;
}

const SCRUB_PX = 18;

/** Flechas, o Enter/Espacio sobre − y +. El clic del ratón no pasa por aquí. */
function pasoDeTecla(event: ReactKeyboardEvent<HTMLDivElement>): number | null {
  if (event.key === 'ArrowRight' || event.key === 'ArrowUp') return 1;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') return -1;
  if (event.key !== 'Enter' && event.key !== ' ') return null;
  const el = event.target instanceof Element ? event.target.closest('button') : null;
  const paso = el?.getAttribute('data-paso');
  if (paso === '1' || paso === '-1') return Number(paso);
  return null;
}

function Stepper({
  label,
  value,
  spoken,
  decLabel,
  incLabel,
  canDec,
  canInc,
  onStep,
  scrubIndex,
  scrubMax,
  onScrubIndex,
  onScrubEnd,
}: {
  label: string;
  value: string;
  spoken: string;
  decLabel: string;
  incLabel: string;
  canDec: boolean;
  canInc: boolean;
  onStep: (delta: number) => void;
  scrubIndex?: number;
  scrubMax?: number;
  /** Cada paso del arrastre o de una tecla mantenida. Solo el número. */
  onScrubIndex?: (index: number) => void;
  /** Al soltar el puntero o la tecla. Una sola vez. */
  onScrubEnd?: (index: number) => void;
}) {
  const scrub = onScrubIndex != null && onScrubEnd != null && scrubIndex != null && scrubMax != null;
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startIndex: number;
    moved: boolean;
    sent: number;
  } | null>(null);
  const swallowClick = useRef(false);
  const teclas = useRef(new Set<string>());
  const mostrado = useRef(scrubIndex ?? 0);
  if (drag.current == null && teclas.current.size === 0) mostrado.current = scrubIndex ?? 0;

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!scrub || scrubIndex == null || event.button !== 0) return;
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startIndex: scrubIndex,
      moved: false,
      sent: scrubIndex,
    };
    mostrado.current = scrubIndex;
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = drag.current;
    if (!scrub || !gesture || gesture.pointerId !== event.pointerId || scrubMax == null) return;
    const dx = event.clientX - gesture.startX;
    if (!gesture.moved && Math.abs(dx) < 5) return;
    if (!gesture.moved && !event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    gesture.moved = true;
    const index = Math.min(scrubMax, Math.max(0, gesture.startIndex + Math.trunc(dx / SCRUB_PX)));
    if (index === gesture.sent) return;
    gesture.sent = index;
    mostrado.current = index;
    onScrubIndex?.(index);
  };

  const endScrub = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = drag.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const aplicar = gesture.moved;
    const index = gesture.sent;
    if (aplicar) {
      swallowClick.current = true;
      window.setTimeout(() => {
        swallowClick.current = false;
      }, 0);
    }
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (aplicar) onScrubEnd?.(index);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!scrub || scrubMax == null) return;
    const delta = pasoDeTecla(event);
    if (delta == null) return;
    event.preventDefault();
    // El Enter/Espacio del botón no debe disparar el clic: el plan se aplica al soltar.
    swallowClick.current = true;
    teclas.current.add(event.key);
    const index = Math.min(scrubMax, Math.max(0, mostrado.current + delta));
    if (index === mostrado.current) return;
    mostrado.current = index;
    onScrubIndex?.(index);
  };

  const onKeyUp = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!teclas.current.has(event.key)) return;
    event.preventDefault();
    teclas.current.delete(event.key);
    if (teclas.current.size > 0 || !scrub) return;
    onScrubEnd?.(mostrado.current);
    window.setTimeout(() => {
      swallowClick.current = false;
    }, 0);
  };

  const onBlur = () => {
    if (teclas.current.size === 0 || !scrub) return;
    teclas.current.clear();
    swallowClick.current = false;
    onScrubEnd?.(mostrado.current);
  };

  return (
    <div className="stepper">
      <div
        className={scrub ? 'stepper-controls stepper-scrub' : 'stepper-controls'}
        onPointerDown={scrub ? onPointerDown : undefined}
        onPointerMove={scrub ? onPointerMove : undefined}
        onPointerUp={scrub ? endScrub : undefined}
        onPointerCancel={scrub ? endScrub : undefined}
        onKeyDown={scrub ? onKeyDown : undefined}
        onKeyUp={scrub ? onKeyUp : undefined}
        onBlur={scrub ? onBlur : undefined}
        onClickCapture={(event) => {
          if (!swallowClick.current) return;
          swallowClick.current = false;
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        <button
          type="button"
          className="control redondo"
          data-paso="-1"
          aria-label={`${decLabel} ${label}`}
          disabled={!canDec}
          onClick={() => onStep(-1)}
        >
          −
        </button>
        <span className="stepper-valor">
          <span aria-hidden="true">{value}</span>
          <span className="stepper-label secundario">
            <span className="sr-only">{spoken}. </span>
            {label}
          </span>
        </span>
        <button
          type="button"
          className="control redondo"
          data-paso="1"
          aria-label={`${incLabel} ${label}`}
          disabled={!canInc}
          onClick={() => onStep(1)}
        >
          +
        </button>
      </div>
    </div>
  );
}
