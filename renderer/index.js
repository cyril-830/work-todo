const { ipcRenderer } = require('electron')
const { channels } = require('../main/ipc-channels')
const { createTodo, updateTodo, deleteTodo, getTodoList, completeTodo } = require('./todo-service')
const { createDone, deleteDone, getDoneList, revertDone } = require('./done-service')

let currentTodos = []
let currentDones = []
let editingId = null

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'))
    btn.classList.add('active')
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active')
    if (btn.dataset.tab === 'done') {
      loadDoneList()
    } else {
      loadTodoList()
    }
  })
})

document.getElementById('btn-create').addEventListener('click', () => {
  editingId = null
  document.getElementById('modal-title').textContent = '创建待办'
  document.getElementById('todo-name').value = ''
  document.getElementById('todo-due-date').value = ''
  document.getElementById('todo-source').value = ''
  document.getElementById('todo-content').value = ''
  document.getElementById('todo-reminder').value = ''
  const defaultUrgency = document.querySelector('input[name="urgency"][value="不紧急"]')
  if (defaultUrgency) defaultUrgency.checked = true
  clearErrors()
  openModal()
})

document.getElementById('btn-modal-close').addEventListener('click', closeModal)
document.getElementById('btn-cancel').addEventListener('click', closeModal)
document.getElementById('modal-overlay').addEventListener('click', closeModal)

document.getElementById('btn-submit').addEventListener('click', handleSubmit)

document.getElementById('todo-list').addEventListener('click', (e) => {
  const btn = e.target.closest('button')
  if (!btn) return
  const id = btn.dataset.id
  if (btn.classList.contains('btn-edit')) {
    openEditModal(id)
  } else if (btn.classList.contains('btn-complete')) {
    handleComplete(id)
  } else if (btn.classList.contains('btn-delete')) {
    handleDelete(id)
  }
})

function filterTodos(todos, keyword) {
  if (!keyword || !keyword.trim()) return todos
  const kw = keyword.trim().toLowerCase()
  return todos.filter(t =>
    (t.name && t.name.toLowerCase().includes(kw)) ||
    (t.content && t.content.toLowerCase().includes(kw)) ||
    (t.source && t.source.toLowerCase().includes(kw))
  )
}

function sortTodos(todos, sortValue) {
  if (!sortValue) return todos
  const [field, order] = sortValue.split('-')
  const sorted = [...todos].sort((a, b) => {
    const va = a[field] || ''
    const vb = b[field] || ''
    if (!va && vb) return order === 'asc' ? 1 : -1
    if (va && !vb) return order === 'asc' ? -1 : 1
    if (!va && !vb) return 0
    const cmp = va.localeCompare(vb)
    return order === 'asc' ? cmp : -cmp
  })
  return sorted
}

async function loadTodoList() {
  const result = await getTodoList()
  currentTodos = result.data
  const keyword = document.getElementById('todo-search').value
  const sortValue = document.getElementById('todo-sort').value
  let filtered = filterTodos(currentTodos, keyword)
  let sorted = sortTodos(filtered, sortValue)
  renderTodoList(sorted, !!keyword && keyword.trim())
}

function renderTodoList(todos, isSearching) {
  const listEl = document.getElementById('todo-list')
  const emptyEl = document.getElementById('todo-empty')
  if (todos.length === 0) {
    listEl.innerHTML = ''
    if (isSearching) {
      emptyEl.textContent = '未找到匹配的待办事项'
    } else {
      emptyEl.textContent = '暂无待办事项'
    }
    emptyEl.style.display = 'block'
    return
  }
  emptyEl.textContent = '暂无待办事项'
  emptyEl.style.display = 'none'
  const now = new Date()
  const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0')
  listEl.innerHTML = todos.map(function(todo) {
    const isOverdue = todo.dueDate && todo.dueDate < today
    const overdueAttr = isOverdue ? ' class="overdue"' : ''
    const urgencyLevel = todo.urgency === '特别紧急' ? 'high' : (todo.urgency === '一般紧急' ? 'medium' : 'low')
    return '<div class="todo-item" data-id="' + todo.id + '">' +
      '<div class="todo-info">' +
      '<div class="todo-name"><span class="urgency-light urgency-' + urgencyLevel + '"></span>' + escapeHtml(todo.name) + '</div>' +
      '<div class="todo-meta">' +
      '<span' + overdueAttr + '>交付日期: ' + escapeHtml(todo.dueDate) + '</span>' +
      '<span class="work-badge">' + escapeHtml(todo.workType || '其他') + '</span>' +
      '<span>' + escapeHtml(todo.role || '参与') + '</span>' +
      (todo.reminderAt ? '<span>提醒: ' + escapeHtml(todo.reminderAt.replace('T', ' ')) + '</span>' : '') +
      (todo.source ? '<span>来源: ' + escapeHtml(todo.source) + '</span>' : '') +
      '<div class="todo-description">' + escapeHtml(todo.content || '') + '</div>' +
      '</div></div>' +
      '<div class="todo-actions">' +
      '<button class="btn btn-sm btn-edit" data-id="' + todo.id + '">编辑</button>' +
      '<button class="btn btn-sm btn-success btn-complete" data-id="' + todo.id + '">确认完成</button>' +
      '<button class="btn btn-sm btn-danger btn-delete" data-id="' + todo.id + '">删除</button>' +
      '</div></div>'
  }).join('')
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function showConfirm(message) {
  return new Promise(resolve => {
    const modal = document.getElementById('confirm-modal')
    const msgEl = document.getElementById('confirm-message')
    const okBtn = document.getElementById('confirm-ok')
    const cancelBtn = document.getElementById('confirm-cancel')
    const overlay = document.getElementById('confirm-overlay')
    msgEl.textContent = message
    modal.classList.add('active')
    function cleanup() {
      modal.classList.remove('active')
      okBtn.removeEventListener('click', onOk)
      cancelBtn.removeEventListener('click', onCancel)
      overlay.removeEventListener('click', onCancel)
    }
    function onOk() { cleanup(); resolve(true) }
    function onCancel() { cleanup(); resolve(false) }
    okBtn.addEventListener('click', onOk)
    cancelBtn.addEventListener('click', onCancel)
    overlay.addEventListener('click', onCancel)
  })
}

function showToast(message, type) {
  const container = document.getElementById('toast-container')
  const toast = document.createElement('div')
  toast.className = 'toast toast-' + (type || 'info')
  toast.textContent = message
  container.appendChild(toast)
  setTimeout(() => {
    toast.classList.add('toast-hide')
    setTimeout(() => toast.remove(), 300)
  }, 2000)
}

function openModal() {
  document.getElementById('todo-modal').classList.add('active')
}

function closeModal() {
  document.getElementById('todo-modal').classList.remove('active')
}

function clearErrors() {
  document.getElementById('name-error').textContent = ''
  document.getElementById('due-date-error').textContent = ''
  document.getElementById('source-error').textContent = ''
  document.getElementById('work-type-error').textContent = ''
  document.getElementById('content-error').textContent = ''
  document.getElementById('role-error').textContent = ''
}

function showErrors(errors) {
  document.getElementById('name-error').textContent = errors.name || ''
  document.getElementById('due-date-error').textContent = errors.dueDate || ''
  document.getElementById('source-error').textContent = errors.source || ''
  document.getElementById('work-type-error').textContent = errors.workType || ''
  document.getElementById('content-error').textContent = errors.content || ''
  document.getElementById('role-error').textContent = errors.role || ''
}

function openEditModal(id) {
  const todo = currentTodos.find(t => t.id === id)
  if (!todo) return
  editingId = id
  document.getElementById('modal-title').textContent = '编辑待办'
  document.getElementById('todo-name').value = todo.name
  document.getElementById('todo-due-date').value = todo.dueDate
  document.getElementById('todo-source').value = todo.source
  document.getElementById('todo-content').value = todo.content || ''
  document.getElementById('todo-work-type').value = todo.workType || '其他'
  document.getElementById('todo-role').value = todo.role || '参与'
  document.getElementById('todo-reminder').value = todo.reminderAt || ''
  const urgencyRadio = document.querySelector('input[name="urgency"][value="' + (todo.urgency || '不紧急') + '"]')
  if (urgencyRadio) urgencyRadio.checked = true
  clearErrors()
  openModal()
}

async function handleSubmit() {
  const checkedUrgency = document.querySelector('input[name="urgency"]:checked')
  const params = {
    name: document.getElementById('todo-name').value,
    dueDate: document.getElementById('todo-due-date').value,
    source: document.getElementById('todo-source').value,
    content: document.getElementById('todo-content').value,
    workType: document.getElementById('todo-work-type').value,
    role: document.getElementById('todo-role').value,
    reminderAt: document.getElementById('todo-reminder').value,
    urgency: checkedUrgency ? checkedUrgency.value : '不紧急'
  }
  let result
  if (editingId) {
    result = await updateTodo(editingId, params)
  } else {
    result = await createTodo(params)
  }
  if (!result.success) {
    showErrors(result.errors)
    return
  }
  closeModal()
  showToast(editingId ? '修改成功' : '创建成功', 'success')
  loadTodoList()
}

async function handleComplete(id) {
  if (!await showConfirm('确认完成该待办事项？')) return
  const result = await completeTodo(id)
  if (!result.success) {
    showToast(result.error, 'error')
    return
  }
  showToast('已完成', 'success')
  loadTodoList()
}

async function handleDelete(id) {
  if (!await showConfirm('确认删除该待办事项？删除后不可恢复。')) return
  const result = await deleteTodo(id)
  if (!result.success) {
    showToast(result.error, 'error')
    return
  }
  showToast('已删除', 'success')
  loadTodoList()
}

function getDoneFilter() {
  const yearVal = document.getElementById('filter-year').value
  const monthVal = document.getElementById('filter-month').value
  const filter = {}
  if (yearVal) filter.year = Number(yearVal)
  if (monthVal) filter.month = Number(monthVal)
  return Object.keys(filter).length > 0 ? filter : null
}

async function loadDoneList() {
  const filter = getDoneFilter() || {}
  const keyword = document.getElementById('done-search').value
  if (keyword && keyword.trim()) {
    filter.keyword = keyword.trim()
  }
  const result = await getDoneList(Object.keys(filter).length > 0 ? filter : null)
  currentDones = result.data
  renderDoneList(currentDones, !!(keyword && keyword.trim()))
}

function renderDoneList(dones, isSearching) {
  const listEl = document.getElementById('done-list')
  const emptyEl = document.getElementById('done-empty')
  const filterEmptyEl = document.getElementById('done-filter-empty')
  const hasFilter = document.getElementById('filter-year').value || document.getElementById('filter-month').value || isSearching
  if (dones.length === 0) {
    listEl.innerHTML = ''
    if (isSearching) {
      emptyEl.style.display = 'none'
      filterEmptyEl.textContent = '未找到匹配的办结事项'
      filterEmptyEl.style.display = 'block'
    } else if (hasFilter) {
      emptyEl.style.display = 'none'
      filterEmptyEl.textContent = '当前筛选条件下无已完成工作'
      filterEmptyEl.style.display = 'block'
    } else {
      emptyEl.style.display = 'block'
      filterEmptyEl.style.display = 'none'
    }
    return
  }
  emptyEl.style.display = 'none'
  filterEmptyEl.style.display = 'none'
  listEl.innerHTML = dones.map(done => `
    <div class="todo-item" data-id="${done.id}">
      <div class="todo-info">
        <div class="todo-name">${escapeHtml(done.name)}</div>
        <div class="todo-meta">
          <span>完成时间: ${escapeHtml(done.completedDate.replace('T', ' '))}</span>
          <span class="work-badge">${escapeHtml(done.workType || '其他')}</span>
          <span>${escapeHtml(done.role || '参与')}</span>
          ${done.source ? `<span>来源: ${escapeHtml(done.source)}</span>` : ''}
          <div class="todo-description">${escapeHtml(done.content || '')}</div>
          <span class="origin-badge ${done.originType === '待办转入' ? 'from-todo' : 'manual'}">${done.originType}</span>
        </div>
      </div>
      <div class="todo-actions">
        <button class="btn btn-sm btn-revert" data-id="${done.id}">转回待办</button>
        <button class="btn btn-sm btn-danger btn-delete-done" data-id="${done.id}">删除</button>
      </div>
    </div>
  `).join('')
}

function initDoneFilter() {
  const yearSelect = document.getElementById('filter-year')
  const monthSelect = document.getElementById('filter-month')
  const currentYear = new Date().getFullYear()
  yearSelect.innerHTML = '<option value="">全部年份</option>'
  for (let y = currentYear; y >= currentYear - 5; y--) {
    yearSelect.innerHTML += `<option value="${y}">${y}年</option>`
  }
  monthSelect.innerHTML = '<option value="">全部月份</option>'
  for (let m = 1; m <= 12; m++) {
    monthSelect.innerHTML += `<option value="${m}">${m}月</option>`
  }
}

function openDoneModal() {
  document.getElementById('done-name').value = ''
  const now = new Date()
  document.getElementById('done-date').value = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0') + 'T' + String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0')
  document.getElementById('done-source').value = ''
  document.getElementById('done-content').value = ''
  clearDoneErrors()
  document.getElementById('done-modal').classList.add('active')
}

function closeDoneModal() {
  document.getElementById('done-modal').classList.remove('active')
}

function clearDoneErrors() {
  document.getElementById('done-name-error').textContent = ''
  document.getElementById('done-date-error').textContent = ''
  document.getElementById('done-source-error').textContent = ''
  document.getElementById('done-work-type-error').textContent = ''
  document.getElementById('done-content-error').textContent = ''
  document.getElementById('done-role-error').textContent = ''
}

function showDoneErrors(errors) {
  document.getElementById('done-name-error').textContent = errors.name || ''
  document.getElementById('done-date-error').textContent = errors.completedDate || ''
  document.getElementById('done-source-error').textContent = errors.source || ''
  document.getElementById('done-work-type-error').textContent = errors.workType || ''
  document.getElementById('done-content-error').textContent = errors.content || ''
  document.getElementById('done-role-error').textContent = errors.role || ''
}

async function handleDoneSubmit() {
  const params = {
    name: document.getElementById('done-name').value,
    completedDate: document.getElementById('done-date').value,
    source: document.getElementById('done-source').value,
    workType: document.getElementById('done-work-type').value,
    content: document.getElementById('done-content').value,
    role: document.getElementById('done-role').value
  }
  const result = await createDone(params)
  if (!result.success) {
    showDoneErrors(result.errors)
    return
  }
  closeDoneModal()
  showToast('添加成功', 'success')
  loadDoneList()
}

async function handleRevertDone(id) {
  if (!await showConfirm('确认将该办结事项转回待办？')) return
  const result = await revertDone(id)
  if (!result.success) {
    showToast(result.error, 'error')
    return
  }
  showToast('已转回待办', 'success')
  loadDoneList()
}

async function handleDeleteDone(id) {
  if (!await showConfirm('确认删除该办结事项？删除后不可恢复。')) return
  const result = await deleteDone(id)
  if (!result.success) {
    showToast(result.error, 'error')
    return
  }
  showToast('已删除', 'success')
  loadDoneList()
}

document.getElementById('btn-create-done').addEventListener('click', openDoneModal)
document.getElementById('btn-done-modal-close').addEventListener('click', closeDoneModal)
document.getElementById('btn-done-cancel').addEventListener('click', closeDoneModal)
document.getElementById('done-modal-overlay').addEventListener('click', closeDoneModal)
document.getElementById('btn-done-submit').addEventListener('click', handleDoneSubmit)

document.getElementById('done-list').addEventListener('click', (e) => {
  const btn = e.target.closest('button')
  if (!btn) return
  const id = btn.dataset.id
  if (btn.classList.contains('btn-revert')) {
    handleRevertDone(id)
  } else if (btn.classList.contains('btn-delete-done')) {
    handleDeleteDone(id)
  }
})

document.getElementById('filter-year').addEventListener('change', loadDoneList)
document.getElementById('filter-month').addEventListener('change', loadDoneList)

document.getElementById('todo-search').addEventListener('input', loadTodoList)
document.getElementById('todo-sort').addEventListener('change', loadTodoList)
document.getElementById('done-search').addEventListener('input', loadDoneList)

initDoneFilter()

document.getElementById('btn-sticky').addEventListener('click', () => {
  ipcRenderer.invoke(channels.SWITCH_TO_STICKY)
})

document.getElementById('btn-check-updates').addEventListener('click', async () => {
  const result = await ipcRenderer.invoke(channels.CHECK_FOR_UPDATES)
  if (result.status === 'dev-build') showToast('开发运行状态无法检查更新，请使用安装版', 'info')
  else if (result.status === 'error') showToast('检查更新失败：' + result.message, 'error')
  else showToast('正在检查更新…', 'info')
})

ipcRenderer.on('app:updateStatus', async (_event, info) => {
  if (info.status === 'available') {
    if (await showConfirm('发现新版本 ' + info.version + '，现在下载吗？')) {
      await ipcRenderer.invoke(channels.DOWNLOAD_UPDATE)
      showToast('开始下载更新', 'info')
    }
  } else if (info.status === 'not-available') showToast('当前已是最新版本', 'success')
  else if (info.status === 'downloading') showToast('正在下载更新：' + info.percent + '%', 'info')
  else if (info.status === 'downloaded') {
    if (await showConfirm('更新已下载完成，立即重启并安装吗？')) ipcRenderer.invoke(channels.INSTALL_UPDATE)
    else showToast('更新将在你确认后安装', 'info')
  } else if (info.status === 'error') showToast('更新失败：' + info.message, 'error')
})

document.getElementById('btn-save').addEventListener('click', async () => {
  const result = await ipcRenderer.invoke(channels.SAVE_DATA)
  if (result.success) {
    showToast('保存成功', 'success')
  } else {
    showToast('保存失败：' + result.error, 'error')
  }
})

document.getElementById('btn-export-todo').addEventListener('click', async () => {
  const result = await ipcRenderer.invoke(channels.EXPORT_TODO)
  if (result.success && result.path) {
    if (result.fallback) {
      showToast('所选格式暂不可用，已导出为 JSON 格式', 'info')
    } else {
      showToast('导出成功', 'success')
    }
  } else if (result.error) {
    showToast('导出失败：' + result.error, 'error')
  }
})

document.getElementById('btn-export-done').addEventListener('click', async () => {
  const result = await ipcRenderer.invoke(channels.EXPORT_DONE)
  if (result.success && result.path) {
    if (result.fallback) {
      showToast('所选格式暂不可用，已导出为 JSON 格式', 'info')
    } else {
      showToast('导出成功', 'success')
    }
  } else if (result.error) {
    showToast('导出失败：' + result.error, 'error')
  }
})

ipcRenderer.on('refresh-data', () => {
  loadTodoList()
})

function checkReminders() {
  ipcRenderer.invoke(channels.REMINDER_DUE).then(count => {
    if (count > 0) loadTodoList()
  }).catch(() => {})
}
setInterval(checkReminders, 15000)
checkReminders()

loadTodoList()
