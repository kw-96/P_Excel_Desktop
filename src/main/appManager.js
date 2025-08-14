/**
 * 应用管理器 - 负责应用生命周期和配置管理
 */

const { app } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

class AppManager {
    constructor() {
        this.config = null;
        this.configPath = path.join(os.homedir(), '.p-excel', 'config.json');
        this.defaultConfig = {
            performance: {
                maxMemoryUsage: '4GB',
                maxCacheSize: '2GB',
                workerThreads: os.cpus().length,
                chunkSize: 100000,
                enableCompression: true
            },
            ui: {
                theme: 'light',
                language: 'zh-CN',
                previewRows: 1000,
                enableAnimations: true
            },
            security: {
                enableEncryption: false,
                autoCleanup: true,
                maxFileSize: '10GB'
            }
        };
    }

    /**
     * 初始化应用管理器
     */
    async initialize() {
        try {
            // 创建配置目录
            await this.ensureConfigDirectory();
            
            // 加载配置
            await this.loadConfig();
            
            // 设置应用信息
            this.setupAppInfo();
            
            console.log('应用管理器初始化完成');
        } catch (error) {
            console.error('应用管理器初始化失败:', error);
            throw error;
        }
    }

    /**
     * 确保配置目录存在
     */
    async ensureConfigDirectory() {
        const configDir = path.dirname(this.configPath);
        try {
            await fs.access(configDir);
        } catch (error) {
            if (error.code === 'ENOENT') {
                await fs.mkdir(configDir, { recursive: true });
                console.log('创建配置目录:', configDir);
            } else {
                throw error;
            }
        }
    }

    /**
     * 加载配置文件
     */
    async loadConfig() {
        try {
            const configData = await fs.readFile(this.configPath, 'utf8');
            this.config = { ...this.defaultConfig, ...JSON.parse(configData) };
            console.log('配置文件加载成功');
        } catch (error) {
            if (error.code === 'ENOENT') {
                // 配置文件不存在，使用默认配置
                this.config = { ...this.defaultConfig };
                await this.saveConfig();
                console.log('使用默认配置并保存');
            } else {
                console.error('配置文件加载失败:', error);
                this.config = { ...this.defaultConfig };
            }
        }
    }

    /**
     * 保存配置文件
     */
    async saveConfig() {
        try {
            const configData = JSON.stringify(this.config, null, 2);
            await fs.writeFile(this.configPath, configData, 'utf8');
            console.log('配置文件保存成功');
        } catch (error) {
            console.error('配置文件保存失败:', error);
            throw error;
        }
    }

    /**
     * 设置应用信息
     */
    setupAppInfo() {
        // 设置应用名称
        app.setName('P_Excel桌面版');
        
        // 设置应用版本
        const packageJson = require('../../package.json');
        app.setVersion(packageJson.version);
        
        // 设置用户数据目录
        const userDataPath = path.join(os.homedir(), '.p-excel');
        app.setPath('userData', userDataPath);
        
        // 设置日志目录
        const logsPath = path.join(userDataPath, 'logs');
        app.setPath('logs', logsPath);
        
        console.log('应用信息设置完成');
    }

    /**
     * 获取配置
     */
    getConfig(key = null) {
        if (key) {
            return this.config[key];
        }
        return this.config;
    }

    /**
     * 更新配置
     */
    async updateConfig(key, value) {
        if (typeof key === 'object') {
            // 批量更新
            this.config = { ...this.config, ...key };
        } else {
            // 单个更新
            this.config[key] = value;
        }
        
        await this.saveConfig();
    }

    /**
     * 重置配置为默认值
     */
    async resetConfig() {
        this.config = { ...this.defaultConfig };
        await this.saveConfig();
        console.log('配置已重置为默认值');
    }

    /**
     * 获取应用信息
     */
    getAppInfo() {
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
    }

    /**
     * 获取系统信息
     */
    getSystemInfo() {
        return {
            platform: os.platform(),
            arch: os.arch(),
            release: os.release(),
            hostname: os.hostname(),
            cpus: os.cpus().length,
            totalMemory: os.totalmem(),
            freeMemory: os.freemem(),
            uptime: os.uptime(),
            loadavg: os.loadavg(),
            networkInterfaces: Object.keys(os.networkInterfaces())
        };
    }

    /**
     * 清理资源
     */
    async cleanup() {
        try {
            // 保存当前配置
            await this.saveConfig();
            console.log('应用管理器清理完成');
        } catch (error) {
            console.error('应用管理器清理失败:', error);
        }
    }
}

module.exports = AppManager;