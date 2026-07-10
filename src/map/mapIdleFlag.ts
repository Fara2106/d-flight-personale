/**
 * Espone sul container `data-map-idle="1"` quando MapLibre ha finito di
 * caricare e disegnare (evento 'idle'); l'attributo cade a ogni nuovo frame
 * ('render') e torna al prossimo idle.
 *
 * Hook deterministico per gli E2E: aspettare `[data-map-idle]` sostituisce
 * gli sleep fissi prima dei click a hit-test sui pixel (popup, verifica).
 */
type MapEvents = { on(ev: 'idle' | 'render', cb: () => void): unknown };

export function wireMapIdleFlag(m: MapEvents, el: HTMLElement): void {
  m.on('render', () => { if ('mapIdle' in el.dataset) delete el.dataset.mapIdle; });
  m.on('idle', () => { el.dataset.mapIdle = '1'; });
}
