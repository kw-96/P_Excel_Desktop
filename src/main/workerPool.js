/**
 * Worker进程池管理器 - 管理和调度Worker进程
 */

const { Worker } = require('worker_threads');
const path = require('path');
const EventEmitter = require('events');

class WorkerPool extends EventEmitter {
    constructor(options = {}) {
        super();
        this.options = {
            maxWorkers: options.maxWorkers || require('os').cpus().length,
            minWorkers: options.minWorkers || 1,
            idleTimeout: options.idleTimeout || 60000, // 60秒
            ...options
        };
        
        this.workers = new Map();
        this.availableWorkers = new Map();
        this.busyWorkers = new Map();
        this.taskQueue = [];
        this.nextWorkerId = 1;
        this.isShuttingDown = false;
        
        this.workerTypes = {
            parser: path.join(__dirname, '../workers/dataParserWorker.js'),
            processor: path.join(__dirname, '../workers/dataProcessorWorker.js'),
            cache: path.join(__dirname, '../workers/cacheWorker.js')
        };
    }

    /**
     * 初始化Worker池
     */
    async initialize() {
        try {
            // 创建最小数量的Worker
            for (let i = 0; i < this.options.minWorkers; i++) {
                await this.createWorker('processor'); // 默认创建处理器Worker
            }
            
            console.log(`Worker池初始化完成: ${this.workers.size} 个Worker`);
        } catch (error) {
            console.error('Worker池初始化失败:', error);
            throw error;
        }
    }

    /**
     * 创建Worker
     */
    async createWorker(type, workerData = {}) {
        if (this.isShuttingDown) {
            throw new Error('Worker池正在关闭');
        }

        if (!this.workerTypes[type]) {
            throw new Error(`不支持的Worker类型: ${type}`);
        }

        const workerId = `${type}-${this.nextWorkerId++}`;
        
        try {
            const worker = new Worker(this.workerTypes[type], {
                workerData: {
                    workerId,
                    type,
                    ...workerData
                }
            });

            const workerInfo = {
                id: workerId,
                type,
                worker,
                busy: false,
                createdAt: Date.now(),
                lastUsed: Date.now(),
                taskCount: 0,
                currentTask: null,
                idleTimer: null
            };

            // 设置Worker事件监听
            this.setupWorkerEvents(workerInfo);

            // 添加到Worker池
            this.workers.set(workerId, workerInfo);
            this.availableWorkers.set(workerId, workerInfo);

            // 设置空闲超时
            this.setIdleTimeout(workerInfo);

            console.log(`创建Worker: ${workerId} (${type})`);
            this.emit('workerCreated', workerInfo);

            return workerInfo;

        } catch (error) {
            console.error(`创建Worker失败: ${workerId}`, error);
            throw error;
        }
    }

    /**
     * 设置Worker事件监听
     */
    setupWorkerEvents(workerInfo) {
        const { worker, id } = workerInfo;

        worker.on('message', (message) => {
            this.handleWorkerMessage(workerInfo, message);
        });

        worker.on('error', (error) => {
            console.error(`Worker错误 ${id}:`, error);
            this.handleWorkerError(workerInfo, error);
        });

        worker.on('exit', (code) => {
            console.log(`Worker退出 ${id}: 代码 ${code}`);
            this.handleWorkerExit(workerInfo, code);
        });
    }

    /**
     * 处理Worker消息
     */
    handleWorkerMessage(workerInfo, message) {
        const { type, id: messageId, data } = message;

        switch (type) {
            case 'ready':
                console.log(`Worker就绪: ${workerInfo.id}`);
                this.emit('workerReady', workerInfo);
                break;
                
            case 'result':
                this.handleTaskResult(workerInfo, messageId, data);
                break;
                
            case 'error':
                this.handleTaskError(workerInfo, messageId, data);
                break;
                
            case 'progress':
                this.handleTaskProgress(workerInfo, messageId, data);
                break;
                
            default:
                console.warn(`未知的Worker消息类型: ${type}`);
        }
    }

    /**
     * 处理任务结果
     */
    handleTaskResult(workerInfo, messageId, data) {
        const task = workerInfo.currentTask;
        
        if (task && task.id === messageId) {
            // 任务完成
            this.completeTask(workerInfo, task, data);
        }
    }

    /**
     * 处理任务错误
     */
    handleTaskError(workerInfo, messageId, error) {
        const task = workerInfo.currentTask;
        
        if (task && task.id === messageId) {
            // 任务失败
            this.failTask(workerInfo, task, error);
        }
    }

    /**
     * 处理任务进度
     */
    handleTaskProgress(workerInfo, messageId, progress) {
        const task = workerInfo.currentTask;
        
        if (task && task.id === messageId && task.onProgress) {
            task.onProgress(progress);
        }
    }

    /**
     * 处理Worker错误
     */
    handleWorkerError(workerInfo, error) {
        // 如果Worker有当前任务，标记为失败
        if (workerInfo.currentTask) {
            this.failTask(workerInfo, workerInfo.currentTask, error);
        }

        // 重新创建Worker
        this.recreateWorker(workerInfo);
    }

    /**
     * 处理Worker退出
     */
    handleWorkerExit(workerInfo, code) {
        // 从池中移除Worker
        this.removeWorker(workerInfo.id);

        // 如果不是正常关闭，重新创建Worker
        if (code !== 0 && !this.isShuttingDown) {
            this.recreateWorker(workerInfo);
        }
    }

    /**
     * 重新创建Worker
     */
    async recreateWorker(workerInfo) {
        try {
            console.log(`重新创建Worker: ${workerInfo.id}`);
            await this.createWorker(workerInfo.type);
        } catch (error) {
            console.error('重新创建Worker失败:', error);
        }
    }

    /**
     * 移除Worker
     */
    removeWorker(workerId) {
        const workerInfo = this.workers.get(workerId);
        
        if (workerInfo) {
            // 清理空闲定时器
            if (workerInfo.idleTimer) {
                clearTimeout(workerInfo.idleTimer);
            }

            // 从各个集合中移除
            this.workers.delete(workerId);
            this.availableWorkers.delete(workerId);
            this.busyWorkers.delete(workerId);

            // 终止Worker
            if (!workerInfo.worker.threadId) {
                workerInfo.worker.terminate();
            }

            console.log(`移除Worker: ${workerId}`);
            this.emit('workerRemoved', workerInfo);
        }
    }

    /**
     * 执行任务
     */
    async executeTask(type, taskType, data, options = {}) {
        return new Promise((resolve, reject) => {
            const task = {
                id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                type,
                taskType,
                data,
                options,
                resolve,
                reject,
                onProgress: options.onProgress,
                createdAt: Date.now(),
                priority: options.priority || 'normal'
            };

            // 添加到任务队列
            this.taskQueue.push(task);
            
            // 按优先级排序
            this.taskQueue.sort((a, b) => {
                const priorityOrder = { high: 3, normal: 2, low: 1 };
                return priorityOrder[b.priority] - priorityOrder[a.priority];
            });

            // 尝试分配Worker
            this.assignTask();
        });
    }

    /**
     * 分配任务
     */
    async assignTask() {
        if (this.taskQueue.length === 0) {
            return;
        }

        const task = this.taskQueue[0];
        let workerInfo = this.findAvailableWorker(task.type);

        // 如果没有可用的Worker，尝试创建新的
        if (!workerInfo && this.workers.size < this.options.maxWorkers) {
            try {
                workerInfo = await this.createWorker(task.type);
            } catch (error) {
                console.error('创建Worker失败:', error);
                return;
            }
        }

        if (workerInfo) {
            // 从队列中移除任务
            this.taskQueue.shift();
            
            // 分配任务给Worker
            this.assignTaskToWorker(workerInfo, task);
        }
    }

    /**
     * 查找可用Worker
     */
    findAvailableWorker(type) {
        // 优先查找相同类型的可用Worker
        for (const [workerId, workerInfo] of this.availableWorkers) {
            if (workerInfo.type === type) {
                return workerInfo;
            }
        }

        // 如果没有相同类型的，查找任何可用的Worker
        for (const [workerId, workerInfo] of this.availableWorkers) {
            return workerInfo;
        }

        return null;
    }

    /**
     * 将任务分配给Worker
     */
    assignTaskToWorker(workerInfo, task) {
        // 更新Worker状态
        workerInfo.busy = true;
        workerInfo.currentTask = task;
        workerInfo.lastUsed = Date.now();
        workerInfo.taskCount++;

        // 清理空闲定时器
        if (workerInfo.idleTimer) {
            clearTimeout(workerInfo.idleTimer);
            workerInfo.idleTimer = null;
        }

        // 移动到忙碌Worker集合
        this.availableWorkers.delete(workerInfo.id);
        this.busyWorkers.set(workerInfo.id, workerInfo);

        // 发送任务给Worker
        workerInfo.worker.postMessage({
            type: task.taskType,
            id: task.id,
            data: task.data
        });

        console.log(`任务分配: ${task.id} -> ${workerInfo.id}`);
        this.emit('taskAssigned', { task, worker: workerInfo });
    }

    /**
     * 完成任务
     */
    completeTask(workerInfo, task, result) {
        // 释放Worker
        this.releaseWorker(workerInfo);

        // 解析Promise
        task.resolve(result);

        console.log(`任务完成: ${task.id}`);
        this.emit('taskCompleted', { task, worker: workerInfo, result });

        // 尝试分配下一个任务
        this.assignTask();
    }

    /**
     * 任务失败
     */
    failTask(workerInfo, task, error) {
        // 释放Worker
        this.releaseWorker(workerInfo);

        // 拒绝Promise
        task.reject(new Error(error.message || '任务执行失败'));

        console.error(`任务失败: ${task.id}`, error);
        this.emit('taskFailed', { task, worker: workerInfo, error });

        // 尝试分配下一个任务
        this.assignTask();
    }

    /**
     * 释放Worker
     */
    releaseWorker(workerInfo) {
        // 更新Worker状态
        workerInfo.busy = false;
        workerInfo.currentTask = null;
        workerInfo.lastUsed = Date.now();

        // 移动到可用Worker集合
        this.busyWorkers.delete(workerInfo.id);
        this.availableWorkers.set(workerInfo.id, workerInfo);

        // 设置空闲超时
        this.setIdleTimeout(workerInfo);

        console.log(`释放Worker: ${workerInfo.id}`);
        this.emit('workerReleased', workerInfo);
    }

    /**
     * 设置空闲超时
     */
    setIdleTimeout(workerInfo) {
        if (workerInfo.idleTimer) {
            clearTimeout(workerInfo.idleTimer);
        }

        // 如果Worker数量超过最小值，设置空闲超时
        if (this.workers.size > this.options.minWorkers) {
            workerInfo.idleTimer = setTimeout(() => {
                if (!workerInfo.busy && this.workers.size > this.options.minWorkers) {
                    console.log(`空闲超时，移除Worker: ${workerInfo.id}`);
                    this.removeWorker(workerInfo.id);
                }
            }, this.options.idleTimeout);
        }
    }

    /**
     * 获取池状态
     */
    getStatus() {
        return {
            totalWorkers: this.workers.size,
            availableWorkers: this.availableWorkers.size,
            busyWorkers: this.busyWorkers.size,
            queuedTasks: this.taskQueue.length,
            maxWorkers: this.options.maxWorkers,
            minWorkers: this.options.minWorkers,
            workers: Array.from(this.workers.values()).map(worker => ({
                id: worker.id,
                type: worker.type,
                busy: worker.busy,
                taskCount: worker.taskCount,
                createdAt: worker.createdAt,
                lastUsed: worker.lastUsed,
                currentTask: worker.currentTask ? worker.currentTask.id : null
            }))
        };
    }

    /**
     * 关闭Worker池
     */
    async shutdown() {
        this.isShuttingDown = true;
        
        console.log('开始关闭Worker池...');

        // 等待所有任务完成
        while (this.busyWorkers.size > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // 终止所有Worker
        const terminatePromises = Array.from(this.workers.values()).map(workerInfo => {
            return new Promise((resolve) => {
                workerInfo.worker.terminate().then(resolve).catch(resolve);
            });
        });

        await Promise.all(terminatePromises);

        // 清理
        this.workers.clear();
        this.availableWorkers.clear();
        this.busyWorkers.clear();
        this.taskQueue.length = 0;

        console.log('Worker池关闭完成');
        this.emit('shutdown');
    }
}

module.exports = WorkerPool;