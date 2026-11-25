const fs = require('fs')
const path = require('path')
const { app } = require('electron')
const { generateId, formatNow } = require('./models')

class FileStorageAdapter {
  constructor() {
    this.dataDir = path.join(app.getPath('userData'), 'data')
    this.todosPath = path.join(this.dataDir, 'todos.json')
    this.donesPath = path.join(this.dataDir, 'dones.json')
  }

  _ensureDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true })
    }
  }

  _readFile(filePath) {
    this._ensureDir()
    if (!fs.existsSync(filePath)) {
      return []
    }
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      return JSON.parse(content)
    } catch {
      return []
    }
  }

  _writeFile(filePath, data) {
    this._ensureDir()
    const tmpPath = filePath + '.tmp'
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
    fs.renameSync(tmpPath, filePath)
  }

  _readTodos() {
    return this._readFile(this.todosPath)
  }

  _writeTodos(todos) {
    this._writeFile(this.todosPath, todos)
  }

  _readDones() {
    return this._readFile(this.donesPath)
  }

  _writeDones(dones) {
    this._writeFile(this.donesPath, dones)
  }

  findTodoById(id) {
    const todos = this._readTodos()
    return todos.find(t => t.id === id) || null
  }

  findDoneById(id) {
    const dones = this._readDones()
    return dones.find(d => d.id === id) || null
  }

  addTodo(params) {
    const todos = this._readTodos()
    const item = {
      id: generateId(),
      name: params.name,
      dueDate: params.dueDate,
      source: params.source,
      urgency: params.urgency || '不紧急',
      workType: params.workType || '其他',
      content: params.content || '',
      role: params.role || '参与',
      reminderAt: params.reminderAt || '',
      reminderNotified: false,
      createdAt: formatNow()
    }
    todos.unshift(item)
    this._writeTodos(todos)
    return item
  }

  updateTodo(id, params) {
    const todos = this._readTodos()
    const index = todos.findIndex(t => t.id === id)
    if (index === -1) {
      throw new Error('事项不存在')
    }
    todos[index].name = params.name
    todos[index].dueDate = params.dueDate
    todos[index].source = params.source
    todos[index].urgency = params.urgency || '不紧急'
    todos[index].workType = params.workType || '其他'
    todos[index].content = params.content || ''
    todos[index].role = params.role || '参与'
    todos[index].reminderAt = params.reminderAt || ''
    todos[index].reminderNotified = false
    this._writeTodos(todos)
    return todos[index]
  }

  deleteTodo(id) {
    const todos = this._readTodos()
    const index = todos.findIndex(t => t.id === id)
    if (index === -1) {
      throw new Error('事项不存在')
    }
    todos.splice(index, 1)
    this._writeTodos(todos)
    return true
  }

  getTodoList() {
    const todos = this._readTodos()
    return todos.map(t => {
      if (!t.urgency) t.urgency = '不紧急'
      if (!t.workType) t.workType = '其他'
      if (!t.role) t.role = '参与'
      if (t.content == null) t.content = ''
      return t
    })
  }

  addDone(params) {
    const dones = this._readDones()
    const item = {
      id: generateId(),
      name: params.name,
      completedDate: params.completedDate,
      source: params.source,
      workType: params.workType || '其他',
      content: params.content || '',
      role: params.role || '参与',
      originType: params.originType,
      createdAt: formatNow()
    }
    dones.unshift(item)
    this._writeDones(dones)
    return item
  }

  deleteDone(id) {
    const dones = this._readDones()
    const index = dones.findIndex(d => d.id === id)
    if (index === -1) {
      throw new Error('事项不存在')
    }
    dones.splice(index, 1)
    this._writeDones(dones)
    return true
  }

  getDoneList(filter) {
    let dones = this._readDones()
    const year = Number(filter && filter.year)
    const month = Number(filter && filter.month)
    const hasYear = Number.isInteger(year) && year > 0
    const hasMonth = Number.isInteger(month) && month >= 1 && month <= 12
    if (hasYear || hasMonth) {
      dones = dones.filter(d => {
        // completedDate is stored as YYYY-MM-DD. Parse the calendar fields
        // directly so filtering is strict and cannot be shifted by time zones.
        const match = /^(\d{4})-(\d{2})/.exec(String(d.completedDate || ''))
        if (!match) return false
        const completedYear = Number(match[1])
        const completedMonth = Number(match[2])
        return (!hasYear || completedYear === year) &&
          (!hasMonth || completedMonth === month)
      })
    }
    if (filter && filter.keyword && filter.keyword.trim()) {
      const kw = filter.keyword.trim().toLowerCase()
      dones = dones.filter(d =>
        (d.name && d.name.toLowerCase().includes(kw)) ||
        (d.source && d.source.toLowerCase().includes(kw))
      )
    }
    return dones
  }
}

module.exports = FileStorageAdapter
