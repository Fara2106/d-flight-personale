/**
 * Blocca il pinch-zoom della PAGINA su iOS: Safari (anche in standalone) può
 * ignorare `user-scalable=no` e zoomare tutta la UI. I gesture event
 * (`gesturestart`/`gesturechange`) sono l'hook proprietario WebKit del pinch:
 * annullarli ferma lo zoom pagina, mentre la mappa non li usa — MapLibre
 * gestisce il pinch coi touch event sul canvas (touch-action: none) e
 * continua a zoomare da sola. Il meta viewport con maximum-scale=1 copre gli
 * altri casi (Android rispetta touch-action/viewport).
 */
export function lockPageZoom(
  target: Pick<EventTarget, 'addEventListener'> = document,
): void {
  const prevent = (e: Event) => e.preventDefault();
  target.addEventListener('gesturestart', prevent);
  target.addEventListener('gesturechange', prevent);
}
