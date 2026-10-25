import { Analytics } from '@vercel/analytics/react';
import {
  activeCycleConfig,
  messagesFor,
  nearestStepIndex,
  resolveLanguage,
  sessionCue,
  sessionPlanFor,
  sessionSnapshot,
  stepMinutes,
  stepToDuration,
  type Settings,
  type ThemePreference,
} from '@reloj/core';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { disableGoogleAnalytics, enableGoogleAnalytics, gaMeasurementId } from './analytics';
import { CookieBanner } from './components/CookieBanner';
import { SettingsSheet } from './components/SettingsSheet';
import { SiteFooter } from './components/SiteFooter';
import { TimeReadout } from './components/TimeReadout';
import { hintFor } from './copy';
import { readConsent, writeConsent, type ConsentChoice } from './cookies';
import { HourglassView } from './hourglass/HourglassView';
import type { HourglassHandle, HourglassParams } from './hourglass/useEngine';
import { ensureNotificationPermission, showPhaseNotification } from './notify';
import { playCue, primeAudio } from './sound';
import { useSession } from './useSession';
import { useSettings, type SettingsPatch } from './useSettings';

type Scheme = 'light' | 'dark';

function resolveScheme(preference: ThemePreference, systemDark: boolean): Scheme {
  if (preference === 'light' || preference === 'dark') return preference;
  return systemDark ? 'dark' : 'light';
}

function useSystemDark() {
  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return dark;
}

function useReducedMotion() {
  const [reduce, setReduce] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduce(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduce;
}

function useWideLayout() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const apply = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      setWide(w >= rem * 46 && w > h * 1.05);
    };
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, []);
  return wide;
}

export function App() {
  const { settings, update } = useSettings();
  return (
    <>
      <Timer settings={settings} update={update} />
      <Analytics />
    </>
  );
}

function Timer({
  settings,
  update,
}: {
  settings: Settings;
  update: (patch: SettingsPatch | ((current: Settings) => SettingsPatch)) => void;
}) {
  const systemDark = useSystemDark();
  const reduceMotion = useReducedMotion();
  const wide = useWideLayout();
  const scheme = resolveScheme(settings.theme, systemDark);
  const lang = resolveLanguage(settings.language, navigator.language);
  const t = messagesFor(settings.language, navigator.language);

  const session = useSession(sessionPlanFor(settings));
  const { replaceIfChanged, getSnapshot, toggle, restart, tick, view, state } = session;

  useEffect(() => {
    replaceIfChanged(sessionPlanFor(settings));
  }, [settings, replaceIfChanged]);

  const [menu, setMenu] = useState(false);
  const [consentChoice, setConsentChoice] = useState<ConsentChoice | null>(
    () => readConsent()?.choice ?? null,
  );
  const [bannerOpen, setBannerOpen] = useState(() => {
    if (readConsent() === null) return true;
    if (typeof location === 'undefined') return false;
    return (
      new URLSearchParams(location.search).get('configure-cookies') === '1' ||
      location.hash === '#configure-cookies'
    );
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('configure-cookies') === '1' || location.hash === '#configure-cookies') {
      setBannerOpen(true);
      params.delete('configure-cookies');
      const search = params.toString();
      const hash = location.hash === '#configure-cookies' ? '' : location.hash;
      history.replaceState(null, '', `${location.pathname}${search ? `?${search}` : ''}${hash}`);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.style.colorScheme = scheme;
    const theme = document.querySelector('meta[name="theme-color"]');
    theme?.setAttribute('content', scheme === 'dark' ? '#241C18' : '#EBE5DD');
  }, [lang, scheme]);

  useEffect(() => {
    if (consentChoice === 'accepted') enableGoogleAnalytics(gaMeasurementId());
  }, [consentChoice]);

  const chooseCookies = (choice: ConsentChoice) => {
    writeConsent(choice);
    setConsentChoice(choice);
    setBannerOpen(false);
    const id = gaMeasurementId();
    if (choice === 'accepted') enableGoogleAnalytics(id);
    else disableGoogleAnalytics(id);
  };

  const paramsRef = useRef<HourglassParams>({
    getSnapshot,
    scheme,
    reduceMotion,
    gestureAngle: 0,
    gestureActive: false,
    flipToken: 0,
    flipFrom: 0,
    flipBusy: false,
    shakeToken: 0,
  });
  paramsRef.current.getSnapshot = getSnapshot;
  paramsRef.current.scheme = scheme;
  paramsRef.current.reduceMotion = reduceMotion;
  const handleRef = useRef<HourglassHandle | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    handleRef.current?.wake();
  }, [view.status, view.durationMs, view.transitions, scheme, reduceMotion]);

  const prevCue = useRef(view);
  useEffect(() => {
    const cue = sessionCue(prevCue.current, view);
    prevCue.current = view;
    if (!cue) return;
    if (settings.sound) playCue(cue);
    showPhaseNotification(t, cue, view, lang);
  }, [view, settings.sound, t, lang]);

  useEffect(() => {
    if (state.timer.status !== 'running') return;
    const snap = sessionSnapshot(state, Date.now());
    const id = window.setTimeout(() => tick(), Math.max(0, snap.remainingMs + 50));
    return () => window.clearTimeout(id);
  }, [state, tick]);

  const doToggle = useCallback(() => {
    primeAudio();
    const status = state.timer.status;
    if (status === 'idle' || status === 'finished') void ensureNotificationPermission();
    toggle();
    handleRef.current?.wake();
  }, [state.timer.status, toggle]);

  const doRestart = useCallback(() => {
    if (paramsRef.current.flipBusy) return;
    paramsRef.current.flipFrom = paramsRef.current.gestureAngle;
    paramsRef.current.gestureAngle = 0;
    paramsRef.current.gestureActive = false;
    paramsRef.current.flipToken += 1;
    restart();
    handleRef.current?.wake();
  }, [restart]);

  const toggleRef = useRef(doToggle);
  toggleRef.current = doToggle;

  const appRef = useRef<HTMLDivElement>(null);
  const sideRef = useRef<HTMLDivElement>(null);
  const paused = view.status === 'paused';

  useEffect(() => {
    if (paused) setMenu(false);
  }, [paused]);

  useLayoutEffect(() => {
    const app = appRef.current;
    const side = sideRef.current;
    if (!app || !side) return;
    const apply = () => {
      const sideRect = side.getBoundingClientRect();
      app.style.setProperty('--side-left', `${Math.round(sideRect.left)}px`);
      app.style.setProperty('--side-width', `${Math.round(sideRect.width)}px`);
      app.style.setProperty('--side-bottom', `${Math.round(window.innerHeight - sideRect.bottom)}px`);
      const sheet = app.querySelector('.sheet');
      const readout = side.querySelector('.readout');
      const rem = parseFloat(getComputedStyle(app).fontSize) || 16;
      if (!menu || !(sheet instanceof HTMLElement) || !(readout instanceof HTMLElement)) {
        app.style.setProperty('--clock-lift', '0px');
        app.style.removeProperty('--menu-pad');
        return;
      }
      const sheetH = sheet.getBoundingClientRect().height;
      const gap = rem * 1.15;
      if (!wide) {
        app.style.setProperty('--clock-lift', '0px');
        app.style.setProperty('--menu-pad', `${Math.round(sheetH + gap)}px`);
        return;
      }
      app.style.removeProperty('--menu-pad');
      const readH = readout.getBoundingClientRect().height;
      const sideH = sideRect.height;
      const sheetInset = rem * 0.75;
      const clockBottom = (sideH + readH) / 2;
      const sheetTop = sideH - sheetInset - sheetH;
      const centeringLift = (sheetH + sheetInset) / 2;
      const collisionLift = Math.max(0, clockBottom - (sheetTop - gap));
      const maxLift = Math.max(0, (sideH - readH) / 2 - rem * 0.5);
      const lift = Math.min(maxLift, Math.max(centeringLift, collisionLift));
      app.style.setProperty('--clock-lift', `${Math.round(lift)}px`);
    };
    apply();
    const observed = new ResizeObserver(apply);
    observed.observe(side);
    const sheet = app.querySelector('.sheet');
    if (sheet) observed.observe(sheet);
    window.addEventListener('resize', apply);
    return () => {
      observed.disconnect();
      window.removeEventListener('resize', apply);
    };
  }, [menu, wide, settings]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && menu) {
        setMenu(false);
        return;
      }
      if (e.code !== 'Space' || e.repeat) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest('button, a, input, textarea, select')) return;
      e.preventDefault();
      toggleRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu]);

  const stageRef = useRef<HTMLDivElement>(null);
  const wheelAcc = useRef(0);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (menu || state.timer.status === 'running') return;
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16;
      if (e.deltaMode === 2) dy *= 400;
      wheelAcc.current += dy;
      const steps = Math.trunc(wheelAcc.current / 72);
      if (steps === 0) return;
      wheelAcc.current -= steps * 72;
      if (settings.sessionMode === 'cycles') {
        const cycle = activeCycleConfig(settings);
        update({
          sessionMode: 'cycles',
          cyclePreset: 'custom',
          customCycle: { ...cycle, workMin: stepMinutes(cycle.workMin, -steps) },
        });
      } else {
        update({
          sessionMode: 'single',
          lastDurationMs: stepToDuration(nearestStepIndex(settings.lastDurationMs) - steps),
        });
      }
      handleRef.current?.wake();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [menu, settings, state.timer.status, update]);

  const clickTimer = useRef<number | null>(null);
  const onStageClick = () => {
    if (menu) return;
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (clickTimer.current !== null) {
      window.clearTimeout(clickTimer.current);
      clickTimer.current = null;
      return;
    }
    clickTimer.current = window.setTimeout(() => {
      clickTimer.current = null;
      doToggle();
    }, 260);
  };
  const onStageDoubleClick = () => {
    if (menu) return;
    if (clickTimer.current !== null) {
      window.clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    doRestart();
  };

  const label = useMemo(() => {
    if (view.status === 'finished') return view.isCycle ? t.cyclesDone : t.timeUp;
    if (view.isCycle) return t.phaseLabel(view.kind, view.round, view.rounds);
    return null;
  }, [t, view]);
  const hint = hintFor(lang, view.status, view.isCycle && view.status === 'finished');

  const describe = useCallback(
    (remainingMs: number) => {
      const duration = t.duration(remainingMs);
      if (view.status === 'paused') return t.pausedRemaining(duration);
      if (view.status === 'finished') return view.isCycle ? t.cyclesDone : t.timeUp;
      if (view.status === 'running') {
        const phase = view.isCycle ? `${t.phaseSpoken(view.kind, view.round, view.rounds)}. ` : '';
        return `${phase}${t.remaining(duration)}`;
      }
      const ready = t.readyToStart(t.duration(view.durationMs));
      return view.isCycle ? `${t.phaseSpoken(view.kind, view.round, view.rounds)}. ${ready}` : ready;
    },
    [t, view],
  );

  const action = view.status === 'running' ? t.pause : view.status === 'paused' ? t.notifResume : t.start;

  return (
    <div
      ref={appRef}
      className={`app${menu ? ' menu-open' : ''}${paused ? ' is-paused' : ''}`}
      data-scheme={scheme}
      data-layout={wide ? 'wide' : 'narrow'}
    >
      <div className="scene">
        <div
          ref={stageRef}
          className="stage"
          role="button"
          tabIndex={0}
          aria-label={action}
          aria-keyshortcuts="Space"
          onClick={onStageClick}
          onDoubleClick={onStageDoubleClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              doToggle();
            }
          }}
        >
          <HourglassView
            paramsRef={paramsRef}
            handleRef={handleRef}
            suppressClickRef={suppressClickRef}
            onFlip={doRestart}
          />
          <div className="side" ref={sideRef}>
            <TimeReadout
              getSnapshot={getSnapshot}
              running={view.status === 'running'}
              label={label}
              hint={paused ? null : hint}
              describe={describe}
            />
          </div>
        </div>

        <button
          type="button"
          id="menu-button"
          className="menu-btn"
          aria-label={t.openSettings}
          aria-expanded={menu}
          aria-hidden={menu || paused}
          disabled={paused}
          hidden={menu || paused}
          onClick={(e) => {
            e.stopPropagation();
            if (paused || menu) return;
            setMenu(true);
          }}
        >
          <span className="bar long" />
          <span className="bar short" />
        </button>

        {menu ? (
          <button
            type="button"
            className="backdrop"
            aria-label={t.closeSettings}
            onClick={() => setMenu(false)}
          />
        ) : null}
        <SettingsSheet
          open={menu}
          settings={settings}
          t={t}
          onChange={update}
          onClose={() => setMenu(false)}
        />
        <SiteFooter lang={lang} onCookies={() => setBannerOpen(true)} />
        <CookieBanner open={bannerOpen} lang={lang} onChoose={chooseCookies} />
      </div>
      {paused ? (
        <div className="pause-screen">
          <span className="pause-word">{t.paused}</span>
          {hint ? <span className="pause-hint">{hint}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
