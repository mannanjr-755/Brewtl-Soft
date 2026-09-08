const { app, BrowserWindow, shell, Menu } = require("electron");
const path = require("path");

/** Production CRM — same live deployment used by the web CRM. */
const CRM_URL = process.env.CRM_DESKTOP_URL || "https://frontend-bay-mu-50.vercel.app";

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: "BON PANIER CRM",
    backgroundColor: "#050505",
    autoHideMenuBar: true,
    show: false,
    icon: path.join(__dirname, "build", "icon.ico"),
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

  mainWindow.loadURL(CRM_URL, {
    userAgent: `${mainWindow.webContents.getUserAgent()} BONPanierCRMDesktop/1.0`,
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
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
