const CLAVE = 'hourglass-web/dia';

interface Guardado {
  readonly fecha: string;
  readonly hoy: number;
  readonly racha: number;
  readonly ultimo: string;
}

export interface ArenaDia {
  readonly hoy: number;
  readonly racha: number;
}

function fechaLocal(fecha = new Date()): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

function diaAnterior(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const date = new Date(anio ?? 1970, (mes ?? 1) - 1, dia ?? 1);
  date.setDate(date.getDate() - 1);
  return fechaLocal(date);
}

function leer(): Guardado | null {
  try {
    const raw = localStorage.getItem(CLAVE);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<Guardado>;
    if (typeof data.hoy !== 'number' || typeof data.racha !== 'number' || typeof data.ultimo !== 'string') return null;
    return {
      fecha: typeof data.fecha === 'string' ? data.fecha : data.ultimo,
      hoy: data.hoy,
      racha: data.racha,
      ultimo: data.ultimo,
    };
  } catch {
    return null;
  }
}

function guardar(data: Guardado): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(data));
  } catch {
    // Sin almacenamiento, el tarro vive solo en esta sesión.
  }
}

/** Lo que se enseña hoy. La racha sigue si el último día fue hoy o ayer. */
export function leerArenaDia(): ArenaDia {
  const hoyFecha = fechaLocal();
  const g = leer();
  if (!g) return { hoy: 0, racha: 0 };
  const viva = g.ultimo === hoyFecha || g.ultimo === diaAnterior(hoyFecha);
  return { hoy: g.fecha === hoyFecha ? g.hoy : 0, racha: viva ? g.racha : 0 };
}

/** Una sesión terminada suma un Pomodoro al tarro de hoy. */
export function sumarPomodoro(): ArenaDia {
  const hoyFecha = fechaLocal();
  const g = leer();
  let hoy = 1;
  let racha = 1;
  if (g?.ultimo === hoyFecha) {
    hoy = g.hoy + 1;
    racha = g.racha;
  } else if (g?.ultimo === diaAnterior(hoyFecha)) {
    racha = g.racha + 1;
  }
  guardar({ fecha: hoyFecha, hoy, racha, ultimo: hoyFecha });
  return { hoy, racha };
}

export function textoArenaDia(arena: ArenaDia, es: boolean): string {
  if (es) {
    const n = arena.hoy === 1 ? '1 Pomodoro' : `${arena.hoy} Pomodoros`;
    const racha = arena.racha === 1 ? 'racha de 1 día' : `racha de ${arena.racha} días`;
    return `Hoy: ${n} · ${racha}`;
  }
  const n = arena.hoy === 1 ? '1 Pomodoro' : `${arena.hoy} Pomodoros`;
  const racha = arena.racha === 1 ? '1-day streak' : `${arena.racha}-day streak`;
  return `Today: ${n} · ${racha}`;
}

/** Imagen para compartir. Web Share si el navegador puede; si no, descarga el PNG. */
export async function compartirHoy(hoy: number, es: boolean): Promise<void> {
  const lienzo = document.createElement('canvas');
  lienzo.width = 1200;
  lienzo.height = 630;
  const ctx = lienzo.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#1c1916';
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  ctx.fillStyle = '#e7d3b0';
  ctx.font = '500 72px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const linea = es ? `Hoy: ${hoy} Pomodoro${hoy === 1 ? '' : 's'}` : `Today: ${hoy} Pomodoro${hoy === 1 ? '' : 's'}`;
  ctx.fillText(linea, 600, 280);
  ctx.font = '400 32px system-ui, sans-serif';
  ctx.fillStyle = '#f4efe6';
  ctx.fillText('Hourglass Pomodoro', 600, 380);
  const blob = await new Promise<Blob | null>((resolve) => lienzo.toBlob(resolve, 'image/png'));
  if (!blob) return;
  const archivo = new File([blob], 'hourglass-hoy.png', { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (typeof nav.share === 'function' && nav.canShare?.({ files: [archivo] })) {
    try {
      await nav.share({ files: [archivo], title: 'Hourglass Pomodoro', text: linea });
      return;
    } catch {
      // El usuario canceló o el sistema rechazó el archivo: se descarga.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'hourglass-hoy.png';
  a.click();
  URL.revokeObjectURL(url);
}
