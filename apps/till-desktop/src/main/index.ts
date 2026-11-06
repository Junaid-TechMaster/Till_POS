import { existsSync } from "node:fs";
import { app, BrowserWindow, ipcMain, shell } from "electron";
import { join } from "node:path";
import { PRODUCT_NAME } from "@tillpro/shared";
import { getDb } from "./db";
import { registerDatabaseIpc } from "./ipc";
import { activateLicence, checkForUpdate, licenceState } from "./licence";

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  const preloadJs = join(__dirname, "../preload/index.js");
  const preloadMjs = join(__dirname, "../preload/index.mjs");
  const preload = existsSync(preloadJs) ? preloadJs : preloadMjs;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    show: false,
    frame: false,
    backgroundColor: "#121417",
    title: PRODUCT_NAME,
    autoHideMenuBar: true,
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

function registerIpc(): void {
  ipcMain.handle("window:minimize", () => {
    mainWindow?.minimize();
  });
  ipcMain.handle("window:close", () => {
    mainWindow?.close();
  });
  ipcMain.handle("window:fullscreen", () => {
    if (!mainWindow) return false;
    const next = !mainWindow.isFullScreen();
    mainWindow.setFullScreen(next);
    return next;
  });
  ipcMain.handle("licence:state", () => licenceState());
  ipcMain.handle("licence:refresh", () => licenceState(true));
  ipcMain.handle("licence:activate", (_event, username: string, password: string) => activateLicence(username, password));
  ipcMain.handle("app:checkUpdate", () => checkForUpdate());
  ipcMain.handle("app:openExternal", (_event, url: string) => {
    if (typeof url !== "string" || !url.startsWith("https://")) return false;
    return shell.openExternal(url).then(() => true);
  });
  ipcMain.handle("window:kiosk", (_event, on: boolean) => {
    if (!mainWindow) return false;
    mainWindow.setKiosk(on);
    mainWindow.setFullScreen(on);
    return mainWindow.isKiosk();
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    if (process.platform === "win32") {
      app.setAppUserModelId("com.tillpro.desktop");
    }
    getDb();
    registerDatabaseIpc();
    registerIpc();
    createWindow();
  });

  app.on("window-all-closed", () => {
    app.quit();
  });
}
