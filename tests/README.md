# Batterie de non-régression MomoCAD

Une commande rejoue MomoCAD de bout en bout dans un navigateur sans écran et dit OK ou KO.

```
node tests/run.js            # tout, 3 suites en parallèle (≈ 2 min)
node tests/run.js tuto       # seulement les suites dont le nom contient « tuto »
node tests/run.js -j 1 -v    # une suite à la fois, avec les traces de mise au point
```

Le rapport s'affiche et s'écrit dans `tests/out/rapport.txt`, avec une capture d'écran de fin par suite dans `tests/out/`.
La commande se termine en erreur (code 1) dès qu'un contrôle échoue : prête pour une vérification automatique avant chaque mise en ligne.

## Ce qui est vérifié

| Suite | Contenu |
| --- | --- |
| tuto-1 à tuto-6 | les 7 tutos joués à la souris et au clavier ; chaque étape doit se valider |
| dessin | droite, longueur tapée, polyligne, rectangle, cercle, arc, cotes, texte, annuler / rétablir |
| edition | déplacer, copier, rotation, miroir, décaler, ajuster, prolonger, agrandir, arrondir, joindre, réseau, diviser, couper, chanfrein, supprimer |
| fichiers | un plan riche enregistré puis rouvert en .mmc et en DXF : objets, altitudes, talus, tranchée, eau, cotes, points topo, calques, style des cotes |
| calculs | cubatures (déblai, remblai, talus, recul, remblai périphérique) et métré comparés à des volumes calculés à la main |
| sorties | impression rapide PDF et PNG, planche de présentation en PDF, métré en PDF |
| sauvegarde | enregistrement automatique, proposition de récupération au redémarrage, historique des sauvegardes |
| hors-ligne | sans aucun réseau : mise en forme, PDF, 3D, découpe, lecteur PDF et carte depuis le dossier `lib/` |

Chaque suite échoue aussi si la page lève une erreur JavaScript ou une alerte imprévue.

## Règle

Tout bug corrigé ajoute un contrôle qui l'aurait détecté.

## Prérequis

Node.js et Playwright (Chromium). Les bibliothèques en ligne (mise en forme, 3D, PDF, carte) sont servies depuis `tests/vendor/` : la batterie tourne sans réseau. La suite `hors-ligne` vérifie aussi le dossier `lib/` posé à côté de index.html.
L'application testée est `../index.html` ; une autre peut être désignée avec la variable `MOMOCAD_APP=/chemin/index.html`.
