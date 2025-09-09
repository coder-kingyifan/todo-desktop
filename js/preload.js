const {ipcRenderer} = require('electron');

// 在无上下文隔离模式下直接挂载到 window 对象
window.electronAPI = {
    showClearDialog: () => ipcRenderer.invoke('show-clear-dialog'),
    showDeleteDialog: () => ipcRenderer.invoke('show-delete-dialog')
};