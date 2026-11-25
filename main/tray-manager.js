const { Tray, Menu, app, nativeImage } = require('electron')
const path = require('path')

let tray = null

function getIconPath() {
  return path.join(__dirname, '..', 'assets', 'icon.ico')
}

function createTray({ onShow, onQuit }) {
  const icon = nativeImage.createFromPath(getIconPath())
  if (icon.isEmpty()) {
    throw new Error(`无法加载托盘图标: ${getIconPath()}`)
  }

  try {
    tray = new Tray(icon)
    tray.setToolTip('工作待办')

    const contextMenu = Menu.buildFromTemplate([
      { label: '显示主窗口', click: onShow },
      { type: 'separator' },
      { label: '退出', click: onQuit }
    ])

    tray.setContextMenu(contextMenu)
    tray.on('double-click', onShow)
  } catch {
    tray = null
  }

  return tray
}

function destroyTray() {
  if (tray) {
    tray.destroy()
    tray = null
  }
}

function hasTray() {
  return tray !== null
}

module.exports = { createTray, destroyTray, hasTray }
