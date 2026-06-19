# Carte Touch — Interactive Kiosk Book

An offline, touchscreen "flip-book" application for kiosks. A set of page images is
presented as a book the visitor can browse by tapping/swiping. It ships in **two
viewers** that read the same page folders:

| Viewer | File | Description |
|--------|------|-------------|
| **3D book** | `index.html` | A realistic 3D book on a table (WebGL), with a page-curl flip, decorative props, lighting, an idle "attract" camera mode, a developer panel, and a built-in PDF→pages importer. English + Romanian. |
| **Light book** | `book-light.html` | A lightweight, flat 2D page-flip — faster and simpler, for lower-powered hardware. Romanian only, with a 5-minute inactivity reset. |

Everything runs **100% offline** — no internet connection, CDN, or external service is
required at runtime.

---

## Running it

Double-click one of the launch scripts (they start a tiny local web server and open a browser):

- `start.bat` → 3D book at `http://localhost:8080`
- `start-light.bat` → light book at `http://localhost:8081/book-light.html`

> The app must be served over `http://` (the `.bat` files handle this). Opening the
> `.html` files directly from disk will not work correctly (fullscreen, image loading).

Recommended browser: **Google Chrome** or **Microsoft Edge** (required for the PDF importer's
save-to-folder feature).

> **Requirements & installation:** see [`INSTALL.md`](INSTALL.md) — including what's needed if you
> remove the bundled `python313/` server.

---

## How pages work

Pages are plain image files loaded in numeric order from:

```
assets/pages/en/   ← English pages
assets/pages/ro/   ← Romanian pages
```

- Named `page-01.jpg`, `page-02.jpg`, … `page-100.jpg`, `page-200.jpg` (2-digit minimum).
- Formats: `.jpg` `.jpeg` `.png` (the 3D book also supports `.mp4` / `.webm` video pages).
- Missing numbers are tolerated (up to 5 in a row) — the book skips gaps and stops after the end.
- The light book intentionally starts at `page-02` (ignores `page-01`).

**Page images are not included in this repository** (see [`.gitignore`](.gitignore)). Drop the
`page-NN.jpg` files into the `assets/pages/<lang>/` folders on the deployment machine.

A full, non-technical operator manual is included:
- `admin-guide.html` (English) · `admin-guide-ro.html` (Romanian)

---

## Configuration

`assets/user-config.json` holds the default settings bundled with the kiosk (start language,
camera positions, lighting, audio levels, quality, navigation mode, etc.). On the 3D book you can
adjust everything live in the developer panel (press **D**), click **Save All**, then **Export
Config** to regenerate this file. The configured `book-lang` always wins on launch.

---

## Project structure

```
index.html            3D book viewer
book-light.html       Light (2D) book viewer
book.js               3D scene, page-flip logic, PDF importer hook, navigation
attract.js            Idle/attract camera mode (3D)
dev.js                Developer panel (3D)
pdf-import.js         PDF → page-NN.jpg converter (dev panel)
config.js             Base config (sounds, colours, camera presets)
audio.js / music.js   Sound effects and background music
lib/                  three.js, GLTFLoader, TransformControls, pdf.js (+ worker)
trunjs4/lib|extras/   turn.js + jQuery (used by the light book)
assets/
  pages/en|ro/        Page images  (NOT in repo)
  models/             3D props (.glb) + manifest
  music/ sounds/      Audio
  textures/ book/     Table texture, page-edge graphic
  user-config.json    Bundled default settings
admin-guide*.html     Operator manual (EN / RO)
start*.bat            Launchers
```

---

## Third-party libraries

This project bundles the following open/third-party libraries (all served locally):

| Library | Version | Purpose | License |
|---------|---------|---------|---------|
| [three.js](https://threejs.org) | bundled (`lib/three.min.js`) | WebGL 3D rendering (3D book) | MIT |
| three.js `GLTFLoader`, `TransformControls` | bundled | Load `.glb` models / editor gizmos | MIT |
| [pdf.js](https://mozilla.github.io/pdf.js/) | v3.x (`lib/pdf.min.js`) | Render PDF pages to images (importer) | Apache-2.0 (Mozilla) |
| [turn.js](https://www.turnjs.com) | 4.1.0 (`trunjs4/lib/turn.js`) | 2D page-flip (light book) | © Emmanuel García — see note below |
| [jQuery](https://jquery.com) | 1.7 (`trunjs4/extras/jquery.min.1.7.js`) | Required by turn.js | MIT |

> **⚠ turn.js license note:** the bundled turn.js is the **4th release** (`turnjs.com/license.txt`,
> © 2012 Emmanuel García). The 4th release is **not** the free BSD version (that is turn.js 3) and
> **may require a paid commercial license** for production/commercial use. Please review
> `turnjs.com/license.txt` and obtain the appropriate license, or switch the light book to
> turn.js 3 (BSD), before commercial deployment.

Each library retains its own copyright and license; see the headers inside the respective files
in `lib/` and `trunjs4/`.

---

## Copyright

© 2026 **[Project Owner / Client name]**. All rights reserved.

The application code in this repository (the viewers, scene logic, dev panel, PDF importer,
and configuration) is proprietary to the project owner. Page content (the book images) is the
property of its respective owner. Third-party libraries are licensed separately as listed above.

_Replace “[Project Owner / Client name]” with the actual owner before distribution._
