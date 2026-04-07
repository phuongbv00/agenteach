import path from 'node:path';
import fs from 'node:fs';
import log from 'electron-log/main';

// File: ~/Library/Logs/<appName>/main.log (macOS)
//       %APPDATA%\<appName>\logs\main.log  (Windows)
log.transports.file.level = 'debug';
log.transports.file.maxSize = 10 * 1024 * 1024; // 10 MB per file
log.transports.console.level = 'debug';

// Delete log files older than 30 days on startup
try {
  const logDir = path.dirname(log.transports.file.getFile().path);
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  for (const name of fs.readdirSync(logDir)) {
    const full = path.join(logDir, name);
    if (fs.statSync(full).mtimeMs < cutoff) fs.unlinkSync(full);
  }
} catch { /* ignore */ }

// Hook console.* in main process
Object.assign(console, log.functions);

// Hook console.* in renderer processes via IPC (electron-log v5)
log.initialize();

// Capture unhandled errors
process.on('uncaughtException', (err) => {
  log.error('[uncaughtException]', err);
});
process.on('unhandledRejection', (reason) => {
  log.error('[unhandledRejection]', reason);
});

export default log;
export const logFilePath = (): string => log.transports.file.getFile().path;
