const { app, BrowserWindow, shell, Menu } = require("electron");
const fs = require("fs");
const path = require("path");

/** Production CRM — same live deployment used by the web CRM. */
const CRM_URL = process.env.CRM_DESKTOP_URL || "https://frontend-bay-mu-50.vercel.app";

let mainWindow = null;

function resolveAppIcon() {
  const candidates = [
    path.join(process.resourcesPath || "", "icon.ico"),
    path.join(__dirname, "build", "icon.ico"),
    path.join(__dirname, "icon.ico"),
  ];
  for (const candidate of candidates) {
    try {
      if (candidate && fs.existsSync(candidate)) return candidate;
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

function offlineHtml(detail) {
  const safeDetail = String(detail || "Unable to reach the CRM server.")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>BREWTL CRM</title>
  <style>
    html,body{margin:0;height:100%;font-family:Segoe UI,sans-serif;background:#101820;color:#f2ede3;}
    main{min-height:100%;display:flex;align-items:center;justify-content:center;padding:32px;text-align:center;}
    .card{max-width:420px;border:1px solid #2a3642;background:#1a2530;border-radius:16px;padding:28px 24px;}
    h1{margin:0 0 8px;font-size:22px;letter-spacing:.04em;color:#ddbe7e;}
    p{margin:0 0 12px;color:#b9b2a5;line-height:1.5;font-size:14px;}
    code{display:block;margin:12px 0 18px;padding:10px;border-radius:8px;background:#0d141b;color:#ddbe7e;font-size:12px;word-break:break-all;}
    button{appearance:none;border:0;border-radius:10px;background:#c6a15b;color:#101820;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:12px 18px;cursor:pointer;}
    button:hover{filter:brightness(1.08);}
  </style>
</head>
<body>
  <main>
    <div class="card">
      <h1>BREWTL CRM</h1>
      <p>The desktop app could not load the live CRM. Check your internet connection, then try again.</p>
      <code>${safeDetail}</code>
      <button onclick="location.reload()">Retry</button>
    </div>
  </main>
</body>
</html>`;
}

function createWindow() {
  const icon = resolveAppIcon();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: "BREWTL CRM",
    backgroundColor: "#101820",
    autoHideMenuBar: true,
    show: false,
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  // Remove default Electron/Chromium application menu (no framework branding).
  Menu.setApplicationMenu(null);

  mainWindow.once("ready-to-show", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Keep CRM routes in-app; open external links in the system browser.
    try {
      const target = new URL(url);
      const appOrigin = new URL(CRM_URL).origin;
      if (target.origin === appOrigin) {
        return { action: "allow" };
      }
    } catch {
      /* ignore */
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame || !mainWindow || mainWindow.isDestroyed()) return;
    // Ignore aborted navigations (user refresh / redirect).
    if (errorCode === -3) return;
    const detail = `${errorDescription || "Load failed"} (${errorCode}) · ${validatedURL || CRM_URL}`;
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(offlineHtml(detail))}`);
  });

  mainWindow.loadURL(CRM_URL, {
    userAgent: `${mainWindow.webContents.getUserAgent()} BREWTLCRMDesktop/1.0`,
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    if (process.platform === "win32") {
      app.setAppUserModelId("com.brewtl.crm");
    }
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
