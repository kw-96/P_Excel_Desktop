/**
 * 系统资源监控器 - 负责监控内存、CPU等系统资源使用情况
 */

const os = require('os');
const { EventEmitter } = require('events');

class ResourceMonitor extends EventEmitter {
    constructor() {
        super();
        this.isMonitoring = false;
        this.monitorInterval = null;
        this.monitorFrequency = 5000; // 5秒监控一次
        this.memoryThreshold = 0.8; // 内存使用率阈值80%
        this.cpuThreshold = 0.9; // CPU使用率阈值90%
        this.history = {
            memory: [],
            cpu: [],
            maxHistoryLength: 100 // 保留最近100个数据点
        };
    }

    /**
     * 初始化资源监控器
     */
    async initialize() {
        try {
            // 开始监控
            this.startMonitoring();
            
            console.log('资源监控器初始化完成');
        } catch (error) {
            console.error('资源监控器初始化失败:', error);
            throw error;
        }
    }

    /**
     * 开始监控
     */
    startMonitoring() {
        if (this.isMonitoring) {
            console.warn('资源监控已在运行');
            return;
        }

        this.isMonitoring = true;
        this.monitorInterval = setInterval(() => {
            this.collectMetrics();
        }, this.monitorFrequency);

        console.log('开始资源监控');
    }

    /**
     * 停止监控
     */
    stopMonitoring() {
        if (!this.isMonitoring) {
            return;
        }

        this.isMonitoring = false;
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }

        console.log('停止资源监控');
    }

    /**
     * 收集系统指标
     */
    async collectMetrics() {
        try {
            const memoryInfo = this.getMemoryInfo();
            const cpuInfo = await this.getCPUInfo();
            const diskInfo = await this.getDiskInfo();

            const metrics = {
                timestamp: Date.now(),
                memory: memoryInfo,
                cpu: cpuInfo,
                disk: diskInfo,
                process: this.getProcessInfo()
            };

            // 添加到历史记录
            this.addToHistory('memory', memoryInfo);
            this.addToHistory('cpu', cpuInfo);

            // 检查阈值
            this.checkThresholds(metrics);

            // 发出监控事件
            this.emit('metrics', metrics);

            return metrics;

        } catch (error) {
            console.error('收集系统指标失败:', error);
            this.emit('error', error);
        }
    }

    /**
     * 获取内存信息
     */
    getMemoryInfo() {
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        const usagePercent = (usedMemory / totalMemory) * 100;

        const processMemory = process.memoryUsage();

        return {
            system: {
                total: totalMemory,
                free: freeMemory,
                used: usedMemory,
                usagePercent: Math.round(usagePercent * 100) / 100
            },
            process: {
                heapUsed: processMemory.heapUsed,
                heapTotal: processMemory.heapTotal,
                external: processMemory.external,
                rss: processMemory.rss,
                heapUsagePercent: Math.round((processMemory.heapUsed / processMemory.heapTotal) * 10000) / 100
            }
        };
    }

    /**
     * 获取CPU信息
     */
    async getCPUInfo() {
        return new Promise((resolve) => {
            const cpus = os.cpus();
            const numCPUs = cpus.length;

            // 获取第一次CPU时间
            const startMeasure = this.getCPUTimes();

            setTimeout(() => {
                // 获取第二次CPU时间
                const endMeasure = this.getCPUTimes();

                // 计算CPU使用率
                const idleDiff = endMeasure.idle - startMeasure.idle;
                const totalDiff = endMeasure.total - startMeasure.total;
                const usagePercent = 100 - Math.round((idleDiff / totalDiff) * 10000) / 100;

                resolve({
                    cores: numCPUs,
                    model: cpus[0].model,
                    speed: cpus[0].speed,
                    usagePercent: Math.max(0, Math.min(100, usagePercent)),
                    loadAverage: os.loadavg()
                });
            }, 100);
        });
    }

    /**
     * 获取CPU时间
     */
    getCPUTimes() {
        const cpus = os.cpus();
        let idle = 0;
        let total = 0;

        cpus.forEach(cpu => {
            for (const type in cpu.times) {
                total += cpu.times[type];
            }
            idle += cpu.times.idle;
        });

        return { idle, total };
    }

    /**
     * 获取磁盘信息
     */
    async getDiskInfo() {
        try {
            const fs = require('fs').promises;
            const path = require('path');
            
            // 获取应用数据目录的磁盘使用情况
            const userDataPath = require('electron').app.getPath('userData');
            const stats = await fs.statfs(userDataPath);
            
            const total = stats.blocks * stats.bsize;
            const free = stats.bavail * stats.bsize;
            const used = total - free;
            const usagePercent = (used / total) * 100;

            return {
                total,
                free,
                used,
                usagePercent: Math.round(usagePercent * 100) / 100,
                path: userDataPath
            };

        } catch (error) {
            console.error('获取磁盘信息失败:', error);
            return {
                total: 0,
                free: 0,
                used: 0,
                usagePercent: 0,
                path: 'unknown'
            };
        }
    }

    /**
     * 获取进程信息
     */
    getProcessInfo() {
        return {
            pid: process.pid,
            uptime: process.uptime(),
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
            electronVersion: process.versions.electron,
            chromeVersion: process.versions.chrome
        };
    }

    /**
     * 添加到历史记录
     */
    addToHistory(type, data) {
        if (!this.history[type]) {
            this.history[type] = [];
        }

        this.history[type].push({
            timestamp: Date.now(),
            data
        });

        // 保持历史记录长度限制
        if (this.history[type].length > this.history.maxHistoryLength) {
            this.history[type].shift();
        }
    }

    /**
     * 检查阈值
     */
    checkThresholds(metrics) {
        // 检查内存阈值
        if (metrics.memory.system.usagePercent / 100 > this.memoryThreshold) {
            this.emit('threshold:memory', {
                current: metrics.memory.system.usagePercent,
                threshold: this.memoryThreshold * 100,
                message: '系统内存使用率过高'
            });
        }

        // 检查进程内存阈值
        if (metrics.memory.process.heapUsagePercent / 100 > this.memoryThreshold) {
            this.emit('threshold:process-memory', {
                current: metrics.memory.process.heapUsagePercent,
                threshold: this.memoryThreshold * 100,
                message: '进程内存使用率过高'
            });
        }

        // 检查CPU阈值
        if (metrics.cpu.usagePercent / 100 > this.cpuThreshold) {
            this.emit('threshold:cpu', {
                current: metrics.cpu.usagePercent,
                threshold: this.cpuThreshold * 100,
                message: 'CPU使用率过高'
            });
        }
    }

    /**
     * 获取历史数据
     */
    getHistory(type = null, limit = null) {
        if (type) {
            const history = this.history[type] || [];
            return limit ? history.slice(-limit) : history;
        }

        const result = {};
        for (const [key, value] of Object.entries(this.history)) {
            if (key !== 'maxHistoryLength') {
                result[key] = limit ? value.slice(-limit) : value;
            }
        }
        return result;
    }

    /**
     * 获取当前资源使用情况
     */
    async getCurrentUsage() {
        return await this.collectMetrics();
    }

    /**
     * 获取资源使用统计
     */
    getUsageStats(type = 'memory', duration = 300000) { // 默认5分钟
        const now = Date.now();
        const history = this.history[type] || [];
        
        // 筛选指定时间范围内的数据
        const recentData = history.filter(item => 
            now - item.timestamp <= duration
        );

        if (recentData.length === 0) {
            return null;
        }

        // 计算统计信息
        const values = recentData.map(item => {
            if (type === 'memory') {
                return item.data.system.usagePercent;
            } else if (type === 'cpu') {
                return item.data.usagePercent;
            }
            return 0;
        });

        const sum = values.reduce((a, b) => a + b, 0);
        const avg = sum / values.length;
        const min = Math.min(...values);
        const max = Math.max(...values);

        return {
            average: Math.round(avg * 100) / 100,
            minimum: min,
            maximum: max,
            samples: values.length,
            duration: duration / 1000 // 转换为秒
        };
    }

    /**
     * 设置监控频率
     */
    setMonitorFrequency(frequency) {
        this.monitorFrequency = Math.max(1000, frequency); // 最小1秒
        
        if (this.isMonitoring) {
            this.stopMonitoring();
            this.startMonitoring();
        }
        
        console.log('监控频率已设置为:', this.monitorFrequency, 'ms');
    }

    /**
     * 设置阈值
     */
    setThresholds(memory = null, cpu = null) {
        if (memory !== null) {
            this.memoryThreshold = Math.max(0.1, Math.min(1.0, memory));
        }
        if (cpu !== null) {
            this.cpuThreshold = Math.max(0.1, Math.min(1.0, cpu));
        }
        
        console.log('阈值已更新:', {
            memory: this.memoryThreshold,
            cpu: this.cpuThreshold
        });
    }

    /**
     * 格式化字节数
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 获取系统信息摘要
     */
    async getSystemSummary() {
        const metrics = await this.getCurrentUsage();
        
        return {
            system: {
                platform: os.platform(),
                arch: os.arch(),
                release: os.release(),
                hostname: os.hostname(),
                uptime: os.uptime()
            },
            hardware: {
                cpus: os.cpus().length,
                totalMemory: this.formatBytes(os.totalmem()),
                freeMemory: this.formatBytes(os.freemem())
            },
            current: {
                memoryUsage: `${metrics.memory.system.usagePercent}%`,
                cpuUsage: `${metrics.cpu.usagePercent}%`,
                processMemory: this.formatBytes(metrics.memory.process.heapUsed)
            },
            monitoring: {
                isActive: this.isMonitoring,
                frequency: this.monitorFrequency,
                historyLength: this.history.memory.length
            }
        };
    }

    /**
     * 清理资源
     */
    async cleanup() {
        try {
            this.stopMonitoring();
            this.removeAllListeners();
            
            // 清理历史数据
            this.history = {
                memory: [],
                cpu: [],
                maxHistoryLength: 100
            };
            
            console.log('资源监控器清理完成');

        } catch (error) {
            console.error('资源监控器清理失败:', error);
        }
    }
}

module.exports = ResourceMonitor;