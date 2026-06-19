#!/bin/bash
# Double-click this file to launch the World Cup 2026 app.
# It starts the local server and opens the app in your browser.

cd "$(dirname "$0")" || exit 1

echo "🏆  World Cup 2026 — Best Thirds"
echo "Serving at http://localhost:4173"
echo "Keep this window open while using the app. Close it (or press Ctrl+C) to stop."
echo

# Open the browser once the server is up.
( sleep 1; open "http://localhost:4173" ) &

# Start the no-cache static server (blocks until you close the window / Ctrl+C).
exec python3 serve.py
