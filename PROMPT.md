# Prompt zum Weiterarbeiten

Kopiere den folgenden Text in eine neue Coding-Aufgabe für dieses Repository:

---

Arbeite am Projekt `ets2lastream` weiter. Lies zuerst README.md und docs/STATUS.md, danach den betroffenen Code. Das Projekt besteht aus einer C#-Bridge als Drittanbieter-Plugin für ETS2LA und einem nativen Elgato-Stream-Deck-Plugin. Bewahre die vorhandenen Funktionen und arbeite innerhalb dieses Repositories.

Das Produkt soll ETS2LA vom Stream Deck aus steuern und den tatsächlichen Zustand auf den Tasten anzeigen. Besonders wichtig: Straßenlimit, Geschwindigkeit und Zieltempo werden dynamisch direkt in die SVG-Tastenbilder gezeichnet und über `setImage` aktualisiert. Auch beliebige Zahlen müssen funktionieren; feste Zahlenbilder oder reine Titeländerungen erfüllen das nicht. Die Taste „Straßenlimit / eigenes Tempo“ schaltet zwischen erkanntem Straßenlimit und gespeichertem manuellem Zieltempo um. Externe Änderungen durch Tastatur, Lenkrad und ETS2LA müssen ebenfalls sichtbar werden.

Der Stream-Deck-Teil verwendet JavaScript und die offizielle WebSocket-API, ohne Laufzeitpakete von npm. Die Bridge verwendet .NET 10 und referenziert die Bibliotheken der vorhandenen ETS2LA-Installation. Sie darf keine ETS2LA-Binärdateien mitliefern. Standardverbindung: `ws://127.0.0.1:38120/ets2la`, Protokollversion 1, Status fünfmal pro Sekunde. Befehle brauchen Bestätigungen, veraltete oder doppelte Befehle dürfen nicht erneut wirken, und nach Wiederverbindung werden keine alten Tastendrücke nachgespielt. Aktuelle Telemetrie und Spielpause bleiben berücksichtigt. Tempoänderungen aktivieren die Fahrassistenten nicht selbständig.

Ein bekannter Installationsfehler wurde behoben: Manuell in `ETS2LA/current/Plugins` kopierte DLLs verschwanden nach einem ETS2LA-Update. Die Bridge wird deshalb in `%APPDATA%/ETS2LA/LocalPlugins/lucat.streamdeck/StreamDeckBridge.dll` abgelegt und mit absolutem Pfad in `InstalledPluginManifest.json` registriert. Erhalte alle anderen Plugin-Einträge und unbekannten JSON-Felder, sichere die ursprüngliche Liste und vermeide doppelte Bridge-Einträge. `scripts/Installieren-Bridge.ps1` repariert den ETS2LA-Teil einzeln. Behalte diese dauerhafte Installation bei.

Der Nutzer möchte ein sauberes AR-Overlay ohne Konsole, Diagnosegrafiken oder „Internal Visualization“. Berücksichtige das bei weiteren UI-/Overlay-Funktionen. AR-Markierungen und Debugfenster sind getrennte Funktionen; das gesamte AR-Overlay auszuschalten löst diesen Wunsch nicht.

Beginne mit der noch offenen End-to-End-Prüfung: Die zuletzt gegen ETS2LA 2026.11.5258 gebaute Bridge ist im nativen Loader ladbar; Registrierung und Ablage sind geprüft. Ein tatsächlicher Neustart samt Aktivierung und ein kompletter Fahrtest sind noch nicht bestätigt. Prüfe die Bridge im ETS2LA-Manager, die Verbindung zum echten Stream-Deck-Plugin und die dynamischen Anzeigen. Unterbrich keine laufende Fahrt. Wenn dir die nötigen Apps oder die Hardware fehlen, erledige alle lokal möglichen Prüfungen und benenne die verbleibende Lücke konkret. Behaupte keinen erfolgreichen Fahrtest anhand simulierter Daten.

Prüfe relevante Änderungen mit den vorhandenen Tests. `node --test tests/streamdeck.test.cjs` benötigt nur Node.js. Der C#-Transporttest in `tests/Bridge.Tests` benötigt .NET 10, aber keine ETS2LA-Installation. `tests/integration.test.cjs` benötigt den gebauten C#-Testhost und eine erlaubte lokale Loopback-Verbindung. `tests/Installer.Tests.ps1` und `tests/Compatibility` benötigen die lokalen ETS2LA-Bibliotheken. Für die Integration kann `DOTNET_EXE` auf eine bestimmte dotnet-Datei zeigen; sonst werden ein vorhandenes lokales SDK oder `dotnet` im PATH verwendet.

Liefere konkrete Korrekturen, sinnvolle Prüfungen und eine kurze Erklärung auf Deutsch: Was ist geändert, was ist nachgewiesen, was muss noch im echten Spiel geprüft werden? Wenn nötig, aktualisiere README.md und den Projektstatus. Veröffentliche keine lokalen Logs, Screenshots, SDK-Installationen oder persönlichen Einstellungen im Repository.

---
