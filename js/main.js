const {app, BrowserWindow, Tray, Menu, nativeImage, globalShortcut, ipcMain} = require("electron");
const path = require("path");
const fs = require("fs");
const {screen, dialog} = require("electron");  // ✅ 需要引入
let viewerWin = null;
const AutoLaunch = require("auto-launch");
let win;
let tray;

let configPath = path.join(__dirname, "../json/config.json");
let config = {
    togglePinShortcut: "Alt+1",
    showWindowShortcut: "Alt+2",
    showWindowDevTools: "Alt+0",
};
ipcMain.on("open-image-viewer", (_, src) => {
    createImageViewer(src);
});

ipcMain.handle("show-delete-dialog", async (event) => {

    const response = await dialog.showMessageBox(win, {
        type: "question",
        title: "温馨提示",
        message: "确定要删除这个TODO吗？",
        buttons: ["确定", "取消"],
    });
    console.log("用户选择:", response);
    return response.response === 0;
});

ipcMain.handle("show-clear-dialog", async () => {
    const {dialog} = require("electron");
    const response = await dialog.showMessageBox(win, {
        type: "warning",
        title: "温馨提示",
        message: "确定要删除所有TODO数据吗？此操作不可恢复！！！",
        buttons: ["确定", "取消"],
    });
    return response.response === 0;
});

ipcMain.on("focus-window", () => {
    if (win) win.focus();
});

const autoLauncher = new AutoLaunch({
    name: "憨憨每日Todo",
    path: app.getPath("exe"), // 当前 exe 路径
});


function createImageViewer() {
    viewerWin = new BrowserWindow({
        fullscreen: true,
        frame: false,
        show: false,                // ✅ 默认隐藏
        backgroundColor: "#000000",
        alwaysOnTop: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        skipTaskbar: true, // 不在任务栏显示图标
    });

    viewerWin.loadFile("./html/viewer.html");

    viewerWin.on("close", (e) => {
        e.preventDefault();         // ❌ 不销毁
        viewerWin.hide();           // ✅ 隐藏即可
    });
}

// 打开图片
ipcMain.on("open-image-viewer", (event, data) => {
    if (!viewerWin) createImageViewer();
    viewerWin.show();
    viewerWin.webContents.send("show-image", data);
});

// 删除图片
ipcMain.on("delete-image", (event, data) => {
    // 这里可以把删除逻辑回传到主窗口
    if (win) win.webContents.send("delete-image", data);
    if (viewerWin) viewerWin.hide();
});

// 🚀 读取配置文件
// 读取配置
function loadConfig() {
    if (fs.existsSync(configPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(configPath, "utf-8"));
            config = {...config, ...data};
        } catch (e) {
            console.error("读取配置文件失败，使用默认", e);
        }
    }
}

function openAboutWindow() {
    let aboutWin = new BrowserWindow({
        width: 500,
        height: 600,
        resizable: false,
        alwaysOnTop: true,
        autoHideMenuBar: true,
        title: "关于 憨憨每日Todo",
        icon: path.join(__dirname, "../static/icon.png"), // ✅ 设置和主程序相同的图标
        webPreferences: {
            nodeIntegration: true,
        },
    });

    aboutWin.loadURL("http://coder-kingyifan.github.io/todo-about/");

    aboutWin.on("closed", () => {
        aboutWin = null;
    });
}


function createWindow() {
    const iconPath = path.join(__dirname, "../static/icon.png");

    // 添加文件存在性检查
    if (!fs.existsSync(iconPath)) {
        console.error("图标文件不存在:", iconPath);
        // 可以选择使用备用图标或退出
    }

    win = new BrowserWindow({
        width: 450,
        height: 700,
        icon: iconPath,
        resizable: false,
        maximizable: false,
        minimizable: true,
        fullscreenable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            preload: path.join(__dirname, 'preload.js')
        },
        skipTaskbar: true, // 不在任务栏显示图标
    });

    // ✅ 改这里：加载本地 index.html
    win.loadFile("./html/index.html");

    win.setMenuBarVisibility(false);
    win.setAlwaysOnTop(true);

    // ✅ 获取屏幕尺寸
    const {width, height} = screen.getPrimaryDisplay().workAreaSize;

    // ✅ 把窗口放到右上角
    const winBounds = win.getBounds();
    win.setBounds({
        x: width - winBounds.width, // 屏幕右边 - 窗口宽度
        y: 0,                        // 顶部
        width: winBounds.width,
        height: winBounds.height,
    });

    // 隐藏滚动条但保留滚动功能
    win.webContents.on("did-finish-load", () => {
        win.webContents.insertCSS(`
      ::-webkit-scrollbar {
        width: 0px;
        height: 0px;
        background: transparent;
      }
    `);
    });

    // ------- 托盘按钮 -------
    const trayIcon = nativeImage.createFromPath(iconPath);
    if (!trayIcon.isEmpty()) {
        tray = new Tray(trayIcon);
        const contextMenu = Menu.buildFromTemplate([
            {
                label: "置顶",
                type: "checkbox",
                checked: true,
                click: (item) => {
                    win.setAlwaysOnTop(item.checked);
                },
            },
            {
                label: "开机自启",
                type: "checkbox",
                checked: false, // 默认不自启
                click: async (item) => {
                    if (item.checked) {
                        await autoLauncher.enable();
                    } else {
                        await autoLauncher.disable();
                    }
                }
            },
            {
                label: "关于",
                click: () => openAboutWindow(),
            },
            {role: "quit", label: "退出"},
        ]);
        tray.setToolTip("憨憨每日Todo");
        tray.setContextMenu(contextMenu);
        // ✅ 托盘图标双击事件
        tray.on("double-click", () => {
            if (win) {
                if (win.isMinimized()) win.restore(); // 如果被最小化，恢复
                win.show();  // 显示窗口
                win.focus(); // 聚焦窗口
            }
        });
    }
}

function registerShortcuts() {
    // 清理旧快捷键
    globalShortcut.unregisterAll();

    // 注册 显示/隐藏窗口
    const ok1 = globalShortcut.register(config.showWindowShortcut, () => {
        if (!win) return;

        if (win.isVisible()) {
            win.hide();
        } else {
            if (win.isMinimized()) win.restore();
            win.show();
            win.focus();
        }
    });


    // 注册 切换置顶
    const ok2 = globalShortcut.register(config.togglePinShortcut, () => {
        if (win && !win.isDestroyed()) { // ✅ 检查是否已销毁
            const newState = !win.isAlwaysOnTop();
            win.setAlwaysOnTop(newState);
        }
    });

    // 注册 调试工具快捷键 (F12)
    const ok3 = globalShortcut.register(config.showWindowDevTools, () => {
        if (win && !win.isDestroyed()) {
            win.webContents.openDevTools({mode: "detach"});
        }
    });

    // 检查快捷键是否注册成功
    if (!ok3) {
        console.log("F12 快捷键注册失败");
    }

}

app.whenReady().then(() => {
    loadConfig();
    createWindow();
    registerShortcuts();
});

app.on("will-quit", () => {
    globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
