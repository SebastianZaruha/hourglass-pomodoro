// Frasco de vidrio 3D en tiempo real (Three.js, MeshPhysicalMaterial con transmission).
// Un solo lienzo WebGL pinta: el fondo (encuadrado igual que el DOM de Hourglass), la sombra
// de contacto, la hoja del contenido (arena/agua) dentro del vidrio y el vidrio encima.
import {
  Color, DirectionalLight, Group, LinearFilter, Mesh, MeshPhysicalMaterial, NoToneMapping, PerspectiveCamera,
  PlaneGeometry, PMREMGenerator, SRGBColorSpace, Scene, ShaderMaterial, Texture, CanvasTexture, TextureLoader,
  Vector2, Vector4, WebGLRenderer, type WebGLRenderTarget, FrontSide,
} from 'three';
import { BASE_BULBO, BASE_OPACA, CUELLO_FILA, FOTO_ALTO, FOTO_ANCHO, cajaFoto, encuadreFondo, layoutFor, yEnFoto, type Caja } from './encuadre';
import { crearEntorno, type Modo } from './entorno';
import { crearGeometriaFrasco } from './geometria';
import type { Calidad, Contenido, Fondo, Frasco3D, OpcionesFrasco3D } from './tipos';

// transmision: resolución de la pasada de refracción en px CSS (no en px físicos). Lo que se ve
// a través del vidrio (arena, agua) sale de esa pasada: por debajo de ~0,7 px CSS se emborrona.
interface Nivel { dpr: number; transmision: number; hoja: number; segmentos: number; dispersion: number }
export const NIVELES: Record<Calidad, Nivel> = {
  alto: { dpr: 2, transmision: 2, hoja: 2, segmentos: 128, dispersion: 0.12 },
  medio: { dpr: 1.5, transmision: 1, hoja: 1.5, segmentos: 96, dispersion: 0 },
  bajo: { dpr: 1, transmision: 0.7, hoja: 1, segmentos: 64, dispersion: 0 },
};
const ORDEN: Calidad[] = ['alto', 'medio', 'bajo'];
const FOV = 14;
const MAX_INCLINACION = (8 * Math.PI) / 180;

// Vidrio por modo. Sin color encima: el blanco es identidad; el color sale de attenuation,
// Fresnel (ior) y el entorno.
// distancia: en múltiplos del grosor de pared (así el tinte no depende del tamaño en pantalla).
const VIDRIO: Record<Modo, { env: number; atenuacion: string; distancia: number; especular: number }> = {
  claro: { env: 1.0, atenuacion: '#dde6e8', distancia: 14, especular: 1 },
  oscuro: { env: 1.3, atenuacion: '#e2e9ea', distancia: 16, especular: 1 },
};
const GROSOR = 16; // px de la foto (≈ la pared real: 211−196 a 446)
const SOMBRA: Record<Modo, { r: number; g: number; b: number; a: number }> = {
  claro: { r: 84, g: 64, b: 44, a: 0.28 },
  oscuro: { r: 0, g: 0, b: 0, a: 0.38 },
};

const GLSL_FONDO = /* glsl */ `
uniform sampler2D uFondoA; uniform sampler2D uFondoB;
uniform vec4 uCajaA; uniform vec4 uCajaB; uniform float uMezcla; uniform float uHayA; uniform float uHayB;
uniform vec2 uVista; uniform vec3 uReserva;
uniform vec2 uSombraPos; uniform vec2 uSombraRad; uniform vec4 uSombraCol;
vec3 muestraFondo(sampler2D t, vec4 c, float hay, vec2 px) {
  vec2 uv = vec2((px.x - c.x) / c.z, 1.0 - (px.y - c.y) / c.w);
  return mix(uReserva, texture2D(t, clamp(uv, 0.0, 1.0)).rgb, hay);
}
vec3 fondoEn(vec2 px) {
  vec3 c = mix(muestraFondo(uFondoA, uCajaA, uHayA, px), muestraFondo(uFondoB, uCajaB, uHayB, px), uMezcla);
  vec2 d = (px - uSombraPos) / uSombraRad;
  float ancha = 1.0 - smoothstep(0.0, 1.0, length(d));
  float nucleo = 1.0 - smoothstep(0.0, 0.42, length(d * vec2(1.25, 1.9)));
  float s = clamp(ancha * ancha * 0.8 + nucleo * 0.55, 0.0, 1.0) * uSombraCol.a;
  return mix(c, uSombraCol.rgb, s);
}
vec2 pxDeNdc(vec2 ndc) { return vec2((ndc.x * 0.5 + 0.5) * uVista.x, (0.5 - ndc.y * 0.5) * uVista.y); }
`;

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const suave3 = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const envolver = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

function tamFuente(f: HTMLImageElement | HTMLVideoElement): [number, number] {
  return f instanceof HTMLVideoElement ? [f.videoWidth, f.videoHeight] : [f.naturalWidth, f.naturalHeight];
}
function fuenteLista(f: HTMLImageElement | HTMLVideoElement): boolean {
  // Un vídeo cuenta cuando ya ha avanzado: algunos navegadores dan readyState 2 con el frame en negro.
  return f instanceof HTMLVideoElement ? f.readyState >= 2 && f.videoWidth > 0 && f.currentTime > 0 : f.complete && f.naturalWidth > 0;
}

export function crearFrasco3D(canvas: HTMLCanvasElement, opciones: OpcionesFrasco3D): Frasco3D {
  const o = { calidad: 'auto' as Calidad | 'auto', modo: 'claro' as Modo, reposo: 'libre' as 'libre' | 'vertical', balanceo: true, mediaVueltaMs: 900, fpsVideo: 30, interaccion: true, ...opciones };
  const consulta = matchMedia('(prefers-reduced-motion: reduce)');
  let reducido = consulta.matches;
  const alMovimiento = () => { reducido = consulta.matches; };
  consulta.addEventListener('change', alMovimiento);

  let calidad: Calidad = o.calidad === 'auto' ? 'alto' : o.calidad;
  let auto = o.calidad === 'auto';
  // El antialias se decide al crear el contexto (no se puede cambiar luego).
  // Con DPR ≥ 2 (móviles) el MSAA cuesta mucho y casi no se nota: va sin él.
  const antialias = o.antialias ?? (o.calidad !== 'bajo' && (window.devicePixelRatio || 1) < 2);
  const renderer = new WebGLRenderer({ canvas, antialias, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NoToneMapping; // el fondo sale idéntico al DOM
  const pmrem = new PMREMGenerator(renderer);
  canvas.style.opacity = '0';
  canvas.style.transition = 'opacity 260ms ease';
  canvas.style.touchAction = 'none';

  const escena = new Scene();
  const camara = new PerspectiveCamera(FOV, 1, 1, 10);
  const luz = new DirectionalLight(0xffffff, 1.2);
  luz.position.set(-0.5, 0.8, 1);
  escena.add(luz);

  // ── Uniformes compartidos por el fondo y la hoja interior ──
  const U = {
    uFondoA: { value: null as Texture | null }, uFondoB: { value: null as Texture | null },
    uCajaA: { value: new Vector4(0, 0, 1, 1) }, uCajaB: { value: new Vector4(0, 0, 1, 1) },
    uHayA: { value: 0 }, uHayB: { value: 0 }, uMezcla: { value: 0 },
    uVista: { value: new Vector2(1, 1) }, uReserva: { value: new Color(0.5, 0.5, 0.5) },
    uSombraPos: { value: new Vector2() }, uSombraRad: { value: new Vector2(1, 1) }, uSombraCol: { value: new Vector4(0, 0, 0, 0) },
  };

  const matFondo = new ShaderMaterial({
    uniforms: U, depthTest: false, depthWrite: false,
    vertexShader: `varying vec2 vNdc; void main(){ vNdc = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `${GLSL_FONDO}
      varying vec2 vNdc;
      void main(){
        gl_FragColor = vec4(fondoEn(pxDeNdc(vNdc)), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const fondoMesh = new Mesh(new PlaneGeometry(2, 2), matFondo);
  fondoMesh.frustumCulled = false;
  fondoMesh.renderOrder = -1000;
  escena.add(fondoMesh);

  // ── Hoja del contenido: canvas en coordenadas de cajaFoto ──
  const hoja = document.createElement('canvas');
  hoja.width = hoja.height = 2;
  const ctxHoja = hoja.getContext('2d')!;
  let texHoja: CanvasTexture = new CanvasTexture(hoja);
  texHoja.colorSpace = SRGBColorSpace;
  texHoja.generateMipmaps = false;
  texHoja.minFilter = LinearFilter;
  const texMascara = new TextureLoader().load(o.mascara);
  const UH = { ...U, uHoja: { value: texHoja as Texture }, uMascara: { value: texMascara }, uHayHoja: { value: 0 } };
  const matHoja = new ShaderMaterial({
    uniforms: UH,
    vertexShader: `varying vec2 vUv; varying vec3 vClip;
      void main(){ vUv = uv; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); vClip = p.xyw; gl_Position = p; }`,
    fragmentShader: `${GLSL_FONDO}
      uniform sampler2D uHoja; uniform sampler2D uMascara; uniform float uHayHoja;
      varying vec2 vUv; varying vec3 vClip;
      void main(){
        if (texture2D(uMascara, vUv).g < 0.5) discard;
        vec3 f = fondoEn(pxDeNdc(vClip.xy / vClip.z));
        vec4 h = texture2D(uHoja, vUv);
        gl_FragColor = vec4(mix(f, h.rgb, h.a * uHayHoja), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const plano = new Mesh(new PlaneGeometry(FOTO_ANCHO, FOTO_ALTO), matHoja);
  plano.position.y = CUELLO_FILA - FOTO_ALTO / 2;

  // ── Vidrio ──
  const vidrio = new MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.015, transmission: 1, ior: 1.5, thickness: 16,
    specularIntensity: 1, specularColor: 0xffffff, clearcoat: 0, clearcoatRoughness: 0.04,
    side: FrontSide,
  });
  // Grosor real de una pared hueca: el rayo cruza la pared en diagonal, así que el camino
  // crece hacia la silueta (1/cos). Eso da más refracción y más tinte (attenuation) en los
  // bordes y casi nada en el centro: el color sale del grosor, no de una capa encima.
  vidrio.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      'vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );',
      'vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );\n\tmaterial.thickness = thickness / max( abs( dot( n, v ) ), 0.16 );',
    );
  };
  const malla = new Mesh(crearGeometriaFrasco(NIVELES[calidad].segmentos), vidrio);
  malla.renderOrder = 1;

  const raiz = new Group(); // en el cuello, en px del lienzo
  const inclina = new Group(); // balanceo 3D
  const giro = new Group(); // rotación z
  const escala = new Group(); // px de la foto → px CSS
  escala.add(plano, malla);
  giro.add(escala);
  inclina.add(giro);
  raiz.add(inclina);
  escena.add(raiz);

  // ── Estado ──
  let vw = 1, vh = 1, dpr = 1;
  let caja: Caja = { x: 0, y: 0, w: 1, h: 1 }, foto: Caja = caja;
  const pivote = { x: 0, y: 0 };
  let angulo = 0, omega = 0, inclX = 0, inclY = 0, vInclX = 0, vInclY = 0;
  let arrastre: { id: number; phi: number; t: number } | null = null;
  let vuelta: { t0: number; desde: number; hasta: number; dur: number } | null = null;
  let modo: Modo = o.modo;
  let fondo: Fondo | null = null;
  let fondoPrevio: Fondo | null = null;
  let mezclaT0 = 0;
  let contenido: Contenido | null = null;
  let entornoRT: WebGLRenderTarget | null = null;
  let listo = false, vivo = true, raf = 0, previo = performance.now();
  // Hourglass: el frasco se oculta mientras la intro 2D lo pinta (sin vidrio, contenido ni sombra).
  let frascoVisible = true;
  let ultimaCopiaVideo = 0, ultimoTiempoVideo = -1;
  let medioPintado: HTMLImageElement | HTMLVideoElement | null = null;
  const tiempos = new Float32Array(240);
  let nTiempos = 0, framesNivel = 0;

  function aplicarNivel() {
    const n = NIVELES[calidad];
    dpr = Math.min(window.devicePixelRatio || 1, n.dpr);
    renderer.setPixelRatio(dpr);
    renderer.setSize(vw, vh, false);
    renderer.transmissionResolutionScale = Math.min(1, n.transmision / dpr);
    vidrio.dispersion = n.dispersion;
    const g = crearGeometriaFrasco(n.segmentos);
    malla.geometry.dispose();
    malla.geometry = g;
    redimensionarHoja();
    o.alCalidad?.(calidad);
  }

  function redimensionarHoja() {
    const res = Math.min(window.devicePixelRatio || 1, NIVELES[calidad].hoja);
    const w = Math.max(2, Math.round(foto.w * res)), h = Math.max(2, Math.round(foto.h * res));
    if (hoja.width !== w || hoja.height !== h) {
      hoja.width = w; hoja.height = h;
      // Una textura nueva: three no reasigna almacenamiento si cambia el tamaño del canvas.
      texHoja.dispose();
      texHoja = new CanvasTexture(hoja);
      texHoja.colorSpace = SRGBColorSpace;
      texHoja.generateMipmaps = false;
      texHoja.minFilter = LinearFilter;
      if (!contenido || contenido.tipo !== 'canvas') UH.uHoja.value = texHoja;
    }
  }

  function recolocar() {
    caja = o.caja ?? layoutFor(vw, vh);
    foto = cajaFoto(caja);
    const sx = foto.w / FOTO_ANCHO, sy = foto.h / FOTO_ALTO;
    pivote.x = foto.x + foto.w / 2;
    pivote.y = foto.y + CUELLO_FILA * sy;
    escala.scale.set(sx, sy, sx);
    raiz.position.set(pivote.x - vw / 2, vh / 2 - pivote.y, 0);
    const d = vh / 2 / Math.tan((FOV * Math.PI) / 360);
    camara.aspect = vw / vh;
    camara.position.set(0, 0, d);
    camara.near = Math.max(1, d - 4000);
    camara.far = d + 4000;
    camara.updateProjectionMatrix();
    vidrio.thickness = GROSOR; // px de la foto; three lo escala con la malla
    vidrio.attenuationDistance = GROSOR * sx * VIDRIO[modo].distancia;
    U.uVista.value.set(vw, vh);
    // Sombra de contacto: donde apoya la base opaca.
    U.uSombraPos.value.set(caja.x + caja.w / 2, yEnFoto(caja, BASE_OPACA) - caja.h * 0.004);
    U.uSombraRad.value.set(caja.w * 0.47, caja.h * 0.03);
    encuadrar();
    redimensionarHoja();
    o.alCaja?.(caja, foto);
  }

  /** Lo que se pinta: el vídeo si ya corre; si no, su póster. */
  function medioDe(f: Fondo): HTMLImageElement | HTMLVideoElement {
    return !fuenteLista(f.fuente) && f.poster && fuenteLista(f.poster) ? f.poster : f.fuente;
  }
  function cajaFondoDe(f: Fondo): Caja | null {
    const m = medioDe(f);
    if (!fuenteLista(m)) return null;
    const [iw, ih] = tamFuente(m);
    const pie = { x: caja.x + caja.w / 2, y: yEnFoto(caja, f.pie === 'bulbo' ? BASE_BULBO : BASE_OPACA) };
    return encuadreFondo(vw, vh, iw, ih, f.ancla, pie);
  }

  const texturas = new WeakMap<object, Texture>();
  function texturaDe(f: Fondo): Texture {
    const m = medioDe(f);
    let t = texturas.get(m);
    if (!t) {
      // three mide un vídeo por width/height (atributos, 0 por defecto): se los damos.
      if (m instanceof HTMLVideoElement) { m.width = m.videoWidth; m.height = m.videoHeight; }
      t = new Texture(m);
      t.colorSpace = SRGBColorSpace;
      t.generateMipmaps = false;
      t.minFilter = LinearFilter;
      texturas.set(m, t);
    }
    return t;
  }

  function encuadrar() {
    const pon = (f: Fondo | null, caj: Vector4, hay: { value: number }, tex: { value: Texture | null }) => {
      const c = f && cajaFondoDe(f);
      if (!f || !c) { hay.value = 0; return; }
      caj.set(c.x, c.y, c.w, c.h);
      const t = texturaDe(f);
      if (tex.value !== t || hay.value === 0) t.needsUpdate = true;
      tex.value = t;
      hay.value = 1;
    };
    pon(fondoPrevio, U.uCajaA.value, U.uHayA, U.uFondoA);
    pon(fondo, U.uCajaB.value, U.uHayB, U.uFondoB);
  }

  function rehacerEntorno() {
    if (!fondo) return;
    const fuente = fondo.poster ?? (fondo.fuente instanceof HTMLImageElement ? fondo.fuente : null);
    if (fuente && !(fuente.complete && fuente.naturalWidth > 0)) return;
    const viejo = entornoRT;
    entornoRT = crearEntorno(renderer, pmrem, { fuente, modo, estudio: !!fondo.estudio, tinte: fondo.tinte });
    escena.environment = entornoRT.texture;
    viejo?.dispose();
  }

  function aplicarModo() {
    const v = VIDRIO[modo];
    vidrio.envMapIntensity = v.env;
    vidrio.attenuationColor.set(v.atenuacion);
    vidrio.attenuationDistance = GROSOR * (foto.w / FOTO_ANCHO) * v.distancia;
    vidrio.specularIntensity = v.especular;
    luz.intensity = modo === 'oscuro' ? 0.5 : 1.2;
    const s = fondo?.sombra ?? SOMBRA[modo];
    U.uSombraCol.value.set(lin(s.r / 255), lin(s.g / 255), lin(s.b / 255), s.a);
    rehacerEntorno();
  }

  function redimensionar() {
    const r = canvas.getBoundingClientRect();
    vw = Math.max(1, r.width); vh = Math.max(1, r.height);
    renderer.setSize(vw, vh, false);
    recolocar();
  }

  // ── Puntero: girar sobre el cuello, inercia, doble clic/toque = media vuelta ──
  function local(e: PointerEvent): { x: number; y: number } {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function tocaFrasco(p: { x: number; y: number }): boolean {
    const dx = p.x - pivote.x, dy = p.y - pivote.y;
    const c = Math.cos(-angulo), s = Math.sin(-angulo);
    const qx = dx * c - dy * s, qy = dx * s + dy * c;
    const sy = foto.h / FOTO_ALTO;
    return Math.abs(qx) < foto.w * 0.52 && qy > -CUELLO_FILA * sy - 12 && qy < (FOTO_ALTO - CUELLO_FILA) * sy + 12;
  }
  let ultimoToque = { t: 0, x: 0, y: 0 };
  const bajar = (e: PointerEvent) => {
    const p = local(e);
    if (!tocaFrasco(p)) return;
    // Doble toque (táctil y lápiz). El ratón usa dblclick.
    if (e.pointerType !== 'mouse') {
      if (e.timeStamp - ultimoToque.t < 320 && Math.hypot(p.x - ultimoToque.x, p.y - ultimoToque.y) < 30) { mediaVuelta(); ultimoToque.t = 0; return; }
      ultimoToque = { t: e.timeStamp, x: p.x, y: p.y };
    }
    if (vuelta) return;
    arrastre = { id: e.pointerId, phi: Math.atan2(p.y - pivote.y, p.x - pivote.x), t: e.timeStamp };
    omega = 0;
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const mover = (e: PointerEvent) => {
    if (!arrastre || e.pointerId !== arrastre.id) return;
    const p = local(e);
    const r = Math.hypot(p.x - pivote.x, p.y - pivote.y);
    const phi = Math.atan2(p.y - pivote.y, p.x - pivote.x);
    const dt = Math.max(1, e.timeStamp - arrastre.t) / 1000;
    // Cerca del cuello el ángulo del puntero salta: ahí no se gira.
    if (r > 28) {
      const d = envolver(phi - arrastre.phi);
      angulo += d;
      omega = omega * 0.6 + (d / dt) * 0.4;
      o.alGirar?.(angulo);
    }
    arrastre.phi = phi;
    arrastre.t = e.timeStamp;
  };
  const soltar = (e: PointerEvent) => {
    if (!arrastre || e.pointerId !== arrastre.id) return;
    if (e.timeStamp - arrastre.t > 90) omega = 0; // parado antes de soltar
    omega = Math.max(-14, Math.min(14, omega));
    arrastre = null;
  };
  const dobleClic = (e: MouseEvent) => {
    const r = canvas.getBoundingClientRect();
    if (tocaFrasco({ x: e.clientX - r.left, y: e.clientY - r.top })) mediaVuelta();
  };
  if (o.interaccion) {
    canvas.addEventListener('pointerdown', bajar);
    canvas.addEventListener('pointermove', mover);
    canvas.addEventListener('pointerup', soltar);
    canvas.addEventListener('pointercancel', soltar);
    canvas.addEventListener('dblclick', dobleClic);
  }

  function mediaVuelta() {
    if (vuelta) return;
    const base = Math.round(angulo / Math.PI) * Math.PI;
    const hasta = base + Math.PI;
    arrastre = null;
    if (reducido) { angulo = hasta; omega = 0; o.alGirar?.(angulo); return; }
    vuelta = { t0: performance.now(), desde: angulo, hasta, dur: o.mediaVueltaMs };
  }

  // Hourglass: con `interaccion: false` el ángulo lo manda la app en cada frame; su velocidad
  // (rad/s) solo alimenta el balanceo 3D, nunca mueve el ángulo por su cuenta.
  function girar(a: number, animado = false, velocidad = 0) {
    arrastre = null;
    if (!animado || reducido) { angulo = a; omega = reducido ? 0 : velocidad; vuelta = null; o.alGirar?.(angulo); return; }
    vuelta = { t0: performance.now(), desde: angulo, hasta: a, dur: o.mediaVueltaMs };
  }

  // ── Bucle ──
  function paso(ahora: number) {
    const dtReal = (ahora - previo) / 1000;
    const dt = Math.min(1 / 30, Math.max(0.001, dtReal));
    previo = ahora;

    if (vuelta) {
      const p = Math.min(1, (ahora - vuelta.t0) / vuelta.dur);
      const a = vuelta.desde + (vuelta.hasta - vuelta.desde) * suave3(p);
      omega = (a - angulo) / dt;
      angulo = a;
      if (p >= 1) { angulo = vuelta.hasta; omega = 0; vuelta = null; }
      o.alGirar?.(angulo);
    } else if (!o.interaccion) {
      // Hourglass manda el ángulo: aquí solo se apaga la velocidad que alimenta el balanceo.
      omega *= Math.exp(-8 * dt);
      if (Math.abs(omega) < 0.005) omega = 0;
    } else if (!arrastre) {
      if (reducido) {
        omega = 0;
        if (o.reposo === 'vertical') angulo = Math.round(angulo / Math.PI) * Math.PI;
      } else if (o.reposo === 'vertical') {
        // Muelle críticamente amortiguado: parte de la velocidad que traía, sin salto.
        const meta = Math.round(angulo / Math.PI) * Math.PI;
        const k = 38, c = 2 * Math.sqrt(k);
        omega += (k * (meta - angulo) - c * omega) * dt;
        angulo += omega * dt;
        if (Math.abs(meta - angulo) < 1e-4 && Math.abs(omega) < 1e-3) { angulo = meta; omega = 0; }
      } else {
        omega *= Math.exp(-3.2 * dt);
        if (Math.abs(omega) < 0.005) omega = 0;
        angulo += omega * dt;
      }
      if (omega !== 0) o.alGirar?.(angulo);
    }

    // Balanceo 3D: muelle algo subamortiguado que sigue a la velocidad de giro.
    const conBalanceo = o.balanceo && !reducido;
    const metaY = conBalanceo ? Math.max(-MAX_INCLINACION, Math.min(MAX_INCLINACION, -omega * 0.05)) : 0;
    const metaX = conBalanceo ? Math.min(MAX_INCLINACION * 0.4, Math.abs(omega) * 0.015) : 0;
    const kI = 70, cI = 2 * Math.sqrt(kI) * 0.55;
    vInclY += (kI * (metaY - inclY) - cI * vInclY) * dt; inclY += vInclY * dt;
    vInclX += (kI * (metaX - inclX) - cI * vInclX) * dt; inclX += vInclX * dt;
    if (!conBalanceo) { inclX = inclY = vInclX = vInclY = 0; }
    inclina.rotation.set(inclX, inclY, 0);
    giro.rotation.z = -angulo;

    // Sombra: se apaga al tumbarse (a 180° vuelve: el frasco apoya en la otra base).
    const cs = Math.cos(angulo);
    const s = fondo?.sombra ?? SOMBRA[modo];
    U.uSombraCol.value.w = frascoVisible ? s.a * Math.max(0, (Math.abs(cs) - 0.6) / 0.4) ** 1.5 : 0;

    // Fondo: carga, fundido y vídeo con tope de fps.
    if (fondo) {
      const medio = medioDe(fondo);
      if (medio !== medioPintado) { if (fuenteLista(medio)) { encuadrar(); rehacerEntorno(); medioPintado = medio; } }
      const v = medio;
      if (v instanceof HTMLVideoElement && U.uHayB.value && v.currentTime !== ultimoTiempoVideo && ahora - ultimaCopiaVideo >= 1000 / o.fpsVideo - 2) {
        texturaDe(fondo).needsUpdate = true;
        ultimoTiempoVideo = v.currentTime; ultimaCopiaVideo = ahora;
      }
      if (fondoPrevio) {
        const m = reducido ? 1 : Math.min(1, (ahora - mezclaT0) / 360);
        U.uMezcla.value = U.uHayB.value ? m : 0;
        if (m >= 1 && U.uHayB.value) { fondoPrevio = null; U.uHayA.value = 0; U.uMezcla.value = 1; }
      } else U.uMezcla.value = 1;
    }

    // Contenido en la hoja.
    if (contenido && frascoVisible) pintarContenido(dt);

    renderer.render(escena, camara);

    if (!listo && U.uHayB.value) {
      listo = true;
      canvas.style.opacity = '1';
      o.alListo?.();
    }
    medir(dtReal * 1000);
    if (vivo) raf = requestAnimationFrame(paso);
  }

  function pintarContenido(dt: number) {
    const c = contenido!;
    if (c.tipo === 'canvas') { (UH.uHoja.value as Texture).needsUpdate = true; return; }
    const res = hoja.width / foto.w;
    ctxHoja.setTransform(1, 0, 0, 1, 0, 0);
    ctxHoja.clearRect(0, 0, hoja.width, hoja.height);
    if (c.tipo === 'frasco') {
      ctxHoja.setTransform(res, 0, 0, res, 0, 0);
      c.pintar(ctxHoja, { x: 0, y: 0, w: foto.w, h: foto.h }, dt * 1000);
    } else {
      // mundo → hoja: hoja = S(res)·T(pivote en la hoja)·R(−ángulo)·T(−pivote)
      const co = Math.cos(-angulo), si = Math.sin(-angulo);
      const px = foto.w / 2, py = pivote.y - foto.y;
      const a = res * co, b = res * si, cc = -res * si, d = res * co;
      const e = res * (px - (co * pivote.x - si * pivote.y));
      const f = res * (py - (si * pivote.x + co * pivote.y));
      ctxHoja.setTransform(a, b, cc, d, e, f);
      const cf = fondo ? cajaFondoDe(fondo) : null;
      c.pintar(ctxHoja, { angulo, pivote: { ...pivote }, cajaFoto: foto, cajaFondo: cf ?? { x: 0, y: 0, w: vw, h: vh }, dt: dt * 1000 });
    }
    texHoja.needsUpdate = true;
  }

  // Autocalidad: 0,6 s de calentamiento y luego al menos 1,5 s y 24 frames (o 90 frames).
  // Si la media pasa de 19,6 ms (~51 fps) baja un nivel y vuelve a medir. Nunca sube.
  let tNivel = performance.now(), sumaNivel = 0;
  function medir(ms: number) {
    tiempos[nTiempos++ % tiempos.length] = ms;
    if (!auto) return;
    const t = performance.now() - tNivel;
    if (t < 600) return;
    framesNivel++;
    sumaNivel += ms;
    if (framesNivel < 90 && (t < 2100 || framesNivel < 24)) return;
    const media = sumaNivel / framesNivel;
    const i = ORDEN.indexOf(calidad);
    if (media > 19.6 && i < ORDEN.length - 1) { calidad = ORDEN[i + 1]!; aplicarNivel(); reiniciarMedida(); }
    else auto = false;
  }
  function reiniciarMedida() { framesNivel = 0; sumaNivel = 0; tNivel = performance.now(); }

  const obs = new ResizeObserver(() => redimensionar());
  obs.observe(canvas);
  redimensionar();
  aplicarNivel();
  aplicarModo();
  raf = requestAnimationFrame(paso);

  return {
    setFondo(f) {
      if (f.reserva) U.uReserva.value.set(f.reserva);
      if (fondo && f.fuente === fondo.fuente) { fondo = f; encuadrar(); aplicarModo(); return; }
      if (fondo && U.uHayB.value) { fondoPrevio = fondo; mezclaT0 = performance.now(); }
      fondo = f;
      ultimoTiempoVideo = -1;
      medioPintado = null;
      U.uHayB.value = 0;
      if (f.fuente instanceof HTMLVideoElement) f.fuente.play().catch(() => {});
      f.poster?.addEventListener('load', rehacerEntorno, { once: true });
      encuadrar();
      aplicarModo();
    },
    setContenido(c) {
      contenido = c;
      UH.uHayHoja.value = c ? 1 : 0;
      if (c?.tipo === 'canvas') {
        const t = new CanvasTexture(c.canvas as HTMLCanvasElement);
        t.colorSpace = SRGBColorSpace; t.generateMipmaps = false; t.minFilter = LinearFilter;
        UH.uHoja.value = t;
      } else UH.uHoja.value = texHoja;
    },
    setModo(m) { modo = m; aplicarModo(); },
    setFrascoVisible(v) { frascoVisible = v; raiz.visible = v; },
    setCaja(c) { o.caja = c; recolocar(); },
    getCaja() { return { caja, cajaFoto: foto, pivote: { ...pivote } }; },
    girar,
    getAngulo: () => angulo,
    mediaVuelta,
    setCalidad(c) {
      auto = c === 'auto';
      calidad = c === 'auto' ? 'alto' : c;
      aplicarNivel();
      reiniciarMedida();
    },
    redimensionar,
    /** Solo para afinar/verificar: material y luz. No es API estable. */
    depurar: () => ({ vidrio, luz, malla, rehacerEntorno }),
    medidas() {
      const n = Math.min(nTiempos, tiempos.length);
      const v = Array.from(tiempos.subarray(0, n)).sort((a, b) => a - b);
      const media = v.reduce((a, b) => a + b, 0) / (n || 1);
      return { calidad, frames: n, mediaMs: +media.toFixed(2), p95Ms: +(v[Math.floor(n * 0.95)] ?? 0).toFixed(2) };
    },
    destruir() {
      vivo = false;
      cancelAnimationFrame(raf);
      obs.disconnect();
      consulta.removeEventListener('change', alMovimiento);
      canvas.removeEventListener('pointerdown', bajar);
      canvas.removeEventListener('pointermove', mover);
      canvas.removeEventListener('pointerup', soltar);
      canvas.removeEventListener('pointercancel', soltar);
      canvas.removeEventListener('dblclick', dobleClic);
      malla.geometry.dispose(); vidrio.dispose(); matFondo.dispose(); matHoja.dispose();
      texHoja.dispose(); texMascara.dispose(); entornoRT?.dispose(); pmrem.dispose();
      renderer.dispose();
    },
  };
}
