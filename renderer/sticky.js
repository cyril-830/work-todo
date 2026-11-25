const { ipcRenderer } = require('electron')
const { channels } = require('../main/ipc-channels')

async function loadTodos() {
  try {
    const data = await ipcRenderer.invoke(channels.GET_TODO_LIST)
    renderTodos(data)
  } catch (e) {
    showError()
  }
}

function renderTodos(todos) {
  const listEl = document.getElementById('sticky-list')
  const emptyEl = document.getElementById('sticky-empty')
  const errorEl = document.getElementById('sticky-error')
  errorEl.style.display = 'none'
  if (!todos || todos.length === 0) {
    listEl.innerHTML = ''
    emptyEl.style.display = 'block'
    return
  }
  emptyEl.style.display = 'none'
  listEl.innerHTML = todos.map(todo => {
    const urgencyLevel = todo.urgency === '特别紧急' ? 'high' : (todo.urgency === '一般紧急' ? 'medium' : 'low')
    return `
    <div class="sticky-item">
      <div class="sticky-item-name"><span class="urgency-light urgency-${urgencyLevel}"></span>${escapeHtml(todo.name)}</div>
      <div class="sticky-item-date">${escapeHtml(todo.dueDate)}</div>
    </div>
  `}).join('')
}

function showError() {
  document.getElementById('sticky-list').innerHTML = ''
  document.getElementById('sticky-empty').style.display = 'none'
  document.getElementById('sticky-error').style.display = 'block'
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

document.getElementById('sticky-close').addEventListener('click', () => {
  ipcRenderer.invoke(channels.HIDE_WINDOW, 'sticky')
})

document.getElementById('sticky-minimize').addEventListener('click', () => {
  ipcRenderer.invoke(channels.HIDE_WINDOW, 'sticky')
})

document.getElementById('sticky-pin').addEventListener('click', async () => {
  const result = await ipcRenderer.invoke(channels.TOGGLE_PIN)
  const pinBtn = document.getElementById('sticky-pin')
  if (result.isPinned) {
    pinBtn.classList.add('pinned')
    pinBtn.classList.remove('unpinned')
  } else {
    pinBtn.classList.remove('pinned')
    pinBtn.classList.add('unpinned')
  }
})

async function initPinState() {
  try {
    const result = await ipcRenderer.invoke(channels.GET_PIN_STATE)
    const pinBtn = document.getElementById('sticky-pin')
    if (result.isPinned) {
      pinBtn.classList.add('pinned')
      pinBtn.classList.remove('unpinned')
    } else {
      pinBtn.classList.remove('pinned')
      pinBtn.classList.add('unpinned')
    }
  } catch (e) {
    // ignore
  }
}

document.getElementById('sticky-content').addEventListener('click', () => {
  ipcRenderer.invoke(channels.SWITCH_TO_MAIN)
})

ipcRenderer.on('refresh-sticky', () => {
  loadTodos()
})

initPinState()
loadTodos()