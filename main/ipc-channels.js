const { ipcMain, dialog, Notification } = require('electron')
const fs = require('fs')
const FileStorageAdapter = require('../services/file-storage')
const { formatLocalDate } = require('../services/models')
const { TODO_COLUMNS, DONE_COLUMNS, formatJSON, formatTxt, formatExcel, formatWord } = require('../services/export-formatter')

const EXPORT_FILTERS = [
  { name: 'Excel 文件', extensions: ['xlsx'] },
  { name: 'Word 文件', extensions: ['docx'] },
  { name: '记事本文件', extensions: ['txt'] },
  { name: 'JSON 文件', extensions: ['json'] }
]

async function doExport(data, columns, titlePrefix) {
  const today = formatLocalDate()
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: `${titlePrefix}_${today}.xlsx`,
    filters: EXPORT_FILTERS
  })
  if (canceled) return { success: true }

  const ext = filePath.split('.').pop().toLowerCase()
  try {
    let content
    let fallback = false

    if (ext === 'json') {
      content = formatJSON(data)
    } else if (ext === 'txt') {
      content = formatTxt(data, columns)
    } else if (ext === 'xlsx') {
      try {
        content = await formatExcel(data, columns, titlePrefix)
      } catch {
        content = formatJSON(data)
        fallback = true
      }
    } else if (ext === 'docx') {
      try {
        content = await formatWord(data, columns, titlePrefix)
      } catch {
        content = formatJSON(data)
        fallback = true
      }
    } else {
      content = formatJSON(data)
    }

    const tmpPath = filePath + '.tmp'
    if (Buffer.isBuffer(content)) {
      fs.writeFileSync(tmpPath, content)
    } else {
      fs.writeFileSync(tmpPath, content, 'utf-8')
    }
    fs.renameSync(tmpPath, filePath)
    return { success: true, path: filePath, fallback }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

const channels = {
  CREATE_TODO: 'todo:create',
  UPDATE_TODO: 'todo:update',
  DELETE_TODO: 'todo:delete',
  GET_TODO_LIST: 'todo:getList',
  COMPLETE_TODO: 'todo:complete',
  CREATE_DONE: 'done:create',
  DELETE_DONE: 'done:delete',
  GET_DONE_LIST: 'done:getList',
  REVERT_DONE: 'done:revert',
  SWITCH_TO_STICKY: 'window:switchToSticky',
  SWITCH_TO_MAIN: 'window:switchToMain',
  HIDE_WINDOW: 'window:hide',
  EXPORT_TODO: 'todo:export',
  EXPORT_DONE: 'done:export',
  TOGGLE_PIN: 'window:togglePin',
  GET_PIN_STATE: 'window:getPinState',
  SAVE_DATA: 'data:save',
  REMINDER_DUE: 'todo:reminderDue',
  CHECK_FOR_UPDATES: 'app:checkForUpdates',
  DOWNLOAD_UPDATE: 'app:downloadUpdate',
  INSTALL_UPDATE: 'app:installUpdate'
}

function validateTodoParams(params) {
  if (!params || !params.name || !params.name.trim()) {
    throw new Error('工作名称不能为空')
  }
  if (!params.dueDate) {
    throw new Error('请选择交付日期')
  }
  if (params.source && params.source.trim().length > 50) {
    throw new Error('任务来源不能超过50个字符')
  }
  if (!['研究型工作', '支撑性工作', '事务性工作', '其他'].includes(params.workType)) throw new Error('请选择工作类型')
  if (!params.content || !params.content.trim()) throw new Error('请填写工作内容')
  if (!['主要贡献者', '次要贡献者', '审核把关', '参与'].includes(params.role)) throw new Error('请选择担任角色')
  if (params.urgency && !['特别紧急', '一般紧急', '不紧急'].includes(params.urgency)) {
    throw new Error('紧急程度值无效')
  }
}

function validateDoneParams(params) {
  if (!params || !params.name || !params.name.trim()) {
    throw new Error('工作名称不能为空')
  }
  if (!params.completedDate) {
    throw new Error('请选择完成日期')
  }
  if (params.source && params.source.trim().length > 50) throw new Error('任务来源不能超过50个字符')
  if (!['研究型工作', '支撑性工作', '事务性工作', '其他'].includes(params.workType)) throw new Error('请选择工作类型')
  if (!params.content || !params.content.trim()) throw new Error('请填写工作内容')
  if (!['主要贡献者', '次要贡献者', '审核把关', '参与'].includes(params.role)) throw new Error('请选择担任角色')
}

function registerIpcHandlers() {
  const storage = new FileStorageAdapter()

  ipcMain.handle(channels.GET_TODO_LIST, async () => {
    return storage.getTodoList()
  })

  ipcMain.handle(channels.CREATE_TODO, async (_event, params) => {
    validateTodoParams(params)
    return storage.addTodo(params)
  })

  ipcMain.handle(channels.UPDATE_TODO, async (_event, id, params) => {
    validateTodoParams(params)
    return storage.updateTodo(id, params)
  })

  ipcMain.handle(channels.DELETE_TODO, async (_event, id) => {
    return storage.deleteTodo(id)
  })

  ipcMain.handle(channels.COMPLETE_TODO, async (_event, id) => {
    const todo = storage.findTodoById(id)
    if (!todo) {
      throw new Error('事项不存在')
    }
    const doneItem = storage.addDone({
      name: todo.name,
      completedDate: formatLocalDate(),
      workType: todo.workType, content: todo.content, role: todo.role,
      source: todo.source,
      originType: '待办转入'
    })
    try {
      storage.deleteTodo(id)
    } catch (e) {
      console.error('办结已创建但删除待办失败:', e.message)
    }
    return doneItem
  })

  ipcMain.handle(channels.GET_DONE_LIST, async (_event, filter) => {
    const dones = storage.getDoneList(filter)
    return dones.sort((a, b) => b.completedDate.localeCompare(a.completedDate))
  })

  ipcMain.handle(channels.CREATE_DONE, async (_event, params) => {
    validateDoneParams(params)
    return storage.addDone({ ...params, originType: '手动添加' })
  })

  ipcMain.handle(channels.DELETE_DONE, async (_event, id) => {
    return storage.deleteDone(id)
  })

  ipcMain.handle(channels.REVERT_DONE, async (_event, id) => {
    const done = storage.findDoneById(id)
    if (!done) {
      throw new Error('事项不存在')
    }
    const todoItem = storage.addTodo({
      name: done.name,
      dueDate: done.completedDate,
      source: done.source
    })
    try {
      storage.deleteDone(id)
    } catch (e) {
      console.error('待办已创建但删除办结失败:', e.message)
    }
    return todoItem
  })

  ipcMain.handle(channels.EXPORT_TODO, async () => {
    const data = storage.getTodoList()
    return await doExport(data, TODO_COLUMNS, '待办事项')
  })

  ipcMain.handle(channels.EXPORT_DONE, async () => {
    const data = storage.getDoneList()
    return await doExport(data, DONE_COLUMNS, '办结事项')
  })


  ipcMain.handle(channels.SAVE_DATA, async () => {
    try {
      storage.getTodoList()
      storage.getDoneList()
      return { success: true }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle(channels.REMINDER_DUE, async () => {
    const now = Date.now()
    const due = storage.getTodoList().filter(t => t.reminderAt && !t.reminderNotified && new Date(t.reminderAt).getTime() <= now)
    for (const todo of due) {
      if (Notification.isSupported()) new Notification({ title: '工作待办提醒', body: todo.name, silent: false }).show()
      const todos = storage._readTodos()
      const item = todos.find(t => t.id === todo.id)
      if (item) item.reminderNotified = true
      storage._writeTodos(todos)
    }
    return due.length
  })
}

module.exports = { channels, registerIpcHandlers }
