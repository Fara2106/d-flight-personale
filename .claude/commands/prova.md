---
description: Avvia il dev server Vite e apre l'app nel browser
---

Avvia l'app D-Flight personale in locale e aprila nel browser per provarla.

Passi:

1. Verifica che le dipendenze siano installate: se `node_modules` manca, esegui `npm install`.
2. (Gotcha iCloud) Se un avvio precedente ha lasciato duplicati di conflitto, ripuliscili prima di partire:
   `find . -name "* 2.*" -not -path "./node_modules/*" -delete`
3. Avvia il dev server **in background** (non bloccare la sessione):
   `npm run dev`
   Vite serve su http://localhost:5173/ ma il `base` in `vite.config.ts` è `/d-flight-personale/`, quindi l'URL completo dell'app è **http://localhost:5173/d-flight-personale/**.
4. Attendi che il server sia pronto: fai un poll finché risponde 200:
   `until curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/d-flight-personale/ | grep -q 200; do sleep 1; done`
5. Apri la pagina nel browser di default:
   `open http://localhost:5173/d-flight-personale/`
6. Comunica all'utente l'URL aperto e ricorda che per fermare il server basta chiudere il task in background (o `Ctrl-C` sul processo `vite`).

Nota: l'app carica le zone solo dopo l'import manuale di un file ED-269; all'avvio a freddo vedrai l'empty state con il pulsante "Importa file zone (ED-269)".
