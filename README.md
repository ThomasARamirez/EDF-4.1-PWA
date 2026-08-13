# EDF-4.1-PWA

**Version 2.0.0** · [Version history](#version-history)

A weapon collection checklist for **Earth Defense Force 4.1: The Shadow of New Despair**.

Tick off weapons as you pick them up and track how close each class is to 100%. It's an installable, offline-capable web app — no account, no server, nothing to sign up for.

**Site: https://thomasaramirez.github.io/EDF-4.1-PWA**

---

## What's in it

All **812** weapons across the four classes, grouped by their in-game categories:

| Class | Weapons | Categories |
|---|---:|---:|
| Ranger | 193 | 7 |
| Wing Diver | 179 | 8 |
| Air Raider | 277 | 10 |
| Fencer | 163 | 6 |

DLC and 4.1-exclusive weapons are marked in the list (`*DLC`, `*4.1`).

## Features

- **Tap to collect** — each weapon is a toggle. Category and overall counters update as you go.
- **Autosave** — changes save automatically a moment after you stop tapping, with a small confirmation. There's no Save button to remember.
- **Search** — filter by weapon name across every category at once.
- **Bulk actions** — "Select All" for a whole class, or "Toggle All" within one category. Both ask for confirmation first, so a mistap can't wipe your progress.
- **Progress at a glance** — the main menu shows each class's count, and highlights a class once it hits 100%.
- **Export / Import** — save your progress to a file and load it on another browser or device.
- **Works offline** — install it to your home screen and it runs with no connection.
- **FX / SND** — toggles in the top-right corner of the menu turn off the animated background and the interface sound. Both default to off if your device has "reduce motion" enabled.

## Your data

Progress is stored in your browser's local storage on that device. Nothing is uploaded anywhere.

**That means clearing your browsing data will erase your progress.** Use **Export Progress** now and then to keep a backup file, and **Import Progress** to restore it or move to another browser.

> **Opera GX (desktop):** you may need to disable the ad blocker and tracker blocker for the Export button to work.

## Install

Open the site and use your browser's "Add to Home Screen" / "Install app" option. After the first load it works without a connection.

Updates apply automatically — the app checks for a new version on launch and when you switch back to it, then refreshes itself.

---

## For developers

Static site, no build step and no dependencies. Clone it and serve the folder:

```sh
python3 -m http.server 8000
```

### Layout

| File | Purpose |
|---|---|
| `index.html` | Main menu — class buttons with progress, export/import, FX/SND |
| `Ranger.html`, `Wingdiver.html`, `AirRaider.html`, `Fencer.html` | Class pages; each is a thin shell |
| `Ranger.js`, `Wingdiver.js`, `AirRaider.js`, `Fencer.js` | Weapon data only — category arrays, then one `createEDFPage()` call |
| `edf-page.js` | Shared checklist page: renders categories, search, autosave, bulk modal |
| `Main.js` | Main menu logic: progress tags, FX/SND prefs, export/import |
| `edf-hud.css` | Whole-app theme; `.menu-page` and `.checklist-page` sections |
| `sw-register.js` | Service worker registration and update-on-launch handling |
| `service-worker.js` | Offline precache + cache-first runtime |

Adding or renaming a weapon means editing only that class's data file.

### Save format

Progress lives in `localStorage` under one key per class (`rangerSave`, `wingdiverSave`, `airraiderSave`, `fencerSave`), as a JSON map of category id to the **array positions** of collected weapons:

```json
{ "assault-rifles": [0, 2, 5], "shotguns": [1] }
```

Two companion keys per class, `<key>_count` and `<key>_total`, let the main menu show progress without loading every class page.

> Because entries are stored by position, **reordering or removing a weapon mid-list will shift what existing saves point at.** Append new weapons at the end of a category, or bump the save format if a list genuinely has to be reordered.

### Changing cached files

The service worker precaches the whole app shell, and `cacheFirstExact()` matches URLs exactly — query string included. After editing a file:

1. Bump its `?v=` in the HTML that requests it.
2. Update the matching entry in `PRECACHE_URLS`.
3. Bump `CACHE_VERSION`, or the new list is never installed.

Every entry must resolve — `cache.addAll()` rejects on a single 404 and the install silently fails, taking offline support with it.

## Version history

Versions are recorded in two places — the footer on the main menu (`index.html`) and the heading of this file. Bump both together. `CACHE_VERSION` in `service-worker.js` is a separate counter that changes on *any* asset edit, so it deliberately doesn't track this.

### 2.0.0 — August 2026

Full visual redesign and a reworked interaction model. Major, because how the app is used changed, not just how it looks.

- New HUD theme across every page, replacing the original layout
- **Autosave** replaces the manual Save button — changes persist on their own
- Live weapon search
- Accordion categories, one open at a time
- Bulk select/deselect per category and per class, behind a confirmation
- Real progress counts on the main menu, plus a highlight at 100%
- FX / SND preference toggles, defaulting off under reduced-motion
- The app now updates itself instead of sitting behind a stale cache
- Self-hosted fonts, so nothing is fetched from a CDN at runtime

Saves carry over from 1.x untouched — the storage format did not change.

### 1.1.0 — August 2026

Repository audit and fixes, no visible feature changes.

- **Restored the missing PWA icons.** They were deleted on 2025-08-12 while `service-worker.js` still precached them. Because `cache.addAll()` rejects if any single URL 404s, this aborted the service worker install — so offline support had been silently broken for roughly a year.
- Self-hosted the three fonts that were declared in CSS but absent from the repo
- Removed duplicate and version-mismatched script loads on the class pages
- Corrected precache URLs that never matched what the pages actually requested

### 1.0.0 — August 2025

Original release: four class checklists, manual save, export/import, installable offline PWA.

## Credits

Weapon names and categories are from Earth Defense Force 4.1, © SANDLOT / D3 PUBLISHER. This is an unofficial fan-made checklist.

Built with [Claude Code](https://claude.com/claude-code).

Bundled fonts are used under the SIL Open Font License; see [`font-licenses/`](font-licenses/).

- [Orbitron](https://fonts.google.com/specimen/Orbitron) — The League of Moveable Type
- [Rajdhani](https://fonts.google.com/specimen/Rajdhani) — Indian Type Foundry
