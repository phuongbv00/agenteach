import './main/utils/logger'; // must be first — hooks console.* before anything else
import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { spawn } from 'child_process';
import started from 'electron-squirrel-startup';
import { updateElectronApp } from 'update-electron-app';
import { registerHandlers } from './main/ipc/handlers';

if (started) app.quit();

updateElectronApp({ repo: 'phuongbv00/agenteach' });

let mainWindow: BrowserWindow | null = null;
let ollamaProcess: ReturnType<typeof spawn> | null = null;

async function tryStartOllama(): Promise<void> {
  try {
    const res = await fetch('http://localhost:11434/api/tags', {
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) return;
  } catch {
    // not running, try to start
  }

  const candidates =
    process.platform === 'win32'
      ? [path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Ollama', 'ollama.exe')]
      : ['/usr/local/bin/ollama', '/usr/bin/ollama', '/opt/homebrew/bin/ollama'];

  for (const bin of candidates) {
    try {
      ollamaProcess = spawn(bin, ['serve'], { detached: false, stdio: 'ignore' });
      ollamaProcess.unref();
      break;
    } catch {
      // try next candidate
    }
  }
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Agenteach',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  registerHandlers(mainWindow);
};

app.on('ready', async () => {
  await tryStartOllama();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', () => {
  ollamaProcess?.kill();
});
