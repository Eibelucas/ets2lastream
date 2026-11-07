# Projektstatus

Stand: 7. November 2026. Beide Plugins stehen auf Version 0.1.1; das Stream-Deck-Manifest verwendet das Format 0.1.1.0.

## Implementiert

- 22 Stream-Deck-Aktionen mit deutschen Bezeichnungen und Einstellungen pro Taste.
- Dynamisch gezeichnete SVG-Zahlen für Straßenlimit, Geschwindigkeit und Zieltempo; Startbilder der Live-Anzeigen enthalten nur einen Platzhalter.
- Umschaltung Straßenlimit/eigenes Zieltempo mit gespeichertem manuellem Wert und vorhandener ETS2LA-Maximalgeschwindigkeit.
- Getrennte Steuerung von Assistenzfreigabe, ACC und Spurhalten sowie Einstellungen für Abstand, Reaktion und Verkehrsregeln.
- Lokale Verbindung mit Statusmeldungen, Bestätigungen, Wiederverbindung, Schutz vor doppelten/abgelaufenen Befehlen und erkennbaren Offline-Zuständen.
- Dauerhafte Bridge-Installation außerhalb des beim App-Update ersetzten Programmordners, inklusive Registrierung und Sicherung der Pluginliste.

## Bereits geprüft

- C#-Build gegen ETS2LA 2026.11.5258: keine Fehler oder Warnungen.
- Nativer ETS2LA-Plugin-Loader: Plugin erkannt, gemeinsame Typidentität erhalten, Framework-Abhängigkeiten aufgelöst.
- 37 Prüfungen für Befehlslogik und C#-Transport.
- 15 Node-Tests einschließlich echter Verbindung zwischen Node-Client und C#-Testhost mit kontrollierten Testdaten.
- 8 Installer-Prüfungen, einschließlich Erhalt anderer Manifestfelder, wiederholter Registrierung ohne Duplikate und simuliertem Austausch des `current`-Ordners.
- Stream-Deck-Paket mit dem offiziellen Elgato-Werkzeug validiert und gebaut.

Die Installer-Prüfungen und der Loader-Test wurden nach der Änderung auf die dauerhafte Ablage erneut ausgeführt. Der Transport selbst wurde durch diese Änderung nicht verändert.

## Noch zu bestätigen

Nach der Reparatur war die DLL am dauerhaften Ablageort vorhanden und genau einmal im Manifest registriert. Die laufende ETS2LA-Instanz zeigte aber noch die alte Pluginliste. Die Computersteuerung wurde durch den Nutzer beendet, bevor ein Neustart und die Aktivierung abschließend geprüft werden konnten.

Offen sind daher: Anzeige und Aktivierung im neu gestarteten ETS2LA, Verbindung beider tatsächlich laufender Plugins, physische Stream-Deck-Tastendrücke und ein vollständiger Fahrtest. Simulierte Telemetrie und die HTML-/PNG-Vorschau belegen diese Punkte nicht.
