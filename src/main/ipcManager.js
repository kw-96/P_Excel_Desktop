/**
 * 进程间通信管理器 - 负责主进程与渲染进程的通信
 */

const { ipcMain, BrowserWindow } = require('electron');

class IPCManager {
    constructor() {
        this.channels = new Map();
        this.workerPool = null; // 将在后续任务中实现
        this.mainWindow = null;
    }

    /**
     * 初始化IPC管理器
     */
    async initialize() {
        try {
            // 注册基础IPC通道
            this.registerBasicChannels();
            
            console.log('IPC管理器初始化完成');
        } catch (error) {
            console.error('IPC管理器初始化失败:', error);
            throw error;
        }
    }

    /**
     * 注册基础IPC通道
     */
    registerBasicChannels() {
        // 文件操作
        this.registerChannel('file:open', this.handleFileOpen.bind(this));
        this.registerChannel('file:save', this.handleFileSave.bind(this));
        
        // 数据处理
        this.registerChannel('data:process', this.handleDataProcess.bind(this));
        
        // 系统信息
        this.registerChannel('system:info', this.handleSystemInfo.bind(this));
        this.registerChannel('system:memory', this.handleMemoryInfo.bind(this));
        
        // 配置管理
        this.registerChannel('config:get', this.handleConfigGet.bind(this));
        this.registerChannel('config:set', this.handleConfigSet.bind(this));
        
        // 窗口控制
        this.registerChannel('window:minimize', this.handleWindowMinimize.bind(this));
        this.registerChannel('window:maximize', this.handleWindowMaximize.bind(this));
        this.registerChannel('window:close', this.handleWindowClose.bind(this));
        
        // 应用信息
        this.registerChannel('app:version', this.handleAppVersion.bind(this));
        this.registerChannel('app:info', this.handleAppInfo.bind(this));
        
        // 开发工具
        this.registerChannel('dev:open-tools', this.handleOpenDevTools.bind(this));
        
        // 渲染进程就绪信号
        ipcMain.on('renderer:ready', this.handleRendererReady.bind(this));
    }

    /**
     * 注册IPC通道
     */
    registerChannel(name, handler) {
        if (this.channels.has(name)) {
            console.warn(`IPC通道 ${name} 已存在，将被覆盖`);
        }

        this.channels.set(name, handler);
        ipcMain.handle(name, handler);
        
        console.log(`注册IPC通道: ${name}`);
    }

    /**
     * 发送消息到渲染进程
     */
    sendToRenderer(channel, data) {
        const windows = BrowserWindow.getAllWindows();
        windows.forEach(window => {
            if (!window.isDestroyed()) {
                window.webContents.send(channel, data);
            }
        });
    }

    /**
     * 发送消息到主窗口
     */
    sendToMainWindow(channel, data) {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send(channel, data);
        }
    }

    /**
     * 设置主窗口引用
     */
    setMainWindow(window) {
        this.mainWindow = window;
    }

    // ==================== IPC处理器 ====================

    /**
     * 处理文件打开
     */
    async handleFileOpen(event) {
        try {
            const { dialog } = require('electron');
            
            const result = await dialog.showOpenDialog({
                title: '选择文件',
                filters: [
                    { name: 'Excel文件', extensions: ['xlsx', 'xls'] },
                    { name: 'CSV文件', extensions: ['csv'] },
                    { name: '所有支持的文件', extensions: ['xlsx', 'xls', 'csv'] }
                ],
                properties: ['openFile', 'multiSelections']
            });

            if (result.canceled) {
                return null;
            }

            // 这里应该返回文件信息，实际的文件解析将在后续任务中实现
            return result.filePaths.map(filePath => ({
                path: filePath,
                name: require('path').basename(filePath),
                size: require('fs').statSync(filePath).size
            }));

        } catch (error) {
            console.error('文件打开失败:', error);
            throw error;
        }
    }

    /**
     * 处理文件保存
     */
    async handleFileSave(event, data, options = {}) {
        try {
            const { dialog } = require('electron');
            const path = require('path');
            
            const { format = 'excel' } = options;
            const filters = format === 'csv' 
                ? [{ name: 'CSV文件', extensions: ['csv'] }]
                : [{ name: 'Excel文件', extensions: ['xlsx'] }];

            const result = await dialog.showSaveDialog({
                title: '保存文件',
                defaultPath: `processed_data.${format === 'csv' ? 'csv' : 'xlsx'}`,
                filters
            });

            if (result.canceled) {
                return null;
            }

            // 这里应该实现实际的文件保存逻辑
            // 暂时返回保存路径
            console.log('保存文件到:', result.filePath);
            return { filePath: result.filePath, success: true };

        } catch (error) {
            console.error('文件保存失败:', error);
            throw error;
        }
    }

    /**
     * 处理数据处理
     */
    async handleDataProcess(event, data, rules) {
        try {
            // 这里应该调用数据处理引擎
            // 暂时返回模拟结果
            console.log('处理数据:', { dataSize: data?.length || 0, rules });
            
            // 模拟处理时间
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            return {
                success: true,
                processedData: data,
                message: '数据处理完成'
            };

        } catch (error) {
            console.error('数据处理失败:', error);
            throw error;
        }
    }

    /**
     * 处理系统信息获取
     */
    async handleSystemInfo(event) {
        try {
            const os = require('os');
            
            return {
                platform: os.platform(),
                arch: os.arch(),
                release: os.release(),
                hostname: os.hostname(),
                cpus: os.cpus().length,
                totalMemory: os.totalmem(),
                freeMemory: os.freemem(),
                uptime: os.uptime(),
                loadavg: os.loadavg()
            };

        } catch (error) {
            console.error('获取系统信息失败:', error);
            throw error;
        }
    }

    /**
     * 处理内存信息获取
     */
    async handleMemoryInfo(event) {
        try {
            const memoryUsage = process.memoryUsage();
            const os = require('os');
            
            return {
                used: memoryUsage.heapUsed,
                total: memoryUsage.heapTotal,
                external: memoryUsage.external,
                systemTotal: os.totalmem(),
                systemFree: os.freemem()
            };

        } catch (error) {
            console.error('获取内存信息失败:', error);
            throw error;
        }
    }

    /**
     * 处理配置获取
     */
    async handleConfigGet(event, key) {
        try {
            // 这里应该从AppManager获取配置
            // 暂时返回默认配置
            const defaultConfig = {
                performance: {
                    maxMemoryUsage: '4GB',
                    workerThreads: require('os').cpus().length,
                    chunkSize: 100000
                },
                ui: {
                    theme: 'light',
                    language: 'zh-CN'
                }
            };

            return key ? defaultConfig[key] : defaultConfig;

        } catch (error) {
            console.error('获取配置失败:', error);
            throw error;
        }
    }

    /**
     * 处理配置设置
     */
    async handleConfigSet(event, key, value) {
        try {
            // 这里应该调用AppManager设置配置
            console.log('设置配置:', key, value);
            return { success: true };

        } catch (error) {
            console.error('设置配置失败:', error);
            throw error;
        }
    }

    /**
     * 处理窗口最小化
     */
    async handleWindowMinimize(event) {
        try {
            const window = BrowserWindow.fromWebContents(event.sender);
            if (window) {
                window.minimize();
            }
            return { success: true };

        } catch (error) {
            console.error('窗口最小化失败:', error);
            throw error;
        }
    }

    /**
     * 处理窗口最大化
     */
    async handleWindowMaximize(event) {
        try {
            const window = BrowserWindow.fromWebContents(event.sender);
            if (window) {
                if (window.isMaximized()) {
                    window.unmaximize();
                } else {
                    window.maximize();
                }
            }
            return { success: true };

        } catch (error) {
            console.error('窗口最大化失败:', error);
            throw error;
        }
    }

    /**
     * 处理窗口关闭
     */
    async handleWindowClose(event) {
        try {
            const window = BrowserWindow.fromWebContents(event.sender);
            if (window) {
                window.close();
            }
            return { success: true };

        } catch (error) {
            console.error('窗口关闭失败:', error);
            throw error;
        }
    }

    /**
     * 处理应用版本获取
     */
    async handleAppVersion(event) {
        try {
            const { app } = require('electron');
            return app.getVersion();

        } catch (error) {
            console.error('获取应用版本失败:', error);
            throw error;
        }
    }

    /**
     * 处理应用信息获取
     */
    async handleAppInfo(event) {
        try {
            const { app } = require('electron');
            const packageJson = require('../../package.json');
            
            return {
                name: app.getName(),
                version: app.getVersion(),
                description: packageJson.description,
                author: packageJson.author,
                homepage: packageJson.homepage,
                platform: process.platform,
                arch: process.arch,
                nodeVersion: process.version,
                electronVersion: process.versions.electron,
                chromeVersion: process.versions.chrome
            };

        } catch (error) {
            console.error('获取应用信息失败:', error);
            throw error;
        }
    }

    /**
     * 处理开发工具打开
     */
    async handleOpenDevTools(event) {
        try {
            const window = BrowserWindow.fromWebContents(event.sender);
            if (window) {
                window.webContents.openDevTools();
            }
            return { success: true };

        } catch (error) {
            console.error('打开开发工具失败:', error);
            throw error;
        }
    }

    /**
     * 处理渲染进程就绪
     */
    handleRendererReady(event) {
        console.log('渲染进程就绪');
        
        // 可以在这里发送初始化数据到渲染进程
        event.sender.send('main:ready', {
            message: '主进程已就绪',
            timestamp: Date.now()
        });
    }

    /**
     * 发送进度更新
     */
    sendProgressUpdate(progress) {
        this.sendToRenderer('progress:update', progress);
    }

    /**
     * 发送文件处理完成通知
     */
    sendFileProcessed(data) {
        this.sendToRenderer('file:processed', data);
    }

    /**
     * 发送错误通知
     */
    sendError(error) {
        this.sendToRenderer('error:occurred', {
            message: error.message,
            stack: error.stack,
            timestamp: Date.now()
        });
    }

    /**
     * 传输大数据（分块传输）
     */
    async transferLargeData(data, target, options = {}) {
        const {
            chunkSize = 1024 * 1024, // 1MB chunks
            onProgress = null
        } = options;

        try {
            const serializedData = JSON.stringify(data);
            const totalSize = Buffer.byteLength(serializedData, 'utf8');
            const chunks = [];
            
            // 分割数据
            for (let i = 0; i < serializedData.length; i += chunkSize) {
                chunks.push(serializedData.slice(i, i + chunkSize));
            }

            const transferId = Date.now().toString();
            
            // 发送传输开始信号
            this.sendToRenderer('data:transfer-start', {
                transferId,
                totalChunks: chunks.length,
                totalSize
            });

            // 逐块发送数据
            for (let i = 0; i < chunks.length; i++) {
                this.sendToRenderer('data:transfer-chunk', {
                    transferId,
                    chunkIndex: i,
                    chunk: chunks[i],
                    isLast: i === chunks.length - 1
                });

                if (onProgress) {
                    onProgress({
                        transferred: i + 1,
                        total: chunks.length,
                        progress: Math.round(((i + 1) / chunks.length) * 100)
                    });
                }

                // 小延迟避免阻塞
                await new Promise(resolve => setImmediate(resolve));
            }

            console.log(`大数据传输完成: ${this.formatBytes(totalSize)}`);
            return transferId;

        } catch (error) {
            console.error('大数据传输失败:', error);
            throw error;
        }
    }

    /**
     * 格式化字节数
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 清理资源
     */
    async cleanup() {
        try {
            // 移除所有IPC监听器
            for (const channel of this.channels.keys()) {
                ipcMain.removeHandler(channel);
            }
            
            this.channels.clear();
            console.log('IPC管理器清理完成');

        } catch (error) {
            console.error('IPC管理器清理失败:', error);
        }
    }
}

module.exports = IPCManager;