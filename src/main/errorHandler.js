/**
 * 错误处理器 - 统一的错误分类和处理机制
 */

const { dialog } = require('electron');
const EventEmitter = require('events');

class ErrorHandler extends EventEmitter {
    constructor() {
        super();
        this.errorTypes = {
            FILE_ERROR: 'file',
            MEMORY_ERROR: 'memory',
            PROCESSING_ERROR: 'processing',
            NETWORK_ERROR: 'network',
            SYSTEM_ERROR: 'system',
            CONFIG_ERROR: 'config'
        };
        
        this.errorCounts = new Map();
        this.recentErrors = [];
        this.maxRecentErrors = 100;
    }

    /**
     * 处理错误
     */
    async handleError(error, context = {}) {
        const errorInfo = this.classifyError(error, context);
        
        // 记录错误
        this.recordError(errorInfo);
        
        // 根据错误类型处理
        switch (errorInfo.type) {
            case this.errorTypes.FILE_ERROR:
                return await this.handleFileError(errorInfo);
            case this.errorTypes.MEMORY_ERROR:
                return await this.handleMemoryError(errorInfo);
            case this.errorTypes.PROCESSING_ERROR:
                return await this.handleProcessingError(errorInfo);
            default:
                return await this.handleGenericError(errorInfo);
        }
    }

    /**
     * 分类错误
     */
    classifyError(error, context) {
        const errorInfo = {
            id: Date.now() + Math.random(),
            timestamp: Date.now(),
            message: error.message || '未知错误',
            stack: error.stack,
            code: error.code,
            context: context,
            type: this.errorTypes.SYSTEM_ERROR,
            severity: 'medium',
            recoverable: true
        };

        // 根据错误代码和消息分类
        if (error.code) {
            switch (error.code) {
                case 'ENOENT':
                case 'EACCES':
                case 'EMFILE':
                    errorInfo.type = this.errorTypes.FILE_ERROR;
                    break;
                case 'ENOMEM':
                    errorInfo.type = this.errorTypes.MEMORY_ERROR;
                    errorInfo.severity = 'high';
                    break;
            }
        }

        // 根据错误消息分类
        const message = error.message.toLowerCase();
        if (message.includes('memory') || message.includes('heap')) {
            errorInfo.type = this.errorTypes.MEMORY_ERROR;
            errorInfo.severity = 'high';
        } else if (message.includes('file') || message.includes('path')) {
            errorInfo.type = this.errorTypes.FILE_ERROR;
        } else if (message.includes('process') || message.includes('worker')) {
            errorInfo.type = this.errorTypes.PROCESSING_ERROR;
        } else if (message.includes('config')) {
            errorInfo.type = this.errorTypes.CONFIG_ERROR;
        }

        return errorInfo;
    }

    /**
     * 记录错误
     */
    recordError(errorInfo) {
        // 更新错误计数
        const count = this.errorCounts.get(errorInfo.type) || 0;
        this.errorCounts.set(errorInfo.type, count + 1);

        // 添加到最近错误列表
        this.recentErrors.unshift(errorInfo);
        if (this.recentErrors.length > this.maxRecentErrors) {
            this.recentErrors = this.recentErrors.slice(0, this.maxRecentErrors);
        }

        // 发出错误事件
        this.emit('error', errorInfo);

        console.error(`[${errorInfo.type}] ${errorInfo.message}`, errorInfo.stack);
    }

    /**
     * 处理文件错误
     */
    async handleFileError(errorInfo) {
        const { code, context } = errorInfo;
        
        switch (code) {
            case 'ENOENT':
                return await this.showFileNotFoundDialog(context.filePath);
            case 'EACCES':
                return await this.showPermissionErrorDialog(context.filePath);
            case 'EMFILE':
                return await this.handleTooManyFilesError();
            default:
                return await this.showGenericFileError(errorInfo);
        }
    }

    /**
     * 处理内存错误
     */
    async handleMemoryError(errorInfo) {
        // 尝试自动恢复
        await this.attemptMemoryRecovery();
        
        // 显示内存警告
        return await this.showMemoryWarning(errorInfo);
    }

    /**
     * 处理处理错误
     */
    async handleProcessingError(errorInfo) {
        return await this.showProcessingError(errorInfo);
    }

    /**
     * 处理通用错误
     */
    async handleGenericError(errorInfo) {
        return await this.showGenericError(errorInfo);
    }

    /**
     * 显示文件未找到对话框
     */
    async showFileNotFoundDialog(filePath) {
        const result = await dialog.showMessageBox({
            type: 'error',
            title: '文件未找到',
            message: `无法找到文件: ${filePath}`,
            detail: '请检查文件路径是否正确，或者文件是否已被移动或删除。',
            buttons: ['重试', '选择其他文件', '取消'],
            defaultId: 0,
            cancelId: 2
        });

        return {
            action: ['retry', 'select', 'cancel'][result.response],
            recoverable: result.response !== 2
        };
    }

    /**
     * 显示权限错误对话框
     */
    async showPermissionErrorDialog(filePath) {
        const result = await dialog.showMessageBox({
            type: 'error',
            title: '权限不足',
            message: `无法访问文件: ${filePath}`,
            detail: '请检查文件权限，或以管理员身份运行应用。',
            buttons: ['重试', '取消'],
            defaultId: 0,
            cancelId: 1
        });

        return {
            action: result.response === 0 ? 'retry' : 'cancel',
            recoverable: result.response === 0
        };
    }

    /**
     * 处理文件句柄过多错误
     */
    async handleTooManyFilesError() {
        await dialog.showMessageBox({
            type: 'warning',
            title: '系统资源不足',
            message: '打开的文件过多',
            detail: '系统已达到最大文件句柄数限制。应用将自动清理资源并重试。',
            buttons: ['确定']
        });

        // 触发资源清理
        this.emit('cleanup-required');

        return {
            action: 'cleanup',
            recoverable: true
        };
    }

    /**
     * 尝试内存恢复
     */
    async attemptMemoryRecovery() {
        try {
            // 触发垃圾回收
            if (global.gc) {
                global.gc();
            }

            // 清理缓存
            this.emit('memory-cleanup');

            console.log('内存恢复尝试完成');
        } catch (error) {
            console.error('内存恢复失败:', error);
        }
    }

    /**
     * 显示内存警告
     */
    async showMemoryWarning(errorInfo) {
        const result = await dialog.showMessageBox({
            type: 'warning',
            title: '内存不足',
            message: '系统内存不足',
            detail: '应用已自动清理内存并优化性能。建议关闭其他应用或处理较小的文件。',
            buttons: ['继续', '调整设置', '退出'],
            defaultId: 0,
            cancelId: 2
        });

        return {
            action: ['continue', 'settings', 'exit'][result.response],
            recoverable: result.response !== 2
        };
    }

    /**
     * 显示处理错误
     */
    async showProcessingError(errorInfo) {
        const result = await dialog.showMessageBox({
            type: 'error',
            title: '处理失败',
            message: '数据处理过程中发生错误',
            detail: errorInfo.message,
            buttons: ['重试', '跳过', '取消'],
            defaultId: 0,
            cancelId: 2
        });

        return {
            action: ['retry', 'skip', 'cancel'][result.response],
            recoverable: result.response !== 2
        };
    }

    /**
     * 显示通用错误
     */
    async showGenericError(errorInfo) {
        const result = await dialog.showMessageBox({
            type: 'error',
            title: '发生错误',
            message: errorInfo.message,
            detail: '请尝试重新操作，如果问题持续存在，请联系技术支持。',
            buttons: ['确定', '查看详情'],
            defaultId: 0
        });

        if (result.response === 1) {
            // 显示详细错误信息
            await dialog.showMessageBox({
                type: 'info',
                title: '错误详情',
                message: errorInfo.stack || errorInfo.message,
                buttons: ['确定']
            });
        }

        return {
            action: 'acknowledge',
            recoverable: true
        };
    }

    /**
     * 获取错误统计
     */
    getErrorStats() {
        return {
            totalErrors: this.recentErrors.length,
            errorsByType: Object.fromEntries(this.errorCounts),
            recentErrors: this.recentErrors.slice(0, 10),
            lastError: this.recentErrors[0] || null
        };
    }

    /**
     * 清理错误历史
     */
    clearErrorHistory() {
        this.recentErrors = [];
        this.errorCounts.clear();
        this.emit('history-cleared');
    }
}

module.exports = ErrorHandler;