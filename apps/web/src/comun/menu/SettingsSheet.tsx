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
  stepMinutes,
  stepRounds,
  stepToDuration,
  themeName,
  themeSpoken,
  LANGUAGE_CYCLE,
  THEME_CYCLE,
  type CyclePresetId,
  type Messages,
  type Settings,
} from '@reloj/core';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

import { GlobeIcon, SpeakerIcon, SunIcon } from './Icons';

const QUICK_TIMES_MIN = [5, 10, 15, 25, 45, 60] as const;

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
}

export function SettingsSheet({ open, settings, t, onChange, onClose }: Props) {
  const cycles = settings.sessionMode === 'cycles';
  const cycle = activeCycleConfig(settings);
  const lastMin = Math.round(settings.lastDurationMs / MINUTE_MS);
  const onPreset = (QUICK_TIMES_MIN as readonly number[]).includes(lastMin);
  const [singleCustom, setSingleCustom] = useState(() => !onPreset);
  const customOn = singleCustom || !onPreset;

  useEffect(() => {
    if (!onPreset) setSingleCustom(true);
  }, [onPreset]);

  const chooseCustom = () => {
    const seed = settings.cyclePreset === 'custom' ? settings.customCycle : activeCycleConfig(settings);
    onChange({ sessionMode: 'cycles', cyclePreset: 'custom', customCycle: seed });
  };

  return (
    <div
      className={open ? 'sheet open' : 'sheet'}
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
        <button type="button" className="sheet-close" aria-label={t.closeSettings} onClick={onClose}>
          ×
        </button>
      </div>

      <div className="mode-row" role="radiogroup" aria-label={t.sessionType}>
        <button
          type="button"
          role="radio"
          aria-checked={!cycles}
          className={!cycles ? 'pill pill-fill' : 'pill'}
          onClick={() => onChange({ sessionMode: 'single' })}
        >
          {t.single}
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={cycles}
          className={cycles ? 'pill pill-fill' : 'pill'}
          onClick={() => onChange({ sessionMode: 'cycles' })}
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
                className={settings.cyclePreset === preset.id ? 'chip chip-on' : 'chip'}
                aria-label={t.presetSpoken(preset.config.workMin, preset.config.breakMin)}
                onClick={() => onChange({ sessionMode: 'cycles', cyclePreset: preset.id })}
              >
                {preset.config.workMin}/{preset.config.breakMin}
              </button>
            ))}
            <button
              type="button"
              role="radio"
              aria-checked={settings.cyclePreset === 'custom'}
              className={settings.cyclePreset === 'custom' ? 'chip chip-on' : 'chip'}
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
                  onChange((current) => {
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
                  onChange((current) => {
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
                  onChange((current) => {
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
                className={!customOn && lastMin === min ? 'chip chip-on' : 'chip'}
                aria-label={t.minutes(min)}
                onClick={() => {
                  setSingleCustom(false);
                  onChange({ sessionMode: 'single', lastDurationMs: min * MINUTE_MS });
                }}
              >
                {min}
              </button>
            ))}
            <button
              type="button"
              role="radio"
              aria-checked={customOn}
              className={customOn ? 'chip chip-on' : 'chip'}
              onClick={() => setSingleCustom(true)}
            >
              {t.custom}
            </button>
          </div>
          {customOn ? (
            <div className="stepper-row stepper-solo">
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
                  onChange((current) => ({
                    sessionMode: 'single',
                    lastDurationMs: stepToDuration(nearestStepIndex(current.lastDurationMs) + d),
                  }))
                }
                onScrubIndex={(index) =>
                  onChange({
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
          className="pill pill-fill pref"
          aria-label={themeSpoken(t, settings.theme)}
          title={t.tapToChange}
          onClick={() => onChange((current) => ({ theme: nextInCycle(THEME_CYCLE, current.theme) }))}
        >
          <SunIcon />
          <span>{themeName(t, settings.theme)}</span>
        </button>
        <button
          type="button"
          className="pill pill-fill pref"
          aria-label={languageSpoken(t, settings.language)}
          title={t.tapToChange}
          onClick={() => onChange((current) => ({ language: nextInCycle(LANGUAGE_CYCLE, current.language) }))}
        >
          <GlobeIcon />
          <span>{languageName(t, settings.language)}</span>
        </button>
        <button
          type="button"
          className={settings.sound ? 'pill pill-fill pref' : 'pill pref'}
          role="switch"
          aria-checked={settings.sound}
          aria-label={t.sound}
          onClick={() => onChange((current) => ({ sound: !current.sound }))}
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
          aria-label={`${decLabel} ${label}`}
          disabled={!canDec}
          onClick={() => onStep(-1)}
        >
          −
        </button>
        <span aria-hidden="true">{value}</span>
        <button
          type="button"
          aria-label={`${incLabel} ${label}`}
          disabled={!canInc}
          onClick={() => onStep(1)}
        >
          +
        </button>
      </div>
      <span className="stepper-label">
        <span className="sr-only">{spoken}. </span>
        {label}
      </span>
    </div>
  );
}
