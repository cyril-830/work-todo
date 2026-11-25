const { app, BrowserWindow, ipcMain, screen, dialog } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')
const { registerIpcHandlers, channels } = require('./ipc-channels')
const { createTray, destroyTray, hasTray } = require('./tray-manager')
const WindowStateManager = require('./window-state')

let mainWindow = null
let stickyWindow = null
let lastActiveMode = 'main'
let isQuitting = false
let windowStateManager = null
let updateDownloaded = false

function publishUpdateStatus(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('app:updateStatus', payload)
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.on('checking-for-update', () => publishUpdateStatus({ status: 'checking' }))
  autoUpdater.on('update-available', info => publishUpdateStatus({ status: 'available', version: info.version }))
  autoUpdater.on('update-not-available', () => publishUpdateStatus({ status: 'not-available' }))
  autoUpdater.on('download-progress', progress => publishUpdateStatus({ status: 'downloading', percent: Math.round(progress.percent) }))
  autoUpdater.on('update-downloaded', info => {
    updateDownloaded = true
    publishUpdateStatus({ status: 'downloaded', version: info.version })
  })
  autoUpdater.on('error', error => publishUpdateStatus({ status: 'error', message: error.message }))
  ipcMain.handle(channels.CHECK_FOR_UPDATES, async () => {
    if (!app.isPackaged) return { status: 'dev-build' }
    try { await autoUpdater.checkForUpdates(); return { status: 'checking' } }
    catch (error) { return { status: 'error', message: error.message } }
  })
  ipcMain.handle(channels.DOWNLOAD_UPDATE, async () => {
    try { await autoUpdater.downloadUpdate(); return { status: 'downloading' } }
    catch (error) { return { status: 'error', message: error.message } }
  })
  ipcMain.handle(channels.INSTALL_UPDATE, () => {
    if (updateDownloaded) autoUpdater.quitAndInstall()
  })
}

function createMainWindow(bounds) {
  const options = {
    width: 900,
    height: 650,
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  }
  if (bounds) {
    options.x = bounds.x
    options.y = bounds.y
    options.width = bounds.width
    options.height = bounds.height
  }

  mainWindow = new BrowserWindow(options)

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'))

  mainWindow.on('close', (event) => {
    if (!isQuitting && hasTray()) {
      event.preventDefault()
      lastActiveMode = 'main'
      if (windowStateManager) {
        windowStateManager.save(mainWindow.getBounds(), lastActiveMode)
      }
      mainWindow.hide()
    }
  })
}

function createStickyWindow() {
  if (stickyWindow) {
    stickyWindow.webContents.send('refresh-sticky')
    stickyWindow.show()
    return
  }

  stickyWindow = new BrowserWindow({
    width: 280,
    height: 400,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: true,
    resizable: false,
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  stickyWindow.loadFile(path.join(__dirname, '..', 'renderer', 'sticky.html'))

  stickyWindow.on('close', (event) => {
    if (!isQuitting && hasTray()) {
      event.preventDefault()
      lastActiveMode = 'sticky'
      stickyWindow.hide()
    }
  })
}

function showWindow() {
  if (lastActiveMode === 'sticky' && stickyWindow) {
    stickyWindow.show()
    stickyWindow.focus()
  } else if (mainWindow) {
    mainWindow.show()
    mainWindow.focus()
  } else {
    createMainWindow()
    mainWindow.show()
    mainWindow.focus()
  }
}

function quitApp() {
  if (mainWindow && windowStateManager) {
    windowStateManager.save(mainWindow.getBounds(), lastActiveMode)
  }
  isQuitting = true
  destroyTray()
  app.quit()
}

app.whenReady().then(() => {
  windowStateManager = new WindowStateManager()
  const savedState = windowStateManager.loadWithScreenCheck(screen)
  if (savedState) {
    lastActiveMode = savedState.lastActiveMode || 'main'
  }
  createMainWindow(savedState)
  app.setAppUserModelId('com.worktodo.app')
  setupAutoUpdater()
  registerIpcHandlers()

  createTray({
    onShow: showWindow,
    onQuit: quitApp
  })

  setTimeout(() => {
    if (app.isPackaged) autoUpdater.checkForUpdates().catch(error => console.warn('自动更新检查失败:', error.message))
  }, 12000)

  ipcMain.handle(channels.SWITCH_TO_STICKY, () => {
    if (mainWindow) mainWindow.hide()
    createStickyWindow()
  })

  ipcMain.handle(channels.SWITCH_TO_MAIN, () => {
    if (stickyWindow) stickyWindow.hide()
    if (mainWindow) {
      mainWindow.setSkipTaskbar(false)
      mainWindow.show()
      mainWindow.webContents.send('refresh-data')
    }
  })

  ipcMain.handle(channels.HIDE_WINDOW, (_event, mode) => {
    if (mode === 'sticky' && stickyWindow) {
      lastActiveMode = 'sticky'
      stickyWindow.hide()
    } else if (mainWindow) {
      lastActiveMode = 'main'
      mainWindow.hide()
    }
  })

  ipcMain.handle(channels.TOGGLE_PIN, () => {
    if (!stickyWindow) return { isPinned: true }
    const newState = !stickyWindow.isAlwaysOnTop()
    stickyWindow.setAlwaysOnTop(newState)
    return { isPinned: newState }
  })

  ipcMain.handle(channels.GET_PIN_STATE, () => {
    if (!stickyWindow) return { isPinned: true }
    return { isPinned: stickyWindow.isAlwaysOnTop() }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (!hasTray()) {
    app.quit()
  }
})
