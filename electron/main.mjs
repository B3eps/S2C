import { app, BrowserWindow, dialog, Menu, shell } from 'electron';
import { preview } from 'vite';
import path from 'node:path';

let server;
let mainWindow;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.setName('S2C');
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

  app.whenReady().then(async () => {
    try {
      const root = app.getAppPath();
      process.chdir(app.getPath('userData'));
      Menu.setApplicationMenu(null);
      server = await preview({
        configFile: path.join(root, 'vite.config.ts'),
        root,
        logLevel: 'error',
        preview: { host: '127.0.0.1', port: 5198, strictPort: false },
      });
      const address = server.httpServer.address();
      if (!address || typeof address === 'string') throw new Error('Yerel uygulama sunucusu başlatılamadı.');
      const origin = `http://127.0.0.1:${address.port}`;

      mainWindow = new BrowserWindow({
        width: 1440,
        height: 920,
        minWidth: 1024,
        minHeight: 700,
        icon: path.join(root, 'electron/assets/s2c.png'),
        autoHideMenuBar: true,
        webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
      });
      mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        try {
          const target = new URL(url);
          if (target.protocol === 'https:' && ['bemfunding.com', 'www.bemfunding.com'].includes(target.hostname))
            void shell.openExternal(target.toString());
        } catch { /* Ignore malformed links. */ }
        return { action: 'deny' };
      });
      mainWindow.webContents.on('will-navigate', (event, url) => {
        if (!url.startsWith(`${origin}/`)) event.preventDefault();
      });
      mainWindow.on('closed', () => { mainWindow = undefined; });
      await mainWindow.loadURL(origin);
    } catch (error) {
      dialog.showErrorBox('S2C başlatılamadı', error instanceof Error ? error.message : String(error));
      app.quit();
    }
  });

  app.on('before-quit', () => {
    if (server) void new Promise((resolve) => server.httpServer.close(resolve));
  });
}
