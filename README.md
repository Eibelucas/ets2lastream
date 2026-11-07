# ETS2LA × Stream Deck

Zwei zusammengehörende Plugins: **Stream Deck Bridge** für ETS2LA (0.1.1) und **ETS2LA** für Elgato Stream Deck (0.1.1). Für Windows, gebaut und mit dem Loader der lokal installierten ETS2LA-Version **2026.11.5258** geprüft; Stream Deck **7.1 oder neuer**.

## Installation

1. ETS2LA und Stream Deck vollständig beenden, auch im Infobereich.
2. Im Ordner `artifacts` das Skript `Installieren.ps1` mit PowerShell ausführen. Es kopiert ausschließlich diese beiden Plugins und sichert eine bereits vorhandene Version im Unterordner `Backup`.
3. ETS2LA starten. Im Plugin-Manager **Stream Deck Bridge** aktivieren. ACC und Lane Assist müssen für die jeweiligen Tasten ebenfalls geladen und eingeschaltet sein.
4. Stream Deck starten. Die **22 Aktionen** aus der Kategorie **ETS2LA** auf die gewünschten freien Tasten ziehen.

Die Bridge liegt dauerhaft in `%APPDATA%\ETS2LA\LocalPlugins\lucat.streamdeck\StreamDeckBridge.dll`. Der Installer registriert diesen absoluten Pfad in `%APPDATA%\ETS2LA\InstalledPluginManifest.json` und sichert die bisherige Pluginliste. Andere Einträge bleiben erhalten. Der bisherige Ablageort `current\Plugins\` wird bei ETS2LA-Updates ersetzt und wird deshalb nicht mehr für die Bridge verwendet.

Fehlt nur die Bridge nach einem ETS2LA-Update, im Paketordner `Installieren-Bridge.ps1` ausführen. Das repariert ausschließlich den ETS2LA-Teil. Danach im Plugin-Manager die Plugins neu laden oder ETS2LA neu starten und **Stream Deck Bridge** aktivieren.

Den Stream-Deck-Teil alternativ über `de.lucat.ets2la.streamDeckPlugin` installieren oder den Ordner `de.lucat.ets2la.sdPlugin` nach `%APPDATA%\Elgato\StreamDeck\Plugins\` kopieren. Anschließend Stream Deck neu starten.

Vorhandene Stream-Deck-Profile und Tastenbelegungen bleiben erhalten. Die Tasten werden bewusst nicht automatisch in ein bestehendes Profil eingesetzt.

## Straßenlimit und eigenes Tempo

Die Aktion **Straßenlimit / eigenes Tempo** zeigt ein echtes dynamisches Tempolimitschild:

Die Zahlen werden direkt in das SVG-Tastenbild gezeichnet. Ändert sich das Straßenlimit, die Geschwindigkeit oder das Zieltempo, sendet das Plugin automatisch ein neu gezeichnetes Bild an Stream Deck. Dafür ist kein Tastendruck nötig. Es gibt keine Sammlung fester Zahlenbilder; auch beliebige Werte wie 57 oder 103 werden dargestellt. Vor der ersten Verbindung und nach Verbindungsverlust zeigen die Live-Zahlentasten „–“. Die Tempo-Vorgabe zeichnet ihren eingestellten Wert bei jeder Einstellungsänderung neu.

- **Roter Ring / STRASSENLIMIT:** aktuelles Straßenlimit aus der Spieltelemetrie. ETS2LA folgt Änderungen des Limits über seine vorhandene Verkehrsregel-Verarbeitung.
- **Goldener Ring / EIGENES TEMPO:** das eigene ETS2LA-Zieltempo. Das weiterhin erkannte Straßenlimit steht klein darunter.
- **Drücken:** zwischen beiden Modi wechseln. Dein eigenes Zieltempo bleibt gespeichert, während du im Straßenmodus fährst.
- **Kein Limit bekannt:** „–“. Der Wechsel in den Straßenmodus wird dann abgelehnt; das bisherige Tempo bleibt erhalten.

Im Einstellungsbereich der Taste kannst du optional ein festes eigenes Tempo eintragen. Leer lassen bedeutet: das zuletzt gesetzte eigene Tempo wiederherstellen. Mit einem festen Wert wird dieser bei jedem Wechsel auf manuell verwendet.

**Plus/Minus**, **Eigenes Zieltempo setzen** und **Aktuelles Tempo übernehmen** wechseln auf manuell. Sie verändern die Assistenzfreigabe nicht. Die Schrittweite ist pro Taste einstellbar. Lege beispielsweise Tasten für +1, −1, +5, −5 sowie Tempo-Vorgaben 50, 80 und 90 an. Die Einheit kann je Taste km/h, mph oder „Wie ETS2LA“ sein. Das zentrale ETS2LA-Maximaltempo bleibt wirksam.

Der Modus verwendet ETS2LAs Einstellung „Speedlimits beachten“. Im manuellen Modus folgt ETS2LA keinem neuen Straßenlimit automatisch. Im Straßenmodus bleiben die in ETS2LA eingestellten Tempo-Offsets und die dortige Fallback-Logik bei späteren Limitänderungen wirksam. Die separate Aktion **Zieltempo anzeigen** zeigt immer das tatsächlich eingestellte Zieltempo.

## Aktionen

| Aktion | Funktion |
| --- | --- |
| Assistenten ein/aus | Freigabe im ausgewählten Fahrmodus umschalten |
| ACC ein/aus | ACC hinzufügen/entfernen; bereits freigegebenes Spurhalten erhalten |
| Spurhalten ein/aus | Spurhalten hinzufügen/entfernen; bereits freigegebenes ACC erhalten |
| Fahrmodus wechseln | ACC + Spur → nur ACC → nur Spur; aktiviert die Assistenten nicht selbst |
| Assistenten ausschalten | Gesamte Assistenzfreigabe ausschalten |
| Assistenten fortsetzen | Ausgewählten Fahrmodus mit dem aktuellen Zieltempo freigeben |
| Straßenlimit / eigenes Tempo | Dynamisches Schild und Modusumschaltung |
| Zieltempo erhöhen / verringern | Einstellbare Schrittweite, Wechsel auf manuell |
| Eigenes Zieltempo setzen | Einstellbare Tempo-Vorgabe, mehrere Tasten möglich |
| Aktuelles Tempo übernehmen | Geschwindigkeit als eigenes Zieltempo übernehmen |
| Geschwindigkeit anzeigen | Aktuelle Spielgeschwindigkeit |
| Zieltempo anzeigen | Aktuelles ETS2LA-Zieltempo |
| Verbindung und Fahrstatus | Offline, kein Spiel, Pause, bereit oder Assist ein |
| Folgeabstand wechseln | Nah / normal / weit |
| ACC-Reaktion wechseln | Sanft / normal / schnell |
| Lenkempfindlichkeit wechseln | Sanft / normal / schnell |
| Kollisionsvermeidung wechseln | Aus / spät / mittel / früh |
| Tempolimit-Warnung wechseln | Aus / visuell / mit Ton |
| Ampeln beachten ein/aus | ETS2LA-Verkehrsregel umschalten |
| Schranken beachten ein/aus | ETS2LA-Verkehrsregel umschalten |
| Pause bei Instabilität ein/aus | ETS2LA-Einstellung umschalten |

**EIN** bedeutet den Freigabezustand in ETS2LA. Die tatsächlich ausgeführten Lenk- und Bremseingriffe hängen von ACC/Lane Assist, der Spielsituation und der Verfügbarkeit ihrer Daten ab. **PLUGIN AUS** bedeutet, dass das zugehörige offizielle Plugin nicht läuft. Bei Pause oder fehlender Telemetrie wird kein aktiver Fahrzustand dargestellt.

Änderungen über Tastatur, Lenkrad und ETS2LA erscheinen ebenfalls auf den Tasten. Die Einstellungen werden über ETS2LAs vorhandene Settings-Schnittstelle gespeichert. Nur das eigene Tempo und der Bridge-Port liegen zusätzlich in `%APPDATA%\ETS2LA\lucat.streamdeck.json`.

## Verbindung

Standard: `ws://127.0.0.1:38120/ets2la`. Die Bridge läuft ausschließlich lokal. Statusmeldungen kommen fünfmal pro Sekunde. Bei Verbindungsverlust wechseln die Tasten auf **OFFLINE** und verbinden sich automatisch neu. Tastendrücke werden bestätigt und niemals nach einer Wiederverbindung nachgespielt. Befehle zum Freigeben der Assistenten und zum Ändern des Tempos benötigen aktuelle, nicht pausierte Spieldaten. Ausschalten bleibt auch bei Pause möglich.

Port ändern: Bridge deaktivieren, in `lucat.streamdeck.json` den Wert `Port` ändern, Bridge wieder aktivieren. Im Einstellungsbereich einer Stream-Deck-Taste unter **Verbindung** denselben Port eintragen. Die Port-Einstellung gilt für alle Tasten des Plugins.

## Entwicklung

Voraussetzungen: .NET 10 SDK, Node.js 24+, installierte ETS2LA-C#-Version. Der ausgelieferte Stream-Deck-Teil benötigt keine npm-Pakete; er verwendet die offizielle WebSocket-Schnittstelle und die von Stream Deck mitgelieferte Node-Laufzeit. Die Bridge nutzt ASP.NET Core, das ETS2LA bereits mitliefert. ETS2LA-Dateien werden beim Bauen referenziert, nicht mitgeliefert.

Nach einem frischen Checkout zuerst `Bauen.ps1` ausführen; dadurch wird der nicht eingecheckte Ordner `artifacts` mit Installer und Plugin-Dateien erzeugt. Ein `.streamDeckPlugin`-Installationspaket wird zusätzlich erzeugt, wenn Elgatos CLI am im Buildskript angegebenen lokalen Pfad verfügbar ist. Ohne dieses Werkzeug ist der erzeugte `.sdPlugin`-Ordner direkt installierbar.

```powershell
.\Bauen.ps1
# Bei abweichendem ETS2LA-Installationsort:
.\Bauen.ps1 -ETS2LAPath 'D:\ETS2LA\current'
node --test tests/streamdeck.test.cjs
dotnet restore tests/Bridge.Tests/Bridge.Tests.csproj --configfile NuGet.Config
dotnet run --project tests/Bridge.Tests/Bridge.Tests.csproj -c Release --no-restore
# Danach optional der Verbindungstest mit dem gebauten C#-Testhost:
node --test tests/integration.test.cjs
# Mit lokaler ETS2LA-Installation und gebauter Bridge:
.\tests\Installer.Tests.ps1
```

`src/Bridge` enthält Protokoll, Befehlslogik und WebSocket-Server. `src/ETS2LA.StreamDeck` bindet die realen ETS2LA-Schnittstellen an. `streamdeck/de.lucat.ets2la.sdPlugin` enthält das vollständige Stream-Deck-Plugin einschließlich Einstellungen und dynamischer SVG-Icons. Die Vorschau im `artifacts`-Ordner verwendet gekennzeichnete Beispieldaten.

Ein realer Fahrtest in ETS2/ATS ist zusätzlich zu den automatischen Tests erforderlich, um das Zusammenspiel mit den installierten ACC-/Lane-Assist-Plugins während der Fahrt zu prüfen. Dieses Projekt schreibt keine Änderungen in den ETS2LA-Kern.

Für eine neue Coding-Aufgabe steht ein fertiger Weiterarbeits-Prompt in [PROMPT.md](PROMPT.md). [docs/STATUS.md](docs/STATUS.md) beschreibt nachgewiesene Prüfungen und noch offene Schritte im echten Spiel.

Offizielle Referenzen: [ETS2LA Plugin-API](https://docs.ets2la.com/docs/Core%20Concepts/PluginLoading/), [ApplicationState](https://docs.ets2la.com/docs/Units%20and%20State/State/), [Beispielprojekt](https://github.com/ETS2LA/example-plugin), [Stream Deck WebSocket-API](https://docs.elgato.com/streamdeck/sdk/references/websocket/plugin/), [dynamische Icons](https://docs.elgato.com/streamdeck/sdk/guides/keys/).
