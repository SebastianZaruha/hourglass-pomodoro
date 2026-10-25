import {
  CYCLE_LIMITS,
  CYCLE_PRESETS,
  MINUTE_MS,
  activeCycleConfig,
  languageName,
  languageSpoken,
  nextInCycle,
  stepMinutes,
  stepRounds,
  themeName,
  themeSpoken,
  LANGUAGE_CYCLE,
  THEME_CYCLE,
  type CyclePresetId,
  type Messages,
  type Settings,
} from '@reloj/core';

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
        <div className="chip-row" role="radiogroup" aria-label={t.quickTimes}>
          {QUICK_TIMES_MIN.map((min) => (
            <button
              key={min}
              type="button"
              role="radio"
              aria-checked={lastMin === min}
              className={lastMin === min ? 'chip chip-on' : 'chip'}
              aria-label={t.minutes(min)}
              onClick={() => onChange({ sessionMode: 'single', lastDurationMs: min * MINUTE_MS })}
            >
              {min}
            </button>
          ))}
        </div>
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

function Stepper({
  label,
  value,
  spoken,
  decLabel,
  incLabel,
  canDec,
  canInc,
  onStep,
}: {
  label: string;
  value: string;
  spoken: string;
  decLabel: string;
  incLabel: string;
  canDec: boolean;
  canInc: boolean;
  onStep: (delta: number) => void;
}) {
  return (
    <div className="stepper">
      <div className="stepper-controls">
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
