import { Analytics } from '@vercel/analytics/react';
import {
  messagesFor,
  resolveLanguage,
  sessionCue,
  sessionPlanFor,
  sessionSnapshot,
  type Settings,
  type ThemePreference,
} from '@reloj/core';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { useGiro } from '../comun/giro';
import { SettingsSheet } from '../comun/menu';
import { AndroidPromo } from '../comun/paneles/android';
import { CookieBanner } from '../comun/paneles/cookies';
import { LegalOverlay } from '../comun/paneles/legal';
import { Pausa } from '../comun/paneles/pausa';
import { SiteFooter } from '../comun/paneles/pie';
import { TimeReadout } from '../comun/reloj';
import { Frasco, usePageIntro } from '../comun/frasco';
import {
  hintFor,
  playCue,
  showPhaseNotification,
  useSession,
  useSettings,
  type SettingsPatch,
} from '../comun/tiempo';
import { barraPublicada, escenas } from './registro';
import { useAvisos } from './useAvisos';
import { useEntrada } from './useEntrada';

function allowAnalyticsEvent<E>(event: E): E {
  return event;
}

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

function isWideLayout(): boolean {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  return w >= rem * 46 && w > h * 1.05;
}

function useWideLayout() {
  const [wide, setWide] = useState(isWideLayout);
  useEffect(() => {
    const apply = () => setWide(isWideLayout());
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, []);
  return wide;
}

export function App() {
  const { settings, update } = useSettings();
  return <Timer settings={settings} update={update} />;
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
  const escena = escenas[0];

  const session = useSession(sessionPlanFor(settings));
  const { replaceIfChanged, getSnapshot, toggle, restart, tick, view, state } = session;

  useEffect(() => {
    replaceIfChanged(sessionPlanFor(settings));
  }, [settings, replaceIfChanged]);

  const [menu, setMenu] = useState(false);
  const giro = useGiro();
  const wakeRef = useRef<(() => void) | null>(null);
  const wake = useCallback(() => {
    wakeRef.current?.();
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.style.colorScheme = scheme;
    const theme = document.querySelector('meta[name="theme-color"]');
    theme?.setAttribute('content', barraPublicada(scheme));
  }, [lang, scheme]);

  useEffect(() => {
    wake();
  }, [view.status, view.durationMs, view.transitions, scheme, reduceMotion, wake]);

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

  const appRef = useRef<HTMLDivElement>(null);
  const intro = usePageIntro(appRef, giro);
  const avisos = useAvisos({ menu, introLista: intro.settled });
  const stageRef = useRef<HTMLDivElement>(null);
  const entrada = useEntrada({
    menu,
    setMenu,
    legal: avisos.legal,
    setLegal: avisos.setLegal,
    introBloquea: intro.blocksInput,
    view,
    state,
    settings,
    update,
    toggle,
    restart,
    giro,
    wake,
    stageRef,
  });

  const paused = view.status === 'paused';
  const [vuelvePausa, setVuelvePausa] = useState(false);
  const veniaDePausa = useRef(false);
  if (paused) veniaDePausa.current = true;
  if (paused && menu) setMenu(false);
  if (paused && vuelvePausa) setVuelvePausa(false);
  else if (!paused && veniaDePausa.current) {
    veniaDePausa.current = false;
    setVuelvePausa(true);
  }
  useEffect(() => {
    if (!vuelvePausa) return;
    const id = window.setTimeout(() => setVuelvePausa(false), 400);
    return () => window.clearTimeout(id);
  }, [vuelvePausa]);
  useEffect(() => {
    giro.enPausa(paused);
  }, [giro, paused]);
  useEffect(() => {
    if (paused) avisos.setLegal(null);
  }, [paused, avisos.setLegal]);

  const alReiniciar = useCallback(() => {
    giro.ordenar({ tipo: 'reiniciar' });
    wake();
  }, [giro, wake]);

  const sideRef = useRef<HTMLDivElement>(null);
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
  const showAndroidPromo = avisos.showAndroidPromo;

  return (
    <div
      ref={appRef}
      className={`app${menu ? ' menu-open' : ''}${paused ? ' is-paused' : ''}${vuelvePausa ? ' pausa-vuelve' : ''}${showAndroidPromo ? ' has-android-promo' : ''}${intro.className ? ` ${intro.className}` : ''}`}
      data-scheme={scheme}
      data-layout={wide ? 'wide' : 'narrow'}
    >
      {avisos.consentChoice === 'accepted' ? <Analytics beforeSend={allowAnalyticsEvent} /> : null}
      <div className="scene">
        <div
          ref={stageRef}
          className="stage"
          role="button"
          tabIndex={0}
          aria-label={action}
          aria-keyshortcuts="Space"
          onMouseDown={entrada.onStageMouseDown}
          onClick={entrada.onStageClick}
          onDoubleClick={entrada.onStageDoubleClick}
          onKeyDown={entrada.onStageKeyDown}
        >
          <Frasco
            crearContenido={escena.crearContenido}
            scheme={scheme}
            reducir={reduceMotion}
            getSnapshot={getSnapshot}
            giro={giro}
            introPaso={intro.paso}
            onReinicio={entrada.onReinicio}
            suppressClickRef={entrada.suppressClickRef}
            wakeRef={wakeRef}
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
      </div>
      <div inert={paused || undefined}>
        <SiteFooter
          lang={lang}
          onCookies={() => avisos.setBannerOpen(true)}
          onOpenLegal={(href, title) => avisos.setLegal({ href, title })}
        />
      </div>
      {showAndroidPromo ? <AndroidPromo lang={lang} onDismiss={avisos.dismissAndroidPromo} /> : null}
      <CookieBanner
        open={avisos.bannerOpen}
        lang={lang}
        onChoose={avisos.chooseCookies}
        onOpenLegal={(href, title) => avisos.setLegal({ href, title })}
      />
      {avisos.legal ? (
        <LegalOverlay
          src={avisos.legal.href}
          title={avisos.legal.title}
          onClose={() => avisos.setLegal(null)}
          onConfigure={() => avisos.setBannerOpen(true)}
        />
      ) : null}
      {paused ? <Pausa word={t.paused} hint={t.hintPaused} /> : null}
      <button
        type="button"
        id="menu-button"
        className="menu-btn"
        aria-label={t.openSettings}
        aria-expanded={menu}
        aria-hidden={menu || paused}
        hidden={menu}
        inert={paused || undefined}
        tabIndex={paused ? -1 : undefined}
        onClick={(ev) => {
          ev.stopPropagation();
          if (paused) return;
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
        escenas={escenas}
        escenaId={escena.id}
        idioma={lang}
        onEscena={() => undefined}
        alReiniciar={alReiniciar}
        onChange={update}
        onClose={() => setMenu(false)}
      />
    </div>
  );
}
