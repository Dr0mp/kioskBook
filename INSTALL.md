# Installation & Requirements — Carte Touch

The kiosk is a set of static files served by a tiny **local** web server (it must run over
`http://`, not opened straight from disk). It needs **no internet** at any point.

---

## 1. Minimum requirements

| Requirement | Details |
|-------------|---------|
| **Operating system** | Windows 10 / 11 (the launchers are `.bat` files; the no-install server uses built-in Windows PowerShell). |
| **Browser** | **Google Chrome** or **Microsoft Edge**, recent version. Needed for WebGL (3D book), fullscreen, and the PDF importer's save-to-folder feature. |
| **Graphics** | A GPU with **WebGL** for the **3D book** (`index.html`). The **light book** (`book-light.html`) runs on almost any hardware. |
| **Local web server** | Required to serve the files — **see section 2**. With the bundled Python included, there is **nothing to install**. |
| **Disk** | A few hundred MB for the app + your page images. |

---

## 2. The local web server (how it's provided)

The launch scripts (`start.bat`, `start-light.bat`) automatically pick the first available
option, in this order:

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

- ✅ **It still runs on Windows** with no install, via the PowerShell fallback (`server.ps1`).
- ⚠ **Port note:** `server.ps1` serves on **port 8080**, which matches the **3D book**
  (`start.bat`). The **light book** (`start-light.bat`) expects **8081** — so if you rely on the
  PowerShell fallback for the *light* book, either:
  - install **Python 3** ([python.org](https://www.python.org/downloads/)) or **Node.js**
    ([nodejs.org](https://nodejs.org/)) so the launcher uses those on 8081, **or**
  - ask the developer to make `server.ps1` accept the port (quick change).
- Optional installs (only if you want options 2 or 3 above):
  - **Python 3** — tick *“Add Python to PATH”* during setup.
  - **Node.js** — LTS version.

> Note: this only concerns the *web server*. The app's own libraries (three.js, turn.js, pdf.js,
> jQuery) are **bundled** in `lib/` and `trunjs4/` and are **not** something you install.

---

## 4. Installing on a kiosk PC

1. **Copy** the whole project folder to the kiosk computer.
2. **Add page images** to `assets/pages/ro/` (and `assets/pages/en/` if you use English in the 3D
   book), named `page-01.jpg`, `page-02.jpg`, … (see `admin-guide.html`).
3. *(Optional)* set the default language / look in `assets/user-config.json`.
4. **Double-click** `start.bat` (3D) or `start-light.bat` (light). A browser opens automatically.
5. Tap **“Touch to Begin”** — it goes fullscreen.

---

## 5. Recommended kiosk setup

- **Browser kiosk mode:** launch Chrome/Edge with `--kiosk` for a borderless, locked-down
  fullscreen (hides tabs/address bar). The "Touch to Begin" screen also triggers fullscreen.
- **Auto-start on boot:** put a shortcut to the `.bat` in the Windows *Startup* folder
  (`shell:startup`) or schedule it with Task Scheduler.
- **Disable** sleep, screensaver, and Windows notifications on the kiosk.
- The light book returns to the "Touch to Begin" screen after **5 minutes** of inactivity; the 3D
  book has its own idle "attract" camera mode.

---

## 6. Offline

Everything runs locally — no internet is required to launch or use the kiosk. The only feature that
benefits from a specific browser is the **PDF importer** (Chrome/Edge), used only by the operator,
not by visitors.
