# Installation & Requirements — Carte Touch

The kiosk is a set of static files served by a tiny **local** web server (it must run over
`http://`, not opened straight from disk). It needs **no internet** at any point.

---

## 1. Minimum requirements

| Requirement | Details |
|-------------|---------|
| **Operating system** | Windows 10 / 11 (the launcher is a `.bat` file; the no-install server uses built-in Windows PowerShell). |
| **Browser** | **Google Chrome** or **Microsoft Edge**, recent version. Needed for WebGL, fullscreen, and the PDF importer's save-to-folder feature. |
| **Graphics** | A GPU with **WebGL** (the book renders in 3D via `index.html`). |
| **Local web server** | Required to serve the files — **see section 2**. Uses **built-in Windows PowerShell**, so there is **nothing to install**. |
| **Disk** | A few hundred MB for the app + your page images. |

---

## 2. The local web server (how it's provided)

The launch script (`start.bat`) starts a server automatically.
**Every option is fully offline — nothing is ever downloaded:**

- **By default it uses built-in Windows PowerShell** (`server.ps1`, via `HttpListener`) → *nothing to install*.
- **If Python is available** it uses that instead — either a `python313/` folder placed next to
  `start.bat`, or a system-installed `python` / `python3`.

Because the default path is **built into Windows**, the kiosk runs out of the box with **no install
and no Python required**.

---

## 3. Optional: using Python instead

The PowerShell server is enough on its own. If you prefer Python (a slightly faster static
server), either:

- Install **Python 3** ([python.org](https://www.python.org/downloads/), tick *“Add Python to
  PATH”*) — `start.bat` will detect and use it, **or**
- Drop a portable **`python313/`** folder next to `start.bat`.

Neither is required.

> Note: this only concerns the *web server*. The app's own libraries (three.js, pdf.js) are
> **bundled** in `lib/` and are **not** something you install.

---

## 4. Installing on a kiosk PC

1. **Copy** the whole project folder to the kiosk computer.
2. **Add page images** to `assets/pages/ro/` (and `assets/pages/en/` for English), named
   `page-01.jpg`, `page-02.jpg`, … (see `admin-guide.html`).
3. *(Optional)* set the default language / look in `assets/user-config.json`.
4. **Double-click** `start.bat`. A browser opens automatically.
5. Tap **“Touch to Begin”** — it goes fullscreen.

---

## 5. Recommended kiosk setup

- **Browser kiosk mode:** launch Chrome/Edge with `--kiosk` for a borderless, locked-down
  fullscreen (hides tabs/address bar). The "Touch to Begin" screen also triggers fullscreen.
- **Auto-start on boot:** put a shortcut to the `.bat` in the Windows *Startup* folder
  (`shell:startup`) or schedule it with Task Scheduler.
- **Disable** sleep, screensaver, and Windows notifications on the kiosk.
- When idle, the book eases into an "attract" camera view automatically.

---

## 6. Offline

Everything runs locally — no internet is required to launch or use the kiosk. The only feature that
benefits from a specific browser is the **PDF importer** (Chrome/Edge), used only by the operator,
not by visitors.
