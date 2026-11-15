# Bildprüfung #50

Referenzen ausschließlich lokal betrachtet: `5-heldin.png` in Originalgröße und per `sips -Z 320`, ergänzend `4-heldin-sheet.png` sowie `bug-ebenen-live.png`. Jede Runde wurde mit `tools/snap.mjs` gerendert und in einem lokalen Browser-Kontaktbogen neben die verkleinerte Referenz gelegt; keine Referenzpixel wurden ins Repository übernommen.

## Form und Palette

Großer Kopf (etwa ein Drittel der Höhe, mit Helm etwas mehr), schmalere Taille, runde breite Schulterplatten, ausgestellter Kettenrock, bodenfeste Stiefel; lange Haare rahmen das Gesicht, der rote Umhang hängt hinter der linken Silhouette. Licht oben links. Wichtigste 20 Farbtöne der eigenen Zeichnung: Kontur `#17121f`; Haare `#57312f`, `#925033`, `#ce894b`; Gesicht `#f5c3a5`, `#d88e83`, `#fff1d6`; Augen `#244b7c`, `#58a5cf`; Metall `#3b506a`, `#7796ac`, `#c9d4e0`, `#eef3f7`; Gold `#967042`, `#eac466`; Stoff `#64233c`, `#b6324e`, `#e65a69`; Sitzholz `#754a35`, `#a8734b`.

## Runde 1

Neu gezeichnete 36-Pixel-Grundfigur, zusammenhängender Kopf/Rumpf statt des alten Sprungs um vier Pixel ab Zeile 12. Abweichungen: Helm noch rund statt Krönchen, Augen zu schmal, Haare verdecken Brustplatte, Schwert dünn und ohne deutliches Goldparier, Kettenrock rechteckig und kontrastarm. Nächste Korrektur: breiterer Helm mit Zacken/Edelstein, größere Augen, getrennte Haarsträhnen, breite Klinge mit echtem Parier.

## Runde 2

Krone mit rotem Stein, zwei blau gezeichnete Augen, freigelegte silberne Brustplatte und breite Klinge mit Goldparier ergänzt. Abweichungen: Krone wirkt noch zu golden, lose Haare enden zu abrupt an den Schultern, Umhang fällt wie ein gerader Streifen, Brustjuwel fehlt; Level-up-Glanz liegt auf dem Gesicht. Nächste Korrektur: mehr graue Helmflächen, gebogene Haarenden, gefalteter Umhangsaum, Brustjuwel und Glanzpunkte außerhalb der Silhouette.

## Runde 3

Helmflächen, Haarenden, Umhangfalten, Brust- und Gürtelschmuck sowie außenliegende Level-up-Funken verfeinert. Abweichungen: Schwert wird beim Jubeln sichtbar kürzer als im Leerlauf; sitzender Kettenrock verdeckt zu viel von den angewinkelten Beinen, Mund ist noch nicht lesbar. Nächste Korrektur: einheitliche Klingenlänge in den Kampf-/Jubelposen, verkürzter und nach vorn gelegter Sitzrock, ein Mundpixel und abschließende Bewegungs-/Browserprüfung.

## Runde 4

Mit einheitlichem 18-Pixel-Schwert und kürzerem Sitzrock gerendert. Der Kontaktbogen zeigt die Kopf-Rumpf-Verbindung durchgehend, auch beim Sitzen, Knien und in den Angriffen. Abweichungen: der Umhang war nur eine schmale rote Kontur statt einer gefalteten Fläche; die Schulterplatten waren zu klein und die langen Strähnen kaum von ihnen zu unterscheiden. Nächste Korrektur: Umhang füllen, Strähnen hinter größeren silber-blauen Platten staffeln und Gesichtsausdruck lesbarer machen.

## Runde 5

Umhang als gefüllte Fläche mit dunklen Falten gezeichnet, breite Schulterplatten und lange seitliche Haarsträhnen ergänzt; Wangen und Mundpixel gesetzt. Im direkten Vergleich bleibt die Silhouette bei 36 px hoch, das Gesicht groß und die Palette reduziert. Kleine Abweichungen: die Hauptreferenz hält das Schwert frontal links und zeigt einen weiter ausladenden Umhang; der Contract verlangt eine nach rechts blickende Heldin, daher bleibt das Schwert in ihrer rechten Hand. Die Referenz hat mehr Schattierungsnuancen und eine längere nach rechts wehende Cape-Spitze als die kompakte Bühnensprite.

## Prüfung im Spiel

`npm run dev` mit `?speed=60`: Menü gestartet, zwei Kampfzeitpunkte bei 1280×720 aufgenommen (`browser-focus*.png`). Die Heldin bleibt vollständig auf der Bühne; Kopf, Hals, Rumpf und Beine sind verbunden, Schwert und Gegner schneiden die Figur nicht. Die Browserkonsole blieb fehlerfrei.
