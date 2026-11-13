import {
  CYCLE_LIMITS,
  CYCLE_PRESETS,
  DURATION_STEPS_MIN,
  MINUTE_MS,
  activeCycleConfig,
  languageName,
  languageSpoken,
  nearestStepIndex,
  nextInCycle,
  samePlan,
  sessionPlanFor,
  stepMinutes,
  stepRounds,
  stepToDuration,
  themeName,
  themeSpoken,
  LANGUAGE_CYCLE,
  THEME_CYCLE,
  type CyclePresetId,
  type Language,
  type Messages,
  type Settings,
} from '@reloj/core';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

import { GlobeIcon, SpeakerIcon, SunIcon } from './Icons';

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
  alReiniciar = () => undefined,
}: Props) {
  const cycles = settings.sessionMode === 'cycles';
  const cycle = activeCycleConfig(settings);
  const lastMin = Math.round(settings.lastDurationMs / MINUTE_MS);
  const onPreset = (QUICK_TIMES_MIN as readonly number[]).includes(lastMin);
  const [singleCustom, setSingleCustom] = useState(() => !onPreset);
  const customOn = singleCustom || !onPreset;
  const hoja = useRef<HTMLDivElement>(null);
  const [desborda, setDesborda] = useState(false);

  useEffect(() => {
    if (!onPreset) setSingleCustom(true);
  }, [onPreset]);

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

  const tema = themeName(t, settings.theme);
  const idiomaNombre = languageName(t, settings.language);

  return (
    <div
      ref={hoja}
      className={['sheet', 'vidrio', open ? 'open' : '', desborda ? 'desborda' : '']
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
                value={`${DURATION_STEPS_MIN[nearestStepIndex(settings.lastDurationMs)]} min`}
                spoken={t.minutes(DURATION_STEPS_MIN[nearestStepIndex(settings.lastDurationMs)] ?? lastMin)}
                decLabel={t.less}
                incLabel={t.more}
                canDec={nearestStepIndex(settings.lastDurationMs) > 0}
                canInc={nearestStepIndex(settings.lastDurationMs) < DURATION_STEPS_MIN.length - 1}
                scrubIndex={nearestStepIndex(settings.lastDurationMs)}
                scrubMax={DURATION_STEPS_MIN.length - 1}
                onStep={(d) =>
                  aplicar((current) => ({
                    sessionMode: 'single',
                    lastDurationMs: stepToDuration(nearestStepIndex(current.lastDurationMs) + d),
                  }))
                }
                onScrubIndex={(index) =>
                  aplicar({
                    sessionMode: 'single',
                    lastDurationMs: stepToDuration(index),
                  })
                }
              />
            </div>
          ) : null}
        </>
      )}

      <div className="pref-row">
        <button
          type="button"
          className="control"
          aria-pressed="true"
          aria-label={themeSpoken(t, settings.theme)}
          title={tema === t.automatic ? tema : t.tapToChange}
          onClick={() => aplicar((current) => ({ theme: nextInCycle(THEME_CYCLE, current.theme) }))}
        >
          <SunIcon />
          <span>{tema === t.automatic ? t.automaticShort : tema}</span>
        </button>
        <button
          type="button"
          className="control"
          aria-pressed="true"
          aria-label={languageSpoken(t, settings.language)}
          title={idiomaNombre === t.automatic ? idiomaNombre : t.tapToChange}
          onClick={() => aplicar((current) => ({ language: nextInCycle(LANGUAGE_CYCLE, current.language) }))}
        >
          <GlobeIcon />
          <span>{idiomaNombre === t.automatic ? t.automaticShort : idiomaNombre}</span>
        </button>
        <button
          type="button"
          className="control"
          role="switch"
          aria-checked={settings.sound}
          aria-label={t.sound}
          onClick={() => aplicar((current) => ({ sound: !current.sound }))}
        >
          <SpeakerIcon off={!settings.sound} />
          <span>{t.sound}</span>
        </button>
      </div>
    </div>
  );
}

const SCRUB_PX = 18;

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
  onScrubIndex?: (index: number) => void;
}) {
  const scrub = onScrubIndex != null && scrubIndex != null && scrubMax != null;
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startIndex: number;
    moved: boolean;
    sent: number;
  } | null>(null);
  const swallowClick = useRef(false);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!scrub || scrubIndex == null || event.button !== 0) return;
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startIndex: scrubIndex,
      moved: false,
      sent: scrubIndex,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = drag.current;
    if (
      !scrub ||
      !gesture ||
      gesture.pointerId !== event.pointerId ||
      onScrubIndex == null ||
      scrubMax == null
    ) {
      return;
    }
    const dx = event.clientX - gesture.startX;
    if (!gesture.moved && Math.abs(dx) < 5) return;
    if (!gesture.moved && !event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    gesture.moved = true;
    const index = Math.min(scrubMax, Math.max(0, gesture.startIndex + Math.trunc(dx / SCRUB_PX)));
    if (index === gesture.sent) return;
    gesture.sent = index;
    onScrubIndex(index);
  };

  const endScrub = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = drag.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (gesture.moved) {
      swallowClick.current = true;
      window.setTimeout(() => {
        swallowClick.current = false;
      }, 0);
    }
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div className="stepper">
      <div
        className={scrub ? 'stepper-controls stepper-scrub' : 'stepper-controls'}
        onPointerDown={scrub ? onPointerDown : undefined}
        onPointerMove={scrub ? onPointerMove : undefined}
        onPointerUp={scrub ? endScrub : undefined}
        onPointerCancel={scrub ? endScrub : undefined}
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
