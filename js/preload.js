const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
    toggleAlwaysOnTop: () => ipcRenderer.send("toggle-always-on-top"),
    onAlwaysOnTopChanged: (cb) => ipcRenderer.on("always-on-top-changed", (e, v) => cb(v))
});
