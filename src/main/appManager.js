/**
 * 应用管理器 - 负责应用生命周期和配置管理
 */

const { app } = require('electron');
const path = require('path');
const os = require('os');
const ConfigManager = require('./configManager');

class AppManager {
    constructor() {
        this.configManager = null;
    }

    /**
     * 初始化应用管理器
     */
    async initialize() {
        try {
            // 初始化配置管理器
            this.configManager = new ConfigManager();
            await this.configManager.initialize();
            
            // 设置应用信息
            this.setupAppInfo();
            
            console.log('应用管理器初始化完成');
        } catch (error) {
            console.error('应用管理器初始化失败:', error);
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
        if (!this.configManager) return null;
        return this.configManager.get(key);
    }

    /**
     * 更新配置
     */
    async updateConfig(key, value) {
        if (!this.configManager) return false;
        
        if (typeof key === 'object') {
            // 批量更新
            for (const [k, v] of Object.entries(key)) {
                this.configManager.set(k, v);
            }
        } else {
            // 单个更新
            this.configManager.set(key, value);
        }
        
        return true;
    }

    /**
     * 重置配置为默认值
     */
    async resetConfig(section = null) {
        if (!this.configManager) return false;
        await this.configManager.reset(section);
        console.log('配置已重置为默认值');
        return true;
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
            // 清理配置管理器
            if (this.configManager) {
                await this.configManager.cleanup();
            }
            console.log('应用管理器清理完成');
        } catch (error) {
            console.error('应用管理器清理失败:', error);
        }
    }
}

module.exports = AppManager;