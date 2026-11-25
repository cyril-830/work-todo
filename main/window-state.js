const fs = require('fs')
const path = require('path')
const { app } = require('electron')

class WindowStateManager {
  constructor() {
    this.statePath = path.join(app.getPath('userData'), 'window-state.json')
  }

  load() {
    try {
      if (!fs.existsSync(this.statePath)) return null
      const content = fs.readFileSync(this.statePath, 'utf-8')
      const state = JSON.parse(content)
      if (state && typeof state.x === 'number' && typeof state.y === 'number' &&
          typeof state.width === 'number' && typeof state.height === 'number') {
        return state
      }
      return null
    } catch {
      return null
    }
  }

  save(bounds, mode) {
    try {
      const data = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        lastActiveMode: mode || 'main'
      }
      const tmpPath = this.statePath + '.tmp'
      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
      fs.renameSync(tmpPath, this.statePath)
    } catch {
      // silently fail
    }
  }

  loadWithScreenCheck(screen) {
    const state = this.load()
    if (!state) return null

    const displays = screen.getAllDisplays()
    const isVisible = displays.some(d => {
      return state.x >= d.bounds.x - 50 && state.x <= d.bounds.x + d.bounds.width - 50 &&
             state.y >= d.bounds.y - 50 && state.y <= d.bounds.y + d.bounds.height - 50
    })

    if (!isVisible) {
      const primary = screen.getPrimaryDisplay()
      return {
        width: state.width,
        height: state.height,
        lastActiveMode: state.lastActiveMode
      }
    }

    return state
  }
}

module.exports = WindowStateManager