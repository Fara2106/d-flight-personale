#!/bin/bash
# Avvia il dev server di D-Flight personale e apre l'app nel browser.
# Doppio clic su macOS (i file .command si aprono nel Terminale).
#
# NOTA URL: il progetto ha una base custom per GitHub Pages, quindi in dev
# l'app vive su http://localhost:<porta>/d-flight-personale/ (la radice "/"
# fa comunque redirect alla base). Lo script ricava la base da vite.config.ts
# e apre sempre l'URL completo, solo quando il server risponde davvero.

set -u

# ── Cartella del progetto = cartella dello script (non la cwd del Terminale)
cd "$(dirname "$0")" || { echo "ERRORE: impossibile entrare nella cartella dello script"; exit 1; }

PORT=5173
MAX_PORT=5183

resta_aperto() {  # tiene la finestra aperta per leggere i messaggi
  echo
  read -r -p "Premi Invio per chiudere questa finestra... " _ 2>/dev/null || true
}

echo "== D-Flight personale =="
echo "Cartella: $(pwd)"

# ── PATH per shell non interattive: il Terminale che esegue i .command può
#    non caricare .zshrc/.zprofile, quindi Homebrew/node possono mancare dal PATH.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v npm >/dev/null 2>&1; then
  # fallback: node installato via nvm / volta
  for d in "$HOME"/.nvm/versions/node/*/bin "$HOME/.volta/bin"; do
    if [ -x "$d/npm" ]; then export PATH="$d:$PATH"; break; fi
  done
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "ERRORE: npm non trovato in questa shell."
  echo "Installa Node (es. 'brew install node') oppure lancia a mano nel Terminale:"
  echo "  cd \"$(pwd)\" && npm run dev"
  resta_aperto; exit 1
fi
echo "npm: $(command -v npm) — node $(node -v 2>/dev/null || echo '?')"

# ── Base path dell'app, letta da vite.config.ts (fallback: /)
BASE_PATH="$(sed -n "s/.*base: *'\([^']*\)'.*/\1/p" vite.config.ts | head -1)"
[ -n "$BASE_PATH" ] || BASE_PATH="/"

url_for()  { echo "http://localhost:$1$BASE_PATH"; }
# 200 sull'URL con base = il server che risponde è proprio la nostra app
nostra_app() {
  curl -s --max-time 2 "$(url_for "$1")" 2>/dev/null | grep -qi "D-Flight personale"
}
porta_occupata() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

# ── Gotcha iCloud: i duplicati di conflitto "* 2.*" rompono Vite
find . -name "* 2.*" -not -path "./node_modules/*" -delete 2>/dev/null

# ── Dipendenze
if [ ! -d node_modules ]; then
  echo "Installo le dipendenze (npm install)…"
  npm install || { echo "ERRORE: npm install fallito (vedi sopra)."; resta_aperto; exit 1; }
fi

# ── Se l'app gira già (doppio clic ripetuto), apri e basta
if nostra_app "$PORT"; then
  echo "Il server è già attivo. Apro $(url_for "$PORT")"
  open "$(url_for "$PORT")"
  exit 0
fi

# ── Porta: se la 5173 è occupata da altro, usa la prima libera (esplicita!)
while porta_occupata "$PORT"; do
  echo "La porta $PORT è occupata da un altro programma: provo la successiva."
  PORT=$((PORT + 1))
  if [ "$PORT" -gt "$MAX_PORT" ]; then
    echo "ERRORE: nessuna porta libera tra 5173 e $MAX_PORT."
    resta_aperto; exit 1
  fi
done
URL="$(url_for "$PORT")"

# ── Avvio dev server (strictPort: se la porta non è usabile fallisce subito,
#    così non finiamo col server su una porta e il browser su un'altra)
echo "Avvio del dev server sulla porta $PORT…"
npm run dev -- --port "$PORT" --strictPort &
DEV_PID=$!
trap 'echo; echo "Fermo il dev server…"; kill "$DEV_PID" 2>/dev/null; exit 0' INT TERM HUP

# ── Apri il browser SOLO quando il server risponde davvero sull'URL con base
echo "Attendo che il server sia pronto su $URL …"
PRONTO=0
i=0
while [ "$i" -lt 60 ]; do
  if ! kill -0 "$DEV_PID" 2>/dev/null; then
    echo "ERRORE: il dev server si è chiuso subito — leggi i messaggi qui sopra."
    resta_aperto; exit 1
  fi
  if nostra_app "$PORT"; then PRONTO=1; break; fi
  sleep 1; i=$((i + 1))
done

if [ "$PRONTO" -eq 1 ]; then
  echo "Pronto! Apro $URL"
  open "$URL"
  echo
  echo "L'app gira su: $URL"
  echo "Premi Ctrl-C (o chiudi questa finestra) per fermare il server."
else
  echo "ERRORE: il server non ha risposto entro 60 secondi su $URL"
  echo "Prova ad aprire l'URL a mano; se non va, leggi i messaggi qui sopra."
fi

wait "$DEV_PID" 2>/dev/null
echo "Il dev server si è fermato."
resta_aperto
