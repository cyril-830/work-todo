const { ipcRenderer } = require('electron')
const { channels } = require('../main/ipc-channels')

function validateTodoParams(params) {
  const errors = {}
  if (!params.name || !params.name.trim()) {
    errors.name = '请填写事项名称'
  } else if (params.name.trim().length > 100) {
    errors.name = '事项名称不能超过100个字符'
  }
  if (!params.dueDate) {
    errors.dueDate = '请选择交付日期'
  }
  if (params.source && params.source.trim().length > 50) {
    errors.source = '任务来源不能超过50个字符'
  }
  if (!params.workType) errors.workType = '请选择工作类型'
  if (!params.content || !params.content.trim()) errors.content = '请填写工作内容'
  if (!params.role) errors.role = '请选择担任角色'
  return errors
}

async function createTodo(params) {
  const errors = validateTodoParams(params)
  if (Object.keys(errors).length > 0) {
    return { success: false, errors }
  }
  try {
    const data = await ipcRenderer.invoke(channels.CREATE_TODO, params)
    return { success: true, data }
  } catch (e) {
    return { success: false, errors: { _general: e.message } }
  }
}

async function updateTodo(id, params) {
  const errors = validateTodoParams(params)
  if (Object.keys(errors).length > 0) {
    return { success: false, errors }
  }
  try {
    const data = await ipcRenderer.invoke(channels.UPDATE_TODO, id, params)
    return { success: true, data }
  } catch (e) {
    return { success: false, errors: { _general: e.message } }
  }
}

async function deleteTodo(id) {
  try {
    await ipcRenderer.invoke(channels.DELETE_TODO, id)
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

async function getTodoList() {
  try {
    const data = await ipcRenderer.invoke(channels.GET_TODO_LIST)
    return { success: true, data }
  } catch (e) {
    return { success: false, error: e.message, data: [] }
  }
}

async function completeTodo(id) {
  try {
    const data = await ipcRenderer.invoke(channels.COMPLETE_TODO, id)
    return { success: true, data }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

module.exports = { validateTodoParams, createTodo, updateTodo, deleteTodo, getTodoList, completeTodo }
