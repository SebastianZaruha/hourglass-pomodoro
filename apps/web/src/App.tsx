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
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import { androidPromoOpen, readAndroidPromoDismissed, writeAndroidPromoDismissed } from './androidApp';
import { AndroidPromo } from './components/AndroidPromo';
import { CookieBanner } from './components/CookieBanner';
import { LegalOverlay } from './components/LegalOverlay';
import { Pausa } from './components/Pausa';
import { SettingsSheet } from './components/SettingsSheet';
import './components/Tooltip.css';
import { SiteFooter } from './components/SiteFooter';
import { TimeReadout } from './components/TimeReadout';
import { aplicarTema } from './estilo/aplicarTema';
import { hintFor } from './copy';
import { Fondo } from './fondo/Fondo';
import { conexionAhorro, prefetchEnReposo, urlsPrefetch } from './medios/assetLoader';
import { Lienzo } from './frasco/Lienzo';
import { useAutoocultar } from './hooks/useAutoocultar';
import { useConsent } from './hooks/useConsent';
import { useMedidas } from './hooks/useMedidas';
import { useMedios } from './hooks/useMediaQuery';
import { useStageInput } from './hooks/useStageInput';
import { useEntrada } from './intro';
import { calcularLayout } from './layout/calcularLayout';
import { ensureNotificationPermission, showPhaseNotification } from './notify';
import { playCue, primeAudio } from './sound';
import { pruebasActivas, publicarCajas } from './pruebas';
import { giroArranca, ruedaGiraFrasco, vueltaArranca } from './stageClick';
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
  const menuRef = useRef<HTMLDivElement>(null);
  const avisoRef = useRef<HTMLDivElement>(null);
  const pieRef = useRef<HTMLElement>(null);
  const sondaRef = useRef<HTMLDivElement>(null);
  const suprimirClic = useRef(false);
  const [menu, setMenu] = useState(false);
  const [promoDismissed, setPromoDismissed] = useState(() => readAndroidPromoDismissed());
  const [legal, setLegal] = useState<{ href: string; title: string } | null>(null);
  const pausado = view.status === 'paused';
  const [vuelta, setVuelta] = useState(0);
  const [contenidoFijo, setContenidoFijo] = useState<{
    durationMs: number;
    remainingMs: number;
  } | null>(null);
  const empezarVuelta = useCallback(() => {
    if (state.timer.status === 'paused') return;
    const snap = getSnapshot();
    setContenidoFijo({ durationMs: snap.durationMs, remainingMs: snap.remainingMs });
    setVuelta((v) => v + 1);
  }, [getSnapshot, state.timer.status]);
  const avisoAndroid = androidPromoOpen({
    settled: intro.settled,
    dismissed: promoDismissed,
    bannerOpen: consentimiento.bannerOpen,
    menuOpen: menu,
    legalOpen: legal !== null,
  });
  const medidas = useMedidas({ menu: menuRef, aviso: avisoRef, pie: pieRef, sonda: sondaRef });
  const medidasDe = (menuAbierto: boolean) => ({
    ancho: medidas.ancho,
    alto: medidas.alto,
    menuAbierto,
    altoMenu: medidas.altoMenu,
    altoAviso: menuAbierto || !avisoAndroid ? 0 : medidas.altoAviso,
    altoPie: medidas.altoPie,
    margenSeguro: medidas.margenSeguro,
    digitos: medidas.digitos,
    relojCentrado: tema.relojCentrado,
  });
  const layout = calcularLayout(medidasDe(menu));
  const menuLayout = menu ? layout : calcularLayout(medidasDe(true));
  const chrome = useAutoocultar(menu);

  useEffect(() => {
    replaceIfChanged(sessionPlanFor(settings));
  }, [settings, replaceIfChanged]);

  useEffect(() => {
    const red = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } })
      .connection;
    prefetchEnReposo(urlsPrefetch(TEMAS, tema.id, scheme, medios.ahorro || conexionAhorro(red)));
  }, [tema.id, scheme, medios.ahorro]);

  useLayoutEffect(() => {
    const nodo = appRef.current;
    if (nodo) aplicarTema(nodo, modo, scheme);
  }, [modo, scheme]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

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
      if (ruedaGiraFrasco()) empezarVuelta();
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
    [settings, update, empezarVuelta],
  );

  const entrada = useStageInput({
    menu,
    legalAbierto: legal !== null,
    intro: intro.blocksInput,
    status: view.status,
    onToggle: doToggle,
    onRestart: () => {
      empezarVuelta();
      if (vueltaArranca()) flip();
      restart();
    },
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
  const pie = { x: layout.frasco.x + layout.frasco.w / 2, y: layout.frasco.y + layout.frasco.h * 0.979 };
  if (pruebasActivas()) {
    publicarCajas({
      frasco: layout.frasco,
      reloj: layout.reloj,
      menu: layout.menu,
      botonMenu: layout.botonMenu,
      nube: layout.nube,
    });
  }
  const horaPx = {
    '--hora-px': `${layout.horaPx}px`,
    '--alto-pie': `${medidas.altoPie}px`,
  } as CSSProperties;

  return (
    <div
      ref={appRef}
      className={`app${menu ? ' menu-open' : ''}${pausado ? ' is-paused' : ''}${avisoAndroid ? ' has-android-promo' : ''}${intro.className ? ` ${intro.className}` : ''}`}
      data-scheme={scheme}
      data-tema={tema.id}
      data-layout={layout.ancha ? 'wide' : 'narrow'}
      style={horaPx}
    >
      <div ref={sondaRef} className="sonda-segura" aria-hidden="true" />
      {consentimiento.choice === 'accepted' ? <Analytics /> : null}
      <div className={`mundo${tema.nube ? ' con-nube' : ''}${pausado ? ' pausado' : ''}`}>
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
          className={menu ? 'escenario menu-abierto' : 'escenario'}
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
            enMarcha={view.status === 'running'}
            reducir={medios.reducir}
            ahorro={medios.ahorro}
            layout={layout}
            oculto={!layout.frascoVisible}
            pausado={pausado}
            vuelta={vuelta}
            contenidoFijo={contenidoFijo}
            onVueltaLista={() => setContenidoFijo(null)}
            onVolteo={() => {
              if (giroArranca(getSnapshot().status)) flip();
            }}
            onSuprimirClic={() => {
              suprimirClic.current = true;
            }}
          />
          <div
            className={layout.relojVisible ? 'reloj' : 'reloj reloj-oculto'}
            style={{
              left: layout.reloj.x,
              top: layout.reloj.y,
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
        {avisoAndroid ? (
          <AndroidPromo
            lang={lang}
            pausado={pausado}
            nodoRef={avisoRef}
            onDismiss={() => {
              writeAndroidPromoDismissed();
              setPromoDismissed(true);
            }}
          />
        ) : null}
      </div>
      <SiteFooter
        lang={lang}
        visible={chrome}
        oculto={menu && !layout.ancha}
        pieRef={pieRef}
        top={layout.pie.y}
        onCookies={() => consentimiento.setBannerOpen(true)}
        onOpenLegal={(href, title) => setLegal({ href, title })}
      />

      <button
        type="button"
        id="menu-button"
        className={chrome ? 'menu-btn ayuda is-on' : 'menu-btn ayuda'}
        aria-label={t.openSettings}
        aria-expanded={menu}
        hidden={menu}
        style={{
          left: layout.botonMenu.x,
          top: layout.botonMenu.y,
          width: layout.botonMenu.w,
          height: layout.botonMenu.h,
          right: 'auto',
          bottom: 'auto',
        }}
        onClick={(event) => {
          event.stopPropagation();
          setMenu(true);
        }}
      >
        <span className="bar long" />
        <span className="bar short" />
        <span className="ayuda-texto" role="tooltip">
          {t.openSettings}
        </span>
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
        onChange={(patch) => {
          const plano = typeof patch === 'function' ? patch(settings) : patch;
          if (
            plano.lastDurationMs !== undefined ||
            plano.sessionMode !== undefined ||
            plano.cyclePreset !== undefined ||
            plano.customCycle !== undefined
          ) {
            empezarVuelta();
            if (vueltaArranca()) flip();
          }
          update(patch);
        }}
        onClose={() => setMenu(false)}
        caja={menuLayout.menu}
        estrecho={!layout.ancha}
        scroll={menuLayout.menuConScroll}
        hojaRef={menuRef}
      />
      {pausado ? <Pausa pista={hint} /> : null}
      <CookieBanner
        open={consentimiento.bannerOpen}
        lang={lang}
        nodoRef={avisoRef}
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
