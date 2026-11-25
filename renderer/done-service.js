const { ipcRenderer } = require('electron')
const { channels } = require('../main/ipc-channels')

function validateDoneParams(params) {
  const errors = {}
  if (!params.name || !params.name.trim()) {
    errors.name = '请填写事项名称'
  } else if (params.name.trim().length > 100) {
    errors.name = '事项名称不能超过100个字符'
  }
  if (!params.completedDate) {
    errors.completedDate = '请选择完成日期'
  }
  if (params.source && params.source.trim().length > 50) {
    errors.source = '任务来源不能超过50个字符'
  }
  if (!params.workType) errors.workType = '请选择工作类型'
  if (!params.content || !params.content.trim()) errors.content = '请填写工作内容'
  if (!params.role) errors.role = '请选择担任角色'
  return errors
}

async function createDone(params) {
  const errors = validateDoneParams(params)
  if (Object.keys(errors).length > 0) {
    return { success: false, errors }
  }
  try {
    const data = await ipcRenderer.invoke(channels.CREATE_DONE, params)
    return { success: true, data }
  } catch (e) {
    return { success: false, errors: { _general: e.message } }
  }
}

async function deleteDone(id) {
  try {
    await ipcRenderer.invoke(channels.DELETE_DONE, id)
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

async function getDoneList(filter) {
  try {
    const data = await ipcRenderer.invoke(channels.GET_DONE_LIST, filter)
    return { success: true, data }
  } catch (e) {
    return { success: false, error: e.message, data: [] }
  }
}

async function revertDone(id) {
  try {
    const data = await ipcRenderer.invoke(channels.REVERT_DONE, id)
    return { success: true, data }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

module.exports = { validateDoneParams, createDone, deleteDone, getDoneList, revertDone }
