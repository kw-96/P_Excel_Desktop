/**
 * 配置管理器 - 管理应用配置和用户偏好设置
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const EventEmitter = require('events');

class ConfigManager extends EventEmitter {
    constructor(options = {}) {
        super();
        this.options = {
            configDir: options.configDir || path.join(os.homedir(), '.p-excel'),
            configFile: options.configFile || 'config.json',
            autoSave: options.autoSave !== false,
            saveDelay: options.saveDelay || 1000,
            ...options
        };
        
        this.configPath = path.join(this.options.configDir, this.options.configFile);
        this.config = {};
        this.defaultConfig = this.getDefaultConfig();
        this.saveTimer = null;
        this.isLoaded = false;
    }

    /**
     * 获取默认配置
     */
    getDefaultConfig() {
        return {
            // 性能配置
            performance: {
                maxMemoryUsage: '4GB',
                maxCacheSize: '2GB',
                workerThreads: os.cpus().length,
                chunkSize: 100000,
                enableCompression: true,
                enableParallelProcessing: true,
                maxConcurrentTasks: 3
            },
            
            // UI配置
            ui: {
                theme: 'light',
                language: 'zh-CN',
                previewRows: 1000,
                enableAnimations: true,
                showProgressDetails: true,
                autoHideNotifications: true,
                notificationDuration: 5000
            },
            
            // 安全配置
            security: {
                enableEncryption: false,
                autoCleanup: true,
                maxFileSize: '10GB',
                allowedFileTypes: ['.xlsx', '.xls', '.csv'],
                enableFileValidation: true
            },
            
            // 高级配置
            advanced: {
                enableLogging: true,
                logLevel: 'info',
                enableTelemetry: false,
                autoUpdate: true,
                enableDeveloperMode: false,
                enableExperimentalFeatures: false
            },
            
            // 文件处理配置
            fileProcessing: {
                defaultExportFormat: 'xlsx',
                preserveOriginalFormat: true,
                enableBackup: true,
                backupLocation: 'auto',
                maxBackupFiles: 5
            },
            
            // 快捷操作配置
            quickActions: {
                enableCustomActions: true,
                showBuiltinActions: true,
                customActionTemplates: [],
                actionHistory: []
            },
            
            // 窗口配置
            window: {
                width: 1200,
                height: 800,
                x: null,
                y: null,
                maximized: false,
                alwaysOnTop: false,
                showInTaskbar: true,
                minimizeToTray: false
            },
            
            // 最近使用的文件
            recentFiles: [],
            maxRecentFiles: 10,
            
            // 用户偏好
            preferences: {
                showWelcomeScreen: true,
                checkForUpdates: true,
                sendUsageStatistics: false,
                enableKeyboardShortcuts: true,
                enableContextMenu: true
            }
        };
    }

    /**
     * 初始化配置管理器
     */
    async initialize() {
        try {
            // 确保配置目录存在
            await this.ensureConfigDirectory();
            
            // 加载配置
            await this.loadConfig();
            
            // 验证配置
            this.validateConfig();
            
            // 保存配置（确保格式正确）
            await this.saveConfig();
            
            this.isLoaded = true;
            this.emit('initialized');
            
            console.log('配置管理器初始化完成');
        } catch (error) {
            console.error('配置管理器初始化失败:', error);
            throw error;
        }
    }

    /**
     * 确保配置目录存在
     */
    async ensureConfigDirectory() {
        try {
            await fs.access(this.options.configDir);
        } catch (error) {
            if (error.code === 'ENOENT') {
                await fs.mkdir(this.options.configDir, { recursive: true });
                console.log('创建配置目录:', this.options.configDir);
            } else {
                throw error;
            }
        }
    }

    /**
     * 加载配置
     */
    async loadConfig() {
        try {
            const configData = await fs.readFile(this.configPath, 'utf8');
            const loadedConfig = JSON.parse(configData);
            
            // 合并默认配置和加载的配置
            this.config = this.mergeConfig(this.defaultConfig, loadedConfig);
            
            console.log('配置文件加载成功');
            this.emit('configLoaded', this.config);
            
        } catch (error) {
            if (error.code === 'ENOENT') {
                // 配置文件不存在，使用默认配置
                this.config = { ...this.defaultConfig };
                console.log('配置文件不存在，使用默认配置');
            } else {
                console.error('配置文件加载失败:', error);
                this.config = { ...this.defaultConfig };
            }
        }
    }

    /**
     * 保存配置
     */
    async saveConfig() {
        try {
            const configData = JSON.stringify(this.config, null, 2);
            await fs.writeFile(this.configPath, configData, 'utf8');
            
            console.log('配置文件保存成功');
            this.emit('configSaved', this.config);
            
        } catch (error) {
            console.error('配置文件保存失败:', error);
            throw error;
        }
    }

    /**
     * 延迟保存配置
     */
    deferredSave() {
        if (!this.options.autoSave) return;

        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
        }

        this.saveTimer = setTimeout(async () => {
            try {
                await this.saveConfig();
            } catch (error) {
                console.error('延迟保存配置失败:', error);
            }
        }, this.options.saveDelay);
    }

    /**
     * 合并配置
     */
    mergeConfig(defaultConfig, userConfig) {
        const merged = { ...defaultConfig };
        
        for (const [key, value] of Object.entries(userConfig)) {
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                if (typeof merged[key] === 'object' && merged[key] !== null && !Array.isArray(merged[key])) {
                    merged[key] = this.mergeConfig(merged[key], value);
                } else {
                    merged[key] = value;
                }
            } else {
                merged[key] = value;
            }
        }
        
        return merged;
    }

    /**
     * 验证配置
     */
    validateConfig() {
        // 验证性能配置
        if (this.config.performance) {
            const perf = this.config.performance;
            
            // 验证内存限制
            if (typeof perf.maxMemoryUsage === 'string') {
                const memoryBytes = this.parseMemorySize(perf.maxMemoryUsage);
                if (memoryBytes < 1024 * 1024 * 1024) { // 最小1GB
                    perf.maxMemoryUsage = '1GB';
                }
            }
            
            // 验证Worker线程数
            if (typeof perf.workerThreads !== 'number' || perf.workerThreads < 1) {
                perf.workerThreads = Math.max(1, os.cpus().length);
            }
            
            // 验证块大小
            if (typeof perf.chunkSize !== 'number' || perf.chunkSize < 1000) {
                perf.chunkSize = 100000;
            }
        }

        // 验证UI配置
        if (this.config.ui) {
            const ui = this.config.ui;
            
            // 验证主题
            if (!['light', 'dark', 'auto'].includes(ui.theme)) {
                ui.theme = 'light';
            }
            
            // 验证语言
            if (!['zh-CN', 'en-US'].includes(ui.language)) {
                ui.language = 'zh-CN';
            }
            
            // 验证预览行数
            if (typeof ui.previewRows !== 'number' || ui.previewRows < 10) {
                ui.previewRows = 1000;
            }
        }

        // 验证窗口配置
        if (this.config.window) {
            const win = this.config.window;
            
            // 验证窗口尺寸
            if (typeof win.width !== 'number' || win.width < 800) {
                win.width = 1200;
            }
            if (typeof win.height !== 'number' || win.height < 600) {
                win.height = 800;
            }
        }

        // 验证最近文件列表
        if (!Array.isArray(this.config.recentFiles)) {
            this.config.recentFiles = [];
        }
        
        // 限制最近文件数量
        if (this.config.recentFiles.length > this.config.maxRecentFiles) {
            this.config.recentFiles = this.config.recentFiles.slice(0, this.config.maxRecentFiles);
        }
    }

    /**
     * 解析内存大小字符串
     */
    parseMemorySize(sizeStr) {
        const units = {
            'B': 1,
            'KB': 1024,
            'MB': 1024 * 1024,
            'GB': 1024 * 1024 * 1024,
            'TB': 1024 * 1024 * 1024 * 1024
        };

        const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*([KMGT]?B)$/i);
        if (!match) return 0;

        const value = parseFloat(match[1]);
        const unit = match[2].toUpperCase();
        
        return value * (units[unit] || 1);
    }

    /**
     * 获取配置值
     */
    get(key, defaultValue = undefined) {
        if (!key) return this.config;

        const keys = key.split('.');
        let value = this.config;

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return defaultValue;
            }
        }

        return value;
    }

    /**
     * 设置配置值
     */
    set(key, value) {
        if (!key) return false;

        const keys = key.split('.');
        let target = this.config;

        // 导航到目标对象
        for (let i = 0; i < keys.length - 1; i++) {
            const k = keys[i];
            if (!target[k] || typeof target[k] !== 'object') {
                target[k] = {};
            }
            target = target[k];
        }

        // 设置值
        const lastKey = keys[keys.length - 1];
        const oldValue = target[lastKey];
        target[lastKey] = value;

        // 触发事件
        this.emit('configChanged', {
            key,
            oldValue,
            newValue: value
        });

        // 延迟保存
        this.deferredSave();

        return true;
    }

    /**
     * 删除配置项
     */
    delete(key) {
        if (!key) return false;

        const keys = key.split('.');
        let target = this.config;

        // 导航到父对象
        for (let i = 0; i < keys.length - 1; i++) {
            const k = keys[i];
            if (!target[k] || typeof target[k] !== 'object') {
                return false; // 路径不存在
            }
            target = target[k];
        }

        // 删除键
        const lastKey = keys[keys.length - 1];
        if (lastKey in target) {
            const oldValue = target[lastKey];
            delete target[lastKey];

            this.emit('configChanged', {
                key,
                oldValue,
                newValue: undefined,
                deleted: true
            });

            this.deferredSave();
            return true;
        }

        return false;
    }

    /**
     * 重置配置
     */
    async reset(section = null) {
        if (section) {
            // 重置特定部分
            if (this.defaultConfig[section]) {
                this.config[section] = { ...this.defaultConfig[section] };
                this.emit('configReset', { section });
            }
        } else {
            // 重置所有配置
            this.config = { ...this.defaultConfig };
            this.emit('configReset', { section: 'all' });
        }

        await this.saveConfig();
    }

    /**
     * 导出配置
     */
    async exportConfig(filePath) {
        try {
            const configData = JSON.stringify(this.config, null, 2);
            await fs.writeFile(filePath, configData, 'utf8');
            
            console.log('配置导出成功:', filePath);
            return true;
        } catch (error) {
            console.error('配置导出失败:', error);
            throw error;
        }
    }

    /**
     * 导入配置
     */
    async importConfig(filePath) {
        try {
            const configData = await fs.readFile(filePath, 'utf8');
            const importedConfig = JSON.parse(configData);
            
            // 合并导入的配置
            this.config = this.mergeConfig(this.defaultConfig, importedConfig);
            
            // 验证配置
            this.validateConfig();
            
            // 保存配置
            await this.saveConfig();
            
            this.emit('configImported', { filePath });
            console.log('配置导入成功:', filePath);
            
            return true;
        } catch (error) {
            console.error('配置导入失败:', error);
            throw error;
        }
    }

    /**
     * 添加最近使用的文件
     */
    addRecentFile(filePath, metadata = {}) {
        const recentFile = {
            path: filePath,
            name: path.basename(filePath),
            lastAccessed: Date.now(),
            size: metadata.size || 0,
            type: metadata.type || path.extname(filePath),
            ...metadata
        };

        // 移除已存在的相同文件
        this.config.recentFiles = this.config.recentFiles.filter(
            file => file.path !== filePath
        );

        // 添加到开头
        this.config.recentFiles.unshift(recentFile);

        // 限制数量
        if (this.config.recentFiles.length > this.config.maxRecentFiles) {
            this.config.recentFiles = this.config.recentFiles.slice(0, this.config.maxRecentFiles);
        }

        this.emit('recentFileAdded', recentFile);
        this.deferredSave();
    }

    /**
     * 移除最近使用的文件
     */
    removeRecentFile(filePath) {
        const originalLength = this.config.recentFiles.length;
        this.config.recentFiles = this.config.recentFiles.filter(
            file => file.path !== filePath
        );

        if (this.config.recentFiles.length < originalLength) {
            this.emit('recentFileRemoved', { filePath });
            this.deferredSave();
            return true;
        }

        return false;
    }

    /**
     * 清空最近使用的文件
     */
    clearRecentFiles() {
        this.config.recentFiles = [];
        this.emit('recentFilesCleared');
        this.deferredSave();
    }

    /**
     * 获取最近使用的文件
     */
    getRecentFiles(limit = null) {
        const files = this.config.recentFiles || [];
        return limit ? files.slice(0, limit) : files;
    }

    /**
     * 添加自定义快捷操作模板
     */
    addQuickActionTemplate(template) {
        if (!this.config.quickActions.customActionTemplates) {
            this.config.quickActions.customActionTemplates = [];
        }

        const actionTemplate = {
            id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: template.name,
            description: template.description || '',
            rules: template.rules || [],
            createdAt: Date.now(),
            ...template
        };

        this.config.quickActions.customActionTemplates.push(actionTemplate);
        this.emit('quickActionAdded', actionTemplate);
        this.deferredSave();

        return actionTemplate.id;
    }

    /**
     * 移除自定义快捷操作模板
     */
    removeQuickActionTemplate(templateId) {
        if (!this.config.quickActions.customActionTemplates) {
            return false;
        }

        const originalLength = this.config.quickActions.customActionTemplates.length;
        this.config.quickActions.customActionTemplates = 
            this.config.quickActions.customActionTemplates.filter(
                template => template.id !== templateId
            );

        if (this.config.quickActions.customActionTemplates.length < originalLength) {
            this.emit('quickActionRemoved', { templateId });
            this.deferredSave();
            return true;
        }

        return false;
    }

    /**
     * 获取配置摘要
     */
    getConfigSummary() {
        return {
            configPath: this.configPath,
            isLoaded: this.isLoaded,
            performance: {
                maxMemoryUsage: this.config.performance?.maxMemoryUsage,
                workerThreads: this.config.performance?.workerThreads,
                enableCompression: this.config.performance?.enableCompression
            },
            ui: {
                theme: this.config.ui?.theme,
                language: this.config.ui?.language,
                previewRows: this.config.ui?.previewRows
            },
            recentFilesCount: this.config.recentFiles?.length || 0,
            customActionsCount: this.config.quickActions?.customActionTemplates?.length || 0
        };
    }

    /**
     * 监听配置变化
     */
    watch(key, callback) {
        const listener = (event) => {
            if (!key || event.key === key || event.key.startsWith(key + '.')) {
                callback(event);
            }
        };

        this.on('configChanged', listener);
        
        // 返回取消监听的函数
        return () => {
            this.off('configChanged', listener);
        };
    }

    /**
     * 清理资源
     */
    async cleanup() {
        try {
            // 清理定时器
            if (this.saveTimer) {
                clearTimeout(this.saveTimer);
                this.saveTimer = null;
            }

            // 最后保存一次配置
            if (this.isLoaded) {
                await this.saveConfig();
            }

            // 移除所有监听器
            this.removeAllListeners();

            console.log('配置管理器清理完成');
        } catch (error) {
            console.error('配置管理器清理失败:', error);
        }
    }
}

module.exports = ConfigManager;