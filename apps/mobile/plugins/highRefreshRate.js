/**
 * Pide el modo de pantalla más rápido en cada `prebuild` (120 Hz en un A55).
 *
 * Sin esto, algunos Android se quedan en 60 aunque el bucle pueda más.
 * El vidrio sigue regrabándose a ~20 fps: eso no baja el techo del material.
 * Si la plantilla de MainActivity cambia y no está el `super.onCreate(null)`,
 * el plugin no toca nada.
 */
const { withMainActivity } = require('expo/config-plugins');

function withHighRefreshRate(config) {
  return withMainActivity(config, (cfg) => {
    if (cfg.modResults.language !== 'kt') return cfg;
    let src = cfg.modResults.contents;
    if (src.includes('preferredDisplayModeId')) return cfg;
    const needle = 'super.onCreate(null)';
    if (!src.includes(needle)) return cfg;
    src = src.replace(`${needle}`, `${needle}\n    preferFastestRefresh()`);
    const method = `
  private fun preferFastestRefresh() {
    if (android.os.Build.VERSION.SDK_INT < 23) return
    val display = if (android.os.Build.VERSION.SDK_INT >= 30) display else windowManager.defaultDisplay
    val best = display?.supportedModes?.maxByOrNull { it.refreshRate } ?: return
    val lp = window.attributes
    lp.preferredDisplayModeId = best.modeId
    window.attributes = lp
  }
`;
    const last = src.lastIndexOf('}');
    src = src.slice(0, last) + method + '\n' + src.slice(last);
    cfg.modResults.contents = src;
    return cfg;
  });
}

module.exports = withHighRefreshRate;
