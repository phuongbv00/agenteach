import "./main/utils/logger"; // must be first — hooks console.* before anything else
import { app, BrowserWindow } from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";
import { updateElectronApp } from "update-electron-app";
import { registerHandlers } from "./main/ipc/handlers";
import { initDb } from "./main/db";
import { seedSkills } from "./main/plugins/seedSkills";
import { killLlamaCppProcess } from "./main/llm/LlamaCppLauncher";

if (started) app.quit();

updateElectronApp({ repo: "phuongbv00/agenteach" });

let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "Agenteach",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  registerHandlers(mainWindow);
};

app.on("ready", async () => {
  await initDb();
  seedSkills();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("before-quit", () => {
  killLlamaCppProcess();
});
