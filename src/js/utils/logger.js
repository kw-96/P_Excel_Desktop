/**
 * 日志工具
 * 提供统一的日志记录功能
 */

class Logger {
    constructor() {
        this.levels = {
            ERROR: 0,
            WARN: 1,
            INFO: 2,
            DEBUG: 3
        };
        
        this.currentLevel = this.levels.INFO;
        this.logs = [];
        this.maxLogs = 1000; // 最大日志条数
    }

    /**
     * 设置日志级别
     * @param {string} level - 日志级别 (ERROR, WARN, INFO, DEBUG)
     */
    setLevel(level) {
        const upperLevel = level.toUpperCase();
        if (this.levels.hasOwnProperty(upperLevel)) {
            this.currentLevel = this.levels[upperLevel];
        }
    }

    /**
     * 记录错误日志
     * @param {string} message - 日志消息
     * @param {any} data - 附加数据
     */
    error(message, data = null) {
        this._log('ERROR', message, data);
    }

    /**
     * 记录警告日志
     * @param {string} message - 日志消息
     * @param {any} data - 附加数据
     */
    warn(message, data = null) {
        this._log('WARN', message, data);
    }

    /**
     * 记录信息日志
     * @param {string} message - 日志消息
     * @param {any} data - 附加数据
     */
    info(message, data = null) {
        this._log('INFO', message, data);
    }

    /**
     * 记录调试日志
     * @param {string} message - 日志消息
     * @param {any} data - 附加数据
     */
    debug(message, data = null) {
        this._log('DEBUG', message, data);
    }

    /**
     * 内部日志记录方法
     * @param {string} level - 日志级别
     * @param {string} message - 日志消息
     * @param {any} data - 附加数据
     */
    _log(level, message, data) {
        const levelValue = this.levels[level];
        
        // 检查是否应该记录此级别的日志
        if (levelValue > this.currentLevel) {
            return;
        }

        const timestamp = new Date();
        const logEntry = {
            timestamp,
            level,
            message,
            data,
            stack: level === 'ERROR' ? new Error().stack : null
        };

        // 添加到内存日志
        this.logs.push(logEntry);
        
        // 限制日志数量
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }

        // 输出到控制台
        this._consoleOutput(logEntry);
    }

    /**
     * 输出日志到控制台
     * @param {Object} logEntry - 日志条目
     */
    _consoleOutput(logEntry) {
        const { timestamp, level, message, data } = logEntry;
        const timeStr = this._formatTime(timestamp);
        const logMessage = `[${timeStr}] [${level}] ${message}`;

        switch (level) {
            case 'ERROR':
                console.error(logMessage, data);
                break;
            case 'WARN':
                console.warn(logMessage, data);
                break;
            case 'INFO':
                console.info(logMessage, data);
                break;
            case 'DEBUG':
                console.debug(logMessage, data);
                break;
            default:
                console.log(logMessage, data);
        }
    }

    /**
     * 格式化时间
     * @param {Date} date - 日期对象
     * @returns {string} 格式化后的时间字符串
     */
    _formatTime(date) {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
        
        return `${hours}:${minutes}:${seconds}.${milliseconds}`;
    }

    /**
     * 记录性能日志
     * @param {string} operation - 操作名称
     * @param {number} startTime - 开始时间
     * @param {number} endTime - 结束时间
     */
    performance(operation, startTime, endTime = performance.now()) {
        const duration = endTime - startTime;
        this.info(`性能监控: ${operation}`, {
            duration: `${duration.toFixed(2)}ms`,
            startTime,
            endTime
        });
    }

    /**
     * 记录用户操作日志
     * @param {string} action - 用户操作
     * @param {Object} details - 操作详情
     */
    userAction(action, details = {}) {
        this.info(`用户操作: ${action}`, {
            type: 'user_action',
            ...details
        });
    }

    /**
     * 记录文件操作日志
     * @param {string} operation - 文件操作类型
     * @param {string} filename - 文件名
     * @param {Object} details - 操作详情
     */
    fileOperation(operation, filename, details = {}) {
        this.info(`文件操作: ${operation}`, {
            type: 'file_operation',
            filename,
            ...details
        });
    }

    /**
     * 记录数据处理日志
     * @param {string} step - 处理步骤
     * @param {Object} stats - 统计信息
     */
    dataProcessing(step, stats = {}) {
        this.info(`数据处理: ${step}`, {
            type: 'data_processing',
            ...stats
        });
    }

    /**
     * 获取所有日志
     * @param {string} level - 可选的日志级别过滤
     * @returns {Array} 日志数组
     */
    getLogs(level = null) {
        if (level) {
            return this.logs.filter(log => log.level === level.toUpperCase());
        }
        return [...this.logs];
    }

    /**
     * 获取错误日志
     * @returns {Array} 错误日志数组
     */
    getErrors() {
        return this.getLogs('ERROR');
    }

    /**
     * 清空日志
     */
    clear() {
        this.logs = [];
        console.clear();
    }

    /**
     * 导出日志为文本格式
     * @returns {string} 格式化的日志文本
     */
    exportLogs() {
        return this.logs.map(log => {
            const timeStr = log.timestamp.toISOString();
            let logLine = `[${timeStr}] [${log.level}] ${log.message}`;
            
            if (log.data) {
                logLine += `\n  数据: ${JSON.stringify(log.data, null, 2)}`;
            }
            
            if (log.stack && log.level === 'ERROR') {
                logLine += `\n  堆栈: ${log.stack}`;
            }
            
            return logLine;
        }).join('\n\n');
    }

    /**
     * 获取日志统计信息
     * @returns {Object} 统计信息
     */
    getStats() {
        const stats = {
            total: this.logs.length,
            error: 0,
            warn: 0,
            info: 0,
            debug: 0
        };

        this.logs.forEach(log => {
            stats[log.level.toLowerCase()]++;
        });

        return stats;
    }

    /**
     * 创建计时器
     * @param {string} label - 计时器标签
     * @returns {Object} 计时器对象
     */
    createTimer(label) {
        const startTime = performance.now();
        
        return {
            start: startTime,
            stop: () => {
                const endTime = performance.now();
                this.performance(label, startTime, endTime);
                return endTime - startTime;
            }
        };
    }

    /**
     * 记录异步操作
     * @param {string} operation - 操作名称
     * @param {Promise} promise - 异步操作的Promise
     * @returns {Promise} 包装后的Promise
     */
    async trackAsync(operation, promise) {
        const timer = this.createTimer(operation);
        this.info(`开始异步操作: ${operation}`);
        
        try {
            const result = await promise;
            timer.stop();
            this.info(`异步操作成功: ${operation}`);
            return result;
        } catch (error) {
            timer.stop();
            this.error(`异步操作失败: ${operation}`, error);
            throw error;
        }
    }
}

// 导出单例实例
const logger = new Logger();

// 设置默认日志级别
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    logger.setLevel('DEBUG');
} else {
    logger.setLevel('INFO');
}

export default logger; 