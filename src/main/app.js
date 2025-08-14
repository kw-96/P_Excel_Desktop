/**
 * P_Excel桌面版 - 主进程入口文件
 * 负责应用生命周期管理和窗口创建
 */

const { app, BrowserWindow, Menu, Tray, ipcMain } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

// 应用管理器
const AppManager = require('./appManager');
const ConfigManager = require('./configManager');
const FileSystemManager = require('./fileSystemManager');
const IPCManager = require('./ipcManager');
const ResourceMonitor = require('./resourceMonitor');

class P_ExcelApp {
    constructor() {
        this.mainWindow = null;
        this.tray = null;
        this.appManager = new AppManager();
        this.fileSystemManager = new FileSystemManager();
        this.ipcManager = new IPCManager();
        this.resourceMonitor = new ResourceMonitor();
        
        this.setupEventHandlers();
    }

    /**
     * 设置应用事件处理器
     */
    setupEventHandlers() {
        // 应用准备就绪
        app.whenReady().then(() => {
            this.initialize();
        });

        // 所有窗口关闭
        app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') {
                app.quit();
            }
        });

        // 应用激活（macOS）
        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                this.createMainWindow();
            }
        });

        // 应用退出前
        app.on('before-quit', async () => {
            await this.cleanup();
        });
    }

    /**
     * 初始化应用
     */
    async initialize() {
        try {
            // 初始化各个管理器
            await this.appManager.initialize();
            
            // 设置全局引用供IPC使用
            global.appManager = this.appManager;
            
            await this.fileSystemManager.initialize();
            await this.ipcManager.initialize();
            await this.resourceMonitor.initialize();

            // 创建主窗口
            this.createMainWindow();

            // 设置应用菜单
            this.setupMenu();

            // 设置系统托盘
            this.setupSystemTray();

            console.log('P_Excel桌面版启动成功');
        } catch (error) {
            console.error('应用初始化失败:', error);
            app.quit();
        }
    }

    /**
     * 创建主窗口
     */
    createMainWindow() {
        this.mainWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            minWidth: 800,
            minHeight: 600,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                enableRemoteModule: false,
                preload: path.join(__dirname, '../renderer/preload.js')
            },
            icon: path.join(__dirname, '../../build/icon.png'),
            show: false, // 先隐藏，加载完成后显示
            titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default'
        });

        // 加载渲染进程页面
        const indexPath = path.join(__dirname, '../renderer/index.html');
        this.mainWindow.loadFile(indexPath);

        // 窗口准备显示时
        this.mainWindow.once('ready-to-show', () => {
            this.mainWindow.show();
            
            // 开发模式下打开开发者工具
            if (isDev) {
                this.mainWindow.webContents.openDevTools();
            }
        });

        // 窗口关闭时
        this.mainWindow.on('closed', () => {
            this.mainWindow = null;
        });

        return this.mainWindow;
    }

    /**
     * 设置应用菜单
     */
    setupMenu() {
        const template = [
            {
                label: '文件',
                submenu: [
                    {
                        label: '打开文件',
                        accelerator: 'CmdOrCtrl+O',
                        click: () => {
                            this.ipcManager.sendToRenderer('menu:open-file');
                        }
                    },
                    {
                        label: '保存',
                        accelerator: 'CmdOrCtrl+S',
                        click: () => {
                            this.ipcManager.sendToRenderer('menu:save');
                        }
                    },
                    { type: 'separator' },
                    {
                        label: '退出',
                        accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
                        click: () => {
                            app.quit();
                        }
                    }
                ]
            },
            {
                label: '编辑',
                submenu: [
                    { label: '撤销', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
                    { label: '重做', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
                    { type: 'separator' },
                    { label: '剪切', accelerator: 'CmdOrCtrl+X', role: 'cut' },
                    { label: '复制', accelerator: 'CmdOrCtrl+C', role: 'copy' },
                    { label: '粘贴', accelerator: 'CmdOrCtrl+V', role: 'paste' }
                ]
            },
            {
                label: '视图',
                submenu: [
                    { label: '重新加载', accelerator: 'CmdOrCtrl+R', role: 'reload' },
                    { label: '强制重新加载', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
                    { label: '开发者工具', accelerator: 'F12', role: 'toggleDevTools' },
                    { type: 'separator' },
                    { label: '实际大小', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
                    { label: '放大', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
                    { label: '缩小', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
                    { type: 'separator' },
                    { label: '全屏', accelerator: 'F11', role: 'togglefullscreen' }
                ]
            },
            {
                label: '帮助',
                submenu: [
                    {
                        label: '关于',
                        click: () => {
                            this.ipcManager.sendToRenderer('menu:about');
                        }
                    }
                ]
            }
        ];

        // macOS特殊处理
        if (process.platform === 'darwin') {
            template.unshift({
                label: app.getName(),
                submenu: [
                    { label: '关于 ' + app.getName(), role: 'about' },
                    { type: 'separator' },
                    { label: '服务', role: 'services', submenu: [] },
                    { type: 'separator' },
                    { label: '隐藏 ' + app.getName(), accelerator: 'Command+H', role: 'hide' },
                    { label: '隐藏其他', accelerator: 'Command+Shift+H', role: 'hideothers' },
                    { label: '显示全部', role: 'unhide' },
                    { type: 'separator' },
                    { label: '退出', accelerator: 'Command+Q', click: () => app.quit() }
                ]
            });
        }

        const menu = Menu.buildFromTemplate(template);
        Menu.setApplicationMenu(menu);
    }

    /**
     * 设置系统托盘
     */
    setupSystemTray() {
        // 创建托盘图标
        const trayIconPath = path.join(__dirname, '../../build/tray-icon.png');
        this.tray = new Tray(trayIconPath);

        // 设置托盘提示
        this.tray.setToolTip('P_Excel桌面版');

        // 创建托盘菜单
        const contextMenu = Menu.buildFromTemplate([
            {
                label: '显示主窗口',
                click: () => {
                    if (this.mainWindow) {
                        if (this.mainWindow.isMinimized()) {
                            this.mainWindow.restore();
                        }
                        this.mainWindow.show();
                        this.mainWindow.focus();
                    } else {
                        this.createMainWindow();
                    }
                }
            },
            {
                label: '隐藏窗口',
                click: () => {
                    if (this.mainWindow) {
                        this.mainWindow.hide();
                    }
                }
            },
            { type: 'separator' },
            {
                label: '打开文件',
                click: () => {
                    this.ipcManager.sendToRenderer('menu:open-file');
                }
            },
            { type: 'separator' },
            {
                label: '退出',
                click: () => {
                    app.quit();
                }
            }
        ]);

        // 设置托盘菜单
        this.tray.setContextMenu(contextMenu);

        // 双击托盘图标显示/隐藏窗口
        this.tray.on('double-click', () => {
            if (this.mainWindow) {
                if (this.mainWindow.isVisible()) {
                    this.mainWindow.hide();
                } else {
                    this.mainWindow.show();
                    this.mainWindow.focus();
                }
            } else {
                this.createMainWindow();
            }
        });

        console.log('系统托盘设置完成');
    }

    /**
     * 应用清理
     */
    async cleanup() {
        try {
            await this.resourceMonitor.cleanup();
            await this.fileSystemManager.cleanup();
            await this.appManager.cleanup();
            console.log('应用清理完成');
        } catch (error) {
            console.error('应用清理失败:', error);
        }
    }
}

// 创建应用实例
const p_excelApp = new P_ExcelApp();

module.exports = P_ExcelApp;