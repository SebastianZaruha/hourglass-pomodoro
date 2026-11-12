import { Analytics } from '@vercel/analytics/react';
import {
  activeCycleConfig,
  messagesFor,
  resolveLanguage,
  nearestStepIndex,
  sessionCue,
  sessionPlanFor,
  sessionSnapshot,
  stepMinutes,
  stepToDuration,
  type Settings,
  type ThemePreference,
} from '@reloj/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { androidPromoOpen, readAndroidPromoDismissed, writeAndroidPromoDismissed } from './androidApp';
import { AndroidPromo } from './components/AndroidPromo';
import { CookieBanner } from './components/CookieBanner';
import { LegalOverlay } from './components/LegalOverlay';
import { Pausa } from './components/Pausa';
import { SettingsSheet } from './components/SettingsSheet';
import { SiteFooter } from './components/SiteFooter';
import { TimeReadout } from './components/TimeReadout';
import { hintFor } from './copy';
import { Fondo } from './fondo/Fondo';
import { conexionAhorro, prefetchEnReposo, urlsPrefetch } from './medios/assetLoader';
import { Lienzo } from './frasco/Lienzo';
import { useBotonMenu } from './hooks/useBotonMenu';
import { useClockLift } from './hooks/useClockLift';
import { useConsent } from './hooks/useConsent';
import { useMedios } from './hooks/useMediaQuery';
import { useStageInput } from './hooks/useStageInput';
import { useEntrada } from './intro';
import { calcularLayout } from './layout/calcularLayout';
import { ensureNotificationPermission, showPhaseNotification } from './notify';
import { playCue, primeAudio } from './sound';
import { pruebasActivas, publicarCajas } from './pruebas';
import { guardarEscena, leerEscena, modoDe, temaPorId, TEMAS, type IdTema } from './temas';
import { useSession } from './useSession';
import { useSettings, type SettingsPatch } from './useSettings';

type Scheme = 'light' | 'dark';

function resolverEsquema(preferencia: ThemePreference, sistemaOscuro: boolean): Scheme {
  if (preferencia === 'light' || preferencia === 'dark') return preferencia;
  return sistemaOscuro ? 'dark' : 'light';
}

export function App() {
  const { settings, update } = useSettings();
  return <Reloj settings={settings} update={update} />;
}

function Reloj({
  settings,
  update,
}: {
  settings: Settings;
  update: (patch: SettingsPatch | ((current: Settings) => SettingsPatch)) => void;
}) {
  const medios = useMedios();
  const scheme = resolverEsquema(settings.theme, medios.oscuroSistema);
  const [temaId, setTemaId] = useState<IdTema>(() => leerEscena());
  const tema = temaPorId(temaId);
  const modo = modoDe(tema, scheme);
  const lang = resolveLanguage(settings.language, navigator.language);
  const t = messagesFor(settings.language, navigator.language);
  const session = useSession(sessionPlanFor(settings));
  const { replaceIfChanged, getSnapshot, toggle, restart, flip, tick, view, state } = session;
  const consentimiento = useConsent();
  const intro = useEntrada();
  const appRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const suprimirClic = useRef(false);
  const [menu, setMenu] = useState(false);
  const [promoDismissed, setPromoDismissed] = useState(() => readAndroidPromoDismissed());
  const [legal, setLegal] = useState<{ href: string; title: string } | null>(null);
  const pausado = view.status === 'paused';
  const layout = calcularLayout(medios.ancho, medios.alto, menu);
  const alzado = useClockLift(appRef, menu, layout.ancha);
  const boton = useBotonMenu(menu, pausado);

  useEffect(() => {
    replaceIfChanged(sessionPlanFor(settings));
  }, [settings, replaceIfChanged]);

  useEffect(() => {
    const red = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } })
      .connection;
    prefetchEnReposo(urlsPrefetch(TEMAS, tema.id, scheme, medios.ahorro || conexionAhorro(red)));
  }, [tema.id, scheme, medios.ahorro]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.style.colorScheme = scheme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', modo.ui.barra);
  }, [scheme, modo.ui.barra, lang]);

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

  useEffect(() => {
    if (!pausado) return;
    setMenu(false);
    setLegal(null);
  }, [pausado]);

  const doToggle = useCallback(() => {
    primeAudio();
    const status = state.timer.status;
    if (status === 'idle' || status === 'finished') void ensureNotificationPermission();
    toggle();
  }, [state.timer.status, toggle]);

  const onWheel = useCallback(
    (pasos: number) => {
      if (settings.sessionMode === 'cycles') {
        const cycle = activeCycleConfig(settings);
        update({
          sessionMode: 'cycles',
          cyclePreset: 'custom',
          customCycle: { ...cycle, workMin: stepMinutes(cycle.workMin, -pasos) },
        });
      } else {
        update({
          sessionMode: 'single',
          lastDurationMs: stepToDuration(nearestStepIndex(settings.lastDurationMs) - pasos),
        });
      }
    },
    [settings, update],
  );

  const entrada = useStageInput({
    menu,
    legalAbierto: legal !== null,
    intro: intro.blocksInput,
    status: view.status,
    onToggle: doToggle,
    onRestart: restart,
    onCloseMenu: () => setMenu(false),
    onCloseLegal: () => setLegal(null),
    onWheel,
    suprimirClic,
    stageRef,
  });

  const label = useMemo(() => {
    if (view.status === 'finished') return view.isCycle ? t.cyclesDone : t.timeUp;
    if (view.isCycle) return t.phaseLabel(view.kind, view.round, view.rounds);
    return null;
  }, [t, view]);
  const hint = hintFor(view.status, view.isCycle && view.status === 'finished', lang);
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
  const showAndroidPromo = androidPromoOpen({
    settled: intro.settled,
    dismissed: promoDismissed,
    bannerOpen: consentimiento.bannerOpen,
    menuOpen: menu,
    legalOpen: legal !== null,
  });
  const pie = { x: layout.frasco.x + layout.frasco.w / 2, y: layout.frasco.y + layout.frasco.h * 0.979 };
  if (pruebasActivas()) {
    const menuMedido = calcularLayout(medios.ancho, medios.alto, true).menu;
    publicarCajas({
      frasco: layout.frasco,
      reloj: { ...layout.reloj, y: layout.reloj.y - alzado },
      menu: menuMedido,
      botonMenu: layout.botonMenu,
      nube: layout.nube,
    });
  }

  return (
    <div
      ref={appRef}
      className={`app${menu ? ' menu-open' : ''}${pausado ? ' is-paused' : ''}${showAndroidPromo ? ' has-android-promo' : ''}${intro.className ? ` ${intro.className}` : ''}`}
      data-scheme={scheme}
      data-tema={tema.id}
      data-layout={layout.ancha ? 'wide' : 'narrow'}
    >
      {consentimiento.choice === 'accepted' ? <Analytics /> : null}
      <div className={`mundo${tema.nube ? ' con-nube' : ''}`}>
        <Fondo
          modo={modo}
          ancla={tema.anclaSuelo}
          ancho={medios.ancho}
          alto={medios.alto}
          pie={pie}
          reducir={medios.reducir}
          ahorro={medios.ahorro}
          estrecho={!layout.ancha}
        />
        <div
          ref={stageRef}
          className="escenario"
          role="button"
          tabIndex={0}
          aria-label={action}
          aria-keyshortcuts="Space"
          onMouseDown={(event) => {
            if (event.detail > 1) event.preventDefault();
          }}
          onClick={entrada.onClick}
          onDoubleClick={entrada.onDoubleClick}
        >
          <Lienzo
            getSnapshot={getSnapshot}
            luz={modo.luz}
            tipo={tema.contenido}
            granos={modo.granos}
            mostrarNube={tema.nube}
            reducir={medios.reducir}
            ahorro={medios.ahorro}
            layout={layout}
            onVolteo={flip}
            onSuprimirClic={() => {
              suprimirClic.current = true;
            }}
          />
          <div
            className="reloj"
            style={{
              left: layout.reloj.x,
              top: layout.reloj.y - alzado,
              width: layout.reloj.w,
              height: layout.reloj.h,
            }}
          >
            <TimeReadout
              getSnapshot={getSnapshot}
              running={view.status === 'running'}
              label={label}
              hint={pausado ? null : hint}
              describe={describe}
            />
          </div>
        </div>
        <SiteFooter
          lang={lang}
          visible={boton || menu}
          onCookies={() => consentimiento.setBannerOpen(true)}
          onOpenLegal={(href, title) => setLegal({ href, title })}
        />
        {showAndroidPromo ? (
          <AndroidPromo
            lang={lang}
            onDismiss={() => {
              writeAndroidPromoDismissed();
              setPromoDismissed(true);
            }}
          />
        ) : null}
      </div>

      <button
        type="button"
        id="menu-button"
        className={boton ? 'menu-btn is-on' : 'menu-btn'}
        aria-label={t.openSettings}
        aria-expanded={menu}
        hidden={menu || pausado}
        style={{ left: layout.botonMenu.x, top: layout.botonMenu.y, right: 'auto', bottom: 'auto' }}
        onClick={(event) => {
          event.stopPropagation();
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
        temaId={tema.id}
        onTema={(id) => {
          setTemaId(id);
          guardarEscena(id);
        }}
        onChange={update}
        onClose={() => setMenu(false)}
        caja={calcularLayout(medios.ancho, medios.alto, true).menu}
      />
      {pausado ? <Pausa pista={hint} /> : null}
      <CookieBanner
        open={consentimiento.bannerOpen}
        lang={lang}
        onChoose={consentimiento.choose}
        onOpenLegal={(href, title) => setLegal({ href, title })}
      />
      {legal ? (
        <LegalOverlay
          src={legal.href}
          title={legal.title}
          onClose={() => setLegal(null)}
          onConfigure={() => consentimiento.setBannerOpen(true)}
        />
      ) : null}
    </div>
  );
}
