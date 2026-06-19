# Installation & Requirements — Carte Touch

The kiosk is a set of static files served by a tiny **local** web server (it must run over
`http://`, not opened straight from disk). It needs **no internet** at any point.

---

## 1. Minimum requirements

| Requirement | Details |
|-------------|---------|
| **Operating system** | Windows 10 / 11 (the launchers are `.bat` files; the no-install server uses built-in Windows PowerShell). |
| **Browser** | **Google Chrome** or **Microsoft Edge**, recent version. Needed for WebGL, fullscreen, and the PDF importer's save-to-folder feature. |
| **Graphics** | A GPU with **WebGL** (the book renders in 3D via `index.html`). |
| **Local web server** | Required to serve the files — **see section 2**. With the bundled Python included, there is **nothing to install**. |
| **Disk** | A few hundred MB for the app + your page images. |

---

## 2. The local web server (how it's provided)

The launch script (`start.bat`) automatically picks the first available option, in this order:

1. **Bundled Python** — `python313/` (shipped with the project) → *nothing to install*
2. **System Python** — if `python` / `python3` is on the machine
3. **Node.js** — if installed (`npx serve`)
4. **Windows PowerShell** — `server.ps1`, using the built-in `HttpListener`

Because option 4 is **built into Windows**, the kiosk will run **even with no Python and no
Node.js installed**.

---

## 3. If you remove the bundled Python (`python313/`)

The `python313/` folder (~21 MB) is included only so the kiosk is fully self-contained. **You can
delete it** to slim things down — here's what then applies:

- ✅ **It still runs on Windows** with **no install**, via the PowerShell fallback (`server.ps1`,
  port 8080).
- Optional installs (only if you prefer the Python/Node server options 2–3 above):
  - **Python 3** ([python.org](https://www.python.org/downloads/)) — tick *“Add Python to PATH”*.
  - **Node.js** ([nodejs.org](https://nodejs.org/)) — LTS version.

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
