/**
 * help.js – Hilfe-Dialog für den HTML-Editor.
 * Enthält die vollständige Beschreibung aller Funktionen,
 * Möglichkeiten und Limitierungen.
 */
(function () {
  'use strict';

  var HELP_CONTENT = `
<p>Willkommen beim HTML-Editor, der speziell dafür gedacht ist, mit dem Smartphone auf der Couch, in irgendwelchen KI-Chats HTML-Apps zu "Vibe Coden".</p>

<h3><i class="bi bi-folder2-open" aria-hidden="true"></i> Datei</h3>
<dl class="help-def">
  <dt>Datei öffnen</dt>
  <dd>Lädt eine lokale Datei (.html, .htm, .css, .js, .txt, text/*) in den Editor. Der Inhalt wird zusätzlich im Verlauf gespeichert.</dd>
  <dt>Einfügen</dt>
  <dd>Fügt den Inhalt der Zwischenablage an der aktuellen Cursorposition ein.</dd>
  <dt>Einfügen &amp; Ersetzen</dt>
  <dd>Ersetzt den gesamten Editorinhalt durch den Inhalt der Zwischenablage.</dd>
  <dt>Kopieren</dt>
  <dd>Kopiert den gesamten Editorinhalt in die Zwischenablage.</dd>
  <dt>Download</dt>
  <dd>Speichert den Inhalt als <code>index.html</code>. Alternativ per <kbd>Strg</kbd>/<kbd>⌘</kbd>+<kbd>S</kbd>.</dd>
  <dt>Teilen</dt>
  <dd>Öffnet den nativen Teilen-Dialog (Web Share API Level 2, Datei-Sharing). Auf nicht unterstützten Geräten wird stattdessen ein Download gestartet.</dd>
</dl>

<h3><i class="bi bi-pencil-square" aria-hidden="true"></i> Bearbeiten</h3>
<dl class="help-def">
  <dt>Suchen / Ersetzen</dt>
  <dd>Einfache Textsuche, Groß-/Kleinschreibung wird ignoriert. Kein Regex, keine Wortgrenzen. <kbd>Strg</kbd>/<kbd>⌘</kbd>+<kbd>Enter</kbd> im Suchfeld springt zum nächsten Treffer, im Ersetzen-Feld ersetzt den aktuellen Treffer. <kbd>Alle Ersetzen</kbd> ersetzt sämtliche Vorkommen.</dd>
  <dt>Formatieren</dt>
  <dd>Heuristische Einrückung für HTML, CSS und JavaScript (2 Leerzeichen). Erkennt die Sprache anhand des Inhalts.</dd>
  <dt>Zeilennummern anzeigen</dt>
  <dd>Blendet die Zeilennummern-Spalte links neben dem Editor ein oder aus. Der Zustand wird persistent gespeichert.</dd>
  <dt>Zeilen / Zeichen</dt>
  <dd>Live-Anzeige der aktuellen Zeilen- und Zeichenanzahl (nur Information, nicht editierbar).</dd>
</dl>
<div class="help-limit">
  <strong>Suchen / Ersetzen:</strong> Reiner Text, keine Regex, keine Wortgrenzen, keine Groß-/Kleinschreibungs-Unterscheidung.
</div>

<h3><i class="bi bi-eye" aria-hidden="true"></i> Ansicht</h3>
<dl class="help-def">
  <dt>Overview Minimap</dt>
  <dd>Parallax-Minimap rechts neben dem Editor mit dynamischem Parallax-Faktor und farbcodierten Zeilen (Kommentare, Tags, Schlüsselwörter, Strings). Klick- und ziehbar per Maus oder Touch. Zustand wird persistent gespeichert.</dd>
  <dt>Vorschau</dt>
  <dd>Sandboxed <code>&lt;iframe&gt;</code> mit Live-Ausführung des Editorinhalts. Automatische Aktualisierung beim Öffnen; manuelles Aktualisieren über den <kbd>↻</kbd>-Button im Panel-Header. Vollbild über den <kbd>⛶</kbd>-Button.</dd>
  <dt>Konsole</dt>
  <dd>Zeigt <code>console.log/info/warn/error</code> sowie <code>window.onerror</code> und <code>unhandledrejection</code> aus der Vorschau. Fehlermeldungen öffnen die Konsole automatisch (einmalig pro Vorschau-Refresh). Jede Meldung kann per Klick kopiert werden. Maximal 500 Nachrichten.</dd>
  <dt>Vorschau-Daten löschen</dt>
  <dd>Leert die Storage-Shims der Vorschau (localStorage, sessionStorage, indexedDB). Die Vorschau wird mit leerem Store neu geladen.</dd>
</dl>
<div class="help-limit">
  <strong>Vorschau-Sandbox:</strong> <code>allow-scripts allow-modals</code> – kein <code>allow-same-origin</code>. Formular-Submits, Top-Navigation und Popups werden blockiert.
</div>

<h3><i class="bi bi-clock-history" aria-hidden="true"></i> Verlauf</h3>
<dl class="help-def">
  <dt>Version speichern</dt>
  <dd>Speichert den aktuellen Editorinhalt als Version. Maximal 20 Versionen; Duplikate werden per FNV-Hash erkannt und nur im Zeitstempel aktualisiert. Gespeichert in IndexedDB des Browsers.</dd>
  <dt>Version laden</dt>
  <dd>Klick auf einen Eintrag lädt die Version zurück in den Editor. Der aktuelle Inhalt wird dabei überschrieben.</dd>
</dl>
<div class="help-limit">
  <strong>Verlauf:</strong> Maximal 20 Versionen.
</div>

<h3><i class="bi bi-lightning-charge" aria-hidden="true"></i> Tastenkürzel</h3>
<ul>
  <li><kbd>Strg</kbd>/<kbd>⌘</kbd> + <kbd>F</kbd> – Suche öffnen</li>
  <li><kbd>Strg</kbd>/<kbd>⌘</kbd> + <kbd>S</kbd> – Download starten</li>
  <li><kbd>Strg</kbd>/<kbd>⌘</kbd> + <kbd>Enter</kbd> im Suchfeld – nächster Treffer</li>
  <li><kbd>Strg</kbd>/<kbd>⌘</kbd> + <kbd>Enter</kbd> im Ersetzen-Feld – ersetzen</li>
  <li><kbd>Tab</kbd> – zwei Leerzeichen einfügen</li>
  <li><kbd>Esc</kbd> – Suchleiste / offene Dropdowns schließen</li>
</ul>

<h3><i class="bi bi-arrows-move" aria-hidden="true"></i> Drag &amp; Drop</h3>
<ul>
  <li>Datei in den Editor ziehen → wird geladen und im Verlauf gespeichert.</li>
  <li>Textauswahl ziehen → wird an der aktuellen Cursorposition eingefügt.</li>
</ul>
`;

  function $(id) { return document.getElementById(id); }

  function fillContent() {
    var body = $('helpDialogBody');
    if (!body) return;
    if (body.getAttribute('data-filled') === '1') return;
    body.innerHTML = HELP_CONTENT;
    body.setAttribute('data-filled', '1');
  }

  function openHelp() {
    var dlg = $('helpDialog');
    if (!dlg) return;
    fillContent();
    if (typeof dlg.showModal === 'function') {
      if (!dlg.open) dlg.showModal();
    } else {
      dlg.setAttribute('open', '');
    }
    var body = $('helpDialogBody');
    if (body) body.scrollTop = 0;
  }

  function closeHelp() {
    var dlg = $('helpDialog');
    if (!dlg) return;
    if (typeof dlg.close === 'function' && dlg.open) {
      dlg.close();
    } else {
      dlg.removeAttribute('open');
    }
  }

  function init() {
    var btn = $('btnHelp');
    if (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        openHelp();
      });
    }
    var closeBtn = $('btnCloseHelp');
    if (closeBtn) closeBtn.addEventListener('click', closeHelp);

    var dlg = $('helpDialog');
    if (dlg) {
      // Klick auf den Backdrop schließt den Dialog.
      dlg.addEventListener('click', function (e) {
        if (e.target === dlg) closeHelp();
      });
      // ESC schließt nativ (cancel-Event wird vom Browser behandelt).
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();