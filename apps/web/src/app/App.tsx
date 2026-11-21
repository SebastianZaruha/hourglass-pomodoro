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

import { leerArenaDia, sumarPomodoro, type ArenaDia } from '../comun/dia/dia';
import { useTactil } from '../comun/entrada/tactil';
import { Fondo, direccionesDePrecarga, precargarFondos, useCajaFrasco } from '../comun/fondo';
import { Capa3D, crearPuente3D } from '../comun/frasco-3d';
import { useGiro } from '../comun/giro';
import { SettingsSheet } from '../comun/menu';
import { AndroidPromo, readPrimeraSesion, writePrimeraSesion } from '../comun/paneles/android';
import { AvisoSesion } from '../comun/paneles/aviso/AvisoSesion';
import { CookieBanner } from '../comun/paneles/cookies';
import { LegalOverlay } from '../comun/paneles/legal';
import { Mano } from '../comun/paneles/mano/Mano';
import { Pausa } from '../comun/paneles/pausa';
import { SiteFooter } from '../comun/paneles/pie';
import { TimeReadout } from '../comun/reloj';
import { Frasco, usePageIntro } from '../comun/frasco';
import {
  hintFor,
  playCue,
  ensureNotificationPermission,
  notificationSupported,
  showPhaseNotification,
  useSession,
  useSettings,
  type SettingsPatch,
} from '../comun/tiempo';
import { useAvisos } from './useAvisos';
import { useEntrada } from './useEntrada';
import { escenas } from './registro';

const ESQUEMA = { light: 'claro', dark: 'oscuro' } as const;
const CLAVE_ESCENA = 'hourglass-web/escena';

function escenaInicial() {
  let id: string | null = null;
  try {
    id = localStorage.getItem(CLAVE_ESCENA);
  } catch {
    id = null;
  }
  const hallada = escenas.find((item) => item.id === id);
  if (hallada) return hallada;
  const lluvia = escenas.find((item) => item.id === 'lluvia');
  if (lluvia) return lluvia;
  const primera = escenas[0];
  if (primera) return primera;
  throw new Error('El registro no tiene escenas.');
}

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
  const tactil = useTactil();
  const scheme = resolveScheme(settings.theme, systemDark);
  const lang = resolveLanguage(settings.language, navigator.language);
  const t = messagesFor(settings.language, navigator.language);
  const [escena, setEscena] = useState(escenaInicial);
  const [sesionTerminada, setSesionTerminada] = useState(() => readPrimeraSesion());
  const [pedirAviso, setPedirAviso] = useState(false);
  const [pulso, setPulso] = useState(false);
  const [brillo, setBrillo] = useState(false);
  const [arenaDia, setArenaDia] = useState<ArenaDia>(() => leerArenaDia());
  const aspecto = escena[ESQUEMA[scheme]];

  const session = useSession(sessionPlanFor(settings));
  const { replaceIfChanged, getSnapshot, toggle, restart, tick, view, state } = session;
  const estadoPrevio = useRef(view.status);

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
    theme?.setAttribute('content', aspecto.barra);
  }, [aspecto.barra, lang, scheme]);

  useEffect(() => {
    wake();
  }, [view.status, view.durationMs, view.transitions, scheme, reduceMotion, wake]);

  useEffect(() => {
    const antes = estadoPrevio.current;
    estadoPrevio.current = view.status;
    if (antes === 'running' || view.status !== 'running' || reduceMotion) return;
    setPulso(true);
    const id = window.setTimeout(() => setPulso(false), 700);
    return () => window.clearTimeout(id);
  }, [reduceMotion, view.status]);

  const prevCue = useRef(view);
  useEffect(() => {
    const cue = sessionCue(prevCue.current, view);
    prevCue.current = view;
    if (!cue) return;
    if (settings.sound) playCue(cue);
    showPhaseNotification(t, cue, view, lang);
    if (cue === 'finished') {
      writePrimeraSesion();
      setSesionTerminada(true);
      if (!reduceMotion) {
        setBrillo(true);
        window.setTimeout(() => setBrillo(false), 900);
      }
      setArenaDia(sumarPomodoro());
      if (
        notificationSupported() &&
        Notification.permission === 'default' &&
        !settings.alertsPermissionAsked
      ) {
        setPedirAviso(true);
      }
    }
  }, [reduceMotion, view, settings.sound, settings.alertsPermissionAsked, t, lang]);

  useEffect(() => {
    if (state.timer.status !== 'running') return;
    const snap = sessionSnapshot(state, Date.now());
    const id = window.setTimeout(() => tick(), Math.max(0, snap.remainingMs + 50));
    return () => window.clearTimeout(id);
  }, [state, tick]);

  const appRef = useRef<HTMLDivElement>(null);
  const intro = usePageIntro(appRef, giro);
  const avisos = useAvisos({ menu, introLista: intro.settled, sesionTerminada, cubierto: pedirAviso });
  const stageRef = useRef<HTMLDivElement>(null);
  const caja = useCajaFrasco(stageRef);
  const [puente3d] = useState(crearPuente3D);
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

  const alElegirEscena = useCallback((id: string) => {
    const siguiente = escenas.find((item) => item.id === id);
    if (!siguiente) return;
    setEscena(siguiente);
    try {
      localStorage.setItem(CLAVE_ESCENA, siguiente.id);
    } catch {
      /* el navegador no guarda */
    }
  }, []);

  useEffect(() => {
    const propias = new Set(direccionesDePrecarga(aspecto));
    const urls = [
      ...new Set(
        escenas
          .flatMap((item) => [item.claro, item.oscuro])
          .flatMap((item) => [...direccionesDePrecarga(item)])
          .filter((url) => !propias.has(url)),
      ),
    ];
    precargarFondos(urls);
  }, [aspecto]);

  const sideRef = useRef<HTMLDivElement>(null);
  const nubeOpacidad = useRef(1);
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
      const readH = readout instanceof HTMLElement ? readout.getBoundingClientRect().height : 0;
      const sideH = sideRect.height;
      const centrado = Math.max(0, (sideH - readH) / 2);
      const enAlto = Boolean(wide && escena.relojAlto && caja);
      const descanso = enAlto && caja ? caja.y + caja.h * 0.06 - sideRect.top : centrado;
      // En el nodo, con la curva del fundido. Si el menú está abierto, su
      // levantado acompaña esos 360 ms: si no, el reloj se adelanta y vuelve.
      if (readout instanceof HTMLElement) {
        if (wide) {
          const primero = readout.dataset.puesto !== '1';
          const altoAhora = enAlto ? '1' : '0';
          const cambia = !primero && readout.dataset.alto !== altoAhora;
          if (primero) readout.style.transition = 'none';
          else if (cambia && !reduceMotion) {
            readout.style.transition =
              'margin-top 360ms cubic-bezier(0.33, 0, 0.2, 1), transform 360ms cubic-bezier(0.33, 0, 0.2, 1)';
            window.setTimeout(() => {
              if (readout.dataset.alto === altoAhora) readout.style.transition = '';
            }, 380);
          }
          readout.style.marginTop = `${Math.round(descanso)}px`;
          readout.dataset.alto = altoAhora;
          if (primero) {
            readout.getBoundingClientRect();
            readout.style.transition = '';
            readout.dataset.puesto = '1';
          }
        } else if (readout.dataset.puesto === '1') {
          readout.style.marginTop = '';
          readout.dataset.alto = '';
        }
      }
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
      const sheetInset = rem * 0.75;
      const clockBottom = descanso + readH;
      const sheetTop = sideH - sheetInset - sheetH;
      const collisionLift = Math.max(0, clockBottom - (sheetTop - gap));
      const maxLift = enAlto ? Math.max(0, descanso) : Math.max(0, centrado - rem * 0.5);
      const lift = Math.min(maxLift, collisionLift);
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
  }, [caja, escena.relojAlto, menu, reduceMotion, wide, settings]);

  const label = useMemo(() => {
    if (view.status === 'finished') return view.isCycle ? t.cyclesDone : lang === 'es' ? 'Hecho' : 'Done';
    if (view.isCycle) return t.phaseLabel(view.kind, view.round, view.rounds);
    return null;
  }, [lang, t, view]);
  const hint = hintFor(lang, view.status, view.isCycle && view.status === 'finished', tactil);
  const describe = useCallback(
    (remainingMs: number) => {
      const duration = t.duration(remainingMs);
      if (view.status === 'paused') return t.pausedRemaining(duration);
      if (view.status === 'finished') return view.isCycle ? t.cyclesDone : lang === 'es' ? 'Hecho' : 'Done';
      if (view.status === 'running') {
        const phase = view.isCycle ? `${t.phaseSpoken(view.kind, view.round, view.rounds)}. ` : '';
        return `${phase}${t.remaining(duration)}`;
      }
      const ready = t.readyToStart(t.duration(view.durationMs));
      return view.isCycle ? `${t.phaseSpoken(view.kind, view.round, view.rounds)}. ${ready}` : ready;
    },
    [lang, t, view],
  );
  const action = view.status === 'running' ? t.pause : view.status === 'paused' ? t.notifResume : t.start;
  const showAndroidPromo = avisos.showAndroidPromo;

  return (
    <div
      ref={appRef}
      className={`app${menu ? ' menu-open' : ''}${paused ? ' is-paused' : ''}${vuelvePausa ? ' pausa-vuelve' : ''}${showAndroidPromo ? ' has-android-promo' : ''}${brillo ? ' sesion-hecha' : ''}${intro.className ? ` ${intro.className}` : ''}`}
      data-scheme={scheme}
      data-layout={wide ? 'wide' : 'narrow'}
      data-reloj={escena.relojAlto ? 'alto' : 'centro'}
      style={{
        ['--time' as string]: aspecto.reloj.digitos,
        ['--hint' as string]: aspecto.reloj.pista,
        ['--footer' as string]: aspecto.tinta,
        ['--menu' as string]: aspecto.tinta,
      }}
    >
      {avisos.consentChoice === 'accepted' ? <Analytics beforeSend={allowAnalyticsEvent} /> : null}
      <div className="scene">
        <Fondo aspecto={aspecto} caja={caja} reducir={reduceMotion} angosta={!wide} />
        <Capa3D aspecto={aspecto} modo={ESQUEMA[scheme]} caja={caja} puente={puente3d} />
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
            generacion={escena.id}
            luz={aspecto.luz}
            scheme={scheme}
            reducir={reduceMotion}
            getSnapshot={getSnapshot}
            giro={giro}
            introPaso={intro.paso}
            onReinicio={entrada.onReinicio}
            suppressClickRef={entrada.suppressClickRef}
            wakeRef={wakeRef}
            alFlotar={nubeOpacidad}
            puente3d={puente3d}
          />
          {escena.Encima && caja && !intro.blocksInput ? (
            <escena.Encima caja={caja} opacidad={nubeOpacidad} reducir={reduceMotion} oscuro={scheme === 'dark'} />
          ) : null}
          <div className="side" ref={sideRef}>
            <TimeReadout
              getSnapshot={getSnapshot}
              running={view.status === 'running'}
              label={label}
              hint={paused ? null : hint}
              pulso={pulso}
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
      <AvisoSesion
        abierta={pedirAviso && !paused && !menu && !avisos.bannerOpen && avisos.legal === null}
        lang={lang}
        alAceptar={() => {
          setPedirAviso(false);
          update({ alertsPermissionAsked: true });
          void ensureNotificationPermission();
        }}
        alRechazar={() => {
          setPedirAviso(false);
          update({ alertsPermissionAsked: true });
        }}
      />
      {paused ? <Pausa word={t.paused} lang={lang} /> : null}
      <Mano visible={intro.settled && !avisos.bannerOpen && !menu && !paused && avisos.legal === null} />
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
        onEscena={alElegirEscena}
        arenaDia={arenaDia}
        alReiniciar={alReiniciar}
        onChange={update}
        onClose={() => setMenu(false)}
      />
    </div>
  );
}
