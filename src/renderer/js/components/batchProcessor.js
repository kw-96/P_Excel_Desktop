/**
 * 批量处理组件 - 管理多文件批量处理队列
 */

class BatchProcessor {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            maxConcurrent: options.maxConcurrent || 3,
            autoStart: options.autoStart !== false,
            showProgress: options.showProgress !== false,
            onComplete: options.onComplete || null,
            onError: options.onError || null,
            ...options
        };
        
        this.queue = [];
        this.processing = [];
        this.completed = [];
        this.failed = [];
        this.isRunning = false;
        this.totalTasks = 0;
        
        this.init();
    }

    /**
     * 初始化批量处理器
     */
    init() {
        this.createUI();
        this.bindEvents();
    }

    /**
     * 创建UI
     */
    createUI() {
        this.container.innerHTML = `
            <div class="batch-processor">
                <div class="batch-header">
                    <h3 class="batch-title">批量处理队列</h3>
                    <div class="batch-stats">
                        <span class="stat-item">
                            <span class="stat-label">总计:</span>
                            <span class="stat-value total-count">0</span>
                        </span>
                        <span class="stat-item">
                            <span class="stat-label">处理中:</span>
                            <span class="stat-value processing-count">0</span>
                        </span>
                        <span class="stat-item">
                            <span class="stat-label">已完成:</span>
                            <span class="stat-value completed-count">0</span>
                        </span>
                        <span class="stat-item">
                            <span class="stat-label">失败:</span>
                            <span class="stat-value failed-count">0</span>
                        </span>
                    </div>
                </div>
                
                <div class="batch-controls">
                    <button class="btn btn-sm btn-primary start-batch">开始处理</button>
                    <button class="btn btn-sm btn-warning pause-batch" disabled>暂停</button>
                    <button class="btn btn-sm btn-error stop-batch" disabled>停止</button>
                    <button class="btn btn-sm btn-ghost clear-batch">清空队列</button>
                    <div class="batch-settings">
                        <label class="setting-item">
                            <span>并发数:</span>
                            <input type="number" class="concurrent-input" min="1" max="10" value="${this.options.maxConcurrent}">
                        </label>
                    </div>
                </div>
                
                <div class="batch-progress" ${this.options.showProgress ? '' : 'style="display: none;"'}>
                    <div class="progress-bar-container">
                        <div class="progress-bar">
                            <div class="progress-fill"></div>
                        </div>
                        <span class="progress-text">0%</span>
                    </div>
                </div>
                
                <div class="batch-queue">
                    <div class="queue-section">
                        <h4 class="section-title">等待队列</h4>
                        <div class="queue-list waiting-list"></div>
                    </div>
                    
                    <div class="queue-section">
                        <h4 class="section-title">处理中</h4>
                        <div class="queue-list processing-list"></div>
                    </div>
                    
                    <div class="queue-section">
                        <h4 class="section-title">已完成</h4>
                        <div class="queue-list completed-list"></div>
                    </div>
                    
                    <div class="queue-section">
                        <h4 class="section-title">失败</h4>
                        <div class="queue-list failed-list"></div>
                    </div>
                </div>
            </div>
        `;

        // 获取DOM元素引用
        this.elements = {
            totalCount: this.container.querySelector('.total-count'),
            processingCount: this.container.querySelector('.processing-count'),
            completedCount: this.container.querySelector('.completed-count'),
            failedCount: this.container.querySelector('.failed-count'),
            startButton: this.container.querySelector('.start-batch'),
            pauseButton: this.container.querySelector('.pause-batch'),
            stopButton: this.container.querySelector('.stop-batch'),
            clearButton: this.container.querySelector('.clear-batch'),
            concurrentInput: this.container.querySelector('.concurrent-input'),
            progressFill: this.container.querySelector('.progress-fill'),
            progressText: this.container.querySelector('.progress-text'),
            waitingList: this.container.querySelector('.waiting-list'),
            processingList: this.container.querySelector('.processing-list'),
            completedList: this.container.querySelector('.completed-list'),
            failedList: this.container.querySelector('.failed-list')
        };
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        this.elements.startButton.addEventListener('click', () => {
            this.start();
        });

        this.elements.pauseButton.addEventListener('click', () => {
            this.pause();
        });

        this.elements.stopButton.addEventListener('click', () => {
            this.stop();
        });

        this.elements.clearButton.addEventListener('click', () => {
            this.clear();
        });

        this.elements.concurrentInput.addEventListener('change', (e) => {
            this.options.maxConcurrent = parseInt(e.target.value) || 1;
        });
    }

    /**
     * 添加任务到队列
     */
    addTask(task) {
        const taskItem = {
            id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: task.name || '未命名任务',
            type: task.type || 'unknown',
            data: task.data || {},
            options: task.options || {},
            status: 'waiting',
            progress: 0,
            startTime: null,
            endTime: null,
            error: null,
            result: null,
            processor: task.processor || this.defaultProcessor
        };

        this.queue.push(taskItem);
        this.totalTasks++;
        this.updateUI();
        this.renderTask(taskItem, 'waiting');

        console.log(`添加任务到队列: ${taskItem.name}`);

        // 如果设置了自动开始，立即开始处理
        if (this.options.autoStart && !this.isRunning) {
            this.start();
        }

        return taskItem.id;
    }

    /**
     * 添加多个任务
     */
    addTasks(tasks) {
        const taskIds = [];
        tasks.forEach(task => {
            const taskId = this.addTask(task);
            taskIds.push(taskId);
        });
        return taskIds;
    }

    /**
     * 开始处理
     */
    start() {
        if (this.isRunning) return;

        this.isRunning = true;
        this.elements.startButton.disabled = true;
        this.elements.pauseButton.disabled = false;
        this.elements.stopButton.disabled = false;

        console.log('开始批量处理');
        this.processNext();
    }

    /**
     * 暂停处理
     */
    pause() {
        if (!this.isRunning) return;

        this.isRunning = false;
        this.elements.startButton.disabled = false;
        this.elements.pauseButton.disabled = true;
        this.elements.stopButton.disabled = false;

        console.log('暂停批量处理');
    }

    /**
     * 停止处理
     */
    stop() {
        this.isRunning = false;
        this.elements.startButton.disabled = false;
        this.elements.pauseButton.disabled = true;
        this.elements.stopButton.disabled = true;

        // 取消所有处理中的任务
        this.processing.forEach(task => {
            task.status = 'cancelled';
            this.moveTaskToFailed(task, new Error('用户取消'));
        });

        this.processing = [];
        this.updateUI();

        console.log('停止批量处理');
    }

    /**
     * 清空队列
     */
    clear() {
        if (this.isRunning) {
            this.stop();
        }

        this.queue = [];
        this.processing = [];
        this.completed = [];
        this.failed = [];
        this.totalTasks = 0;

        this.updateUI();
        this.clearAllLists();

        console.log('清空批量处理队列');
    }

    /**
     * 处理下一个任务
     */
    async processNext() {
        if (!this.isRunning) return;

        // 检查是否可以启动新任务
        while (this.processing.length < this.options.maxConcurrent && this.queue.length > 0) {
            const task = this.queue.shift();
            await this.processTask(task);
        }

        // 如果所有任务都完成了
        if (this.queue.length === 0 && this.processing.length === 0) {
            this.onAllTasksComplete();
        }
    }

    /**
     * 处理单个任务
     */
    async processTask(task) {
        task.status = 'processing';
        task.startTime = Date.now();
        this.processing.push(task);
        
        this.updateUI();
        this.renderTask(task, 'processing');

        try {
            console.log(`开始处理任务: ${task.name}`);

            // 执行任务处理器
            const result = await task.processor(task.data, {
                ...task.options,
                onProgress: (progress) => {
                    task.progress = progress.progress || 0;
                    this.updateTaskProgress(task);
                }
            });

            // 任务成功完成
            task.status = 'completed';
            task.endTime = Date.now();
            task.result = result;
            
            this.moveTaskToCompleted(task);
            console.log(`任务完成: ${task.name}`);

        } catch (error) {
            // 任务失败
            task.status = 'failed';
            task.endTime = Date.now();
            task.error = error;
            
            this.moveTaskToFailed(task, error);
            console.error(`任务失败: ${task.name}`, error);

            if (this.options.onError) {
                this.options.onError(task, error);
            }
        }

        // 继续处理下一个任务
        setTimeout(() => {
            this.processNext();
        }, 100);
    }

    /**
     * 将任务移动到已完成列表
     */
    moveTaskToCompleted(task) {
        const index = this.processing.findIndex(t => t.id === task.id);
        if (index !== -1) {
            this.processing.splice(index, 1);
        }
        
        this.completed.push(task);
        this.updateUI();
        this.renderTask(task, 'completed');
    }

    /**
     * 将任务移动到失败列表
     */
    moveTaskToFailed(task, error) {
        const index = this.processing.findIndex(t => t.id === task.id);
        if (index !== -1) {
            this.processing.splice(index, 1);
        }
        
        task.error = error;
        this.failed.push(task);
        this.updateUI();
        this.renderTask(task, 'failed');
    }

    /**
     * 更新UI统计信息
     */
    updateUI() {
        this.elements.totalCount.textContent = this.totalTasks;
        this.elements.processingCount.textContent = this.processing.length;
        this.elements.completedCount.textContent = this.completed.length;
        this.elements.failedCount.textContent = this.failed.length;

        // 更新进度条
        if (this.totalTasks > 0) {
            const completedTasks = this.completed.length + this.failed.length;
            const progress = (completedTasks / this.totalTasks) * 100;
            this.elements.progressFill.style.width = `${progress}%`;
            this.elements.progressText.textContent = `${Math.round(progress)}%`;
        } else {
            this.elements.progressFill.style.width = '0%';
            this.elements.progressText.textContent = '0%';
        }
    }

    /**
     * 渲染任务项
     */
    renderTask(task, listType) {
        const existingElement = document.getElementById(`task-${task.id}`);
        if (existingElement) {
            existingElement.remove();
        }

        const taskElement = document.createElement('div');
        taskElement.id = `task-${task.id}`;
        taskElement.className = 'task-item';
        taskElement.innerHTML = `
            <div class="task-info">
                <div class="task-name">${task.name}</div>
                <div class="task-details">
                    <span class="task-type">${task.type}</span>
                    <span class="task-status status-${task.status}">${this.getStatusText(task.status)}</span>
                </div>
            </div>
            <div class="task-progress">
                <div class="progress-bar-small">
                    <div class="progress-fill-small" style="width: ${task.progress}%"></div>
                </div>
                <span class="progress-text-small">${Math.round(task.progress)}%</span>
            </div>
            <div class="task-actions">
                ${this.getTaskActions(task)}
            </div>
        `;

        // 添加到对应的列表
        const targetList = this.elements[`${listType}List`];
        if (targetList) {
            targetList.appendChild(taskElement);
        }

        // 绑定任务操作事件
        this.bindTaskEvents(taskElement, task);
    }

    /**
     * 获取状态文本
     */
    getStatusText(status) {
        const statusMap = {
            waiting: '等待中',
            processing: '处理中',
            completed: '已完成',
            failed: '失败',
            cancelled: '已取消'
        };
        return statusMap[status] || status;
    }

    /**
     * 获取任务操作按钮
     */
    getTaskActions(task) {
        switch (task.status) {
            case 'waiting':
                return `
                    <button class="btn btn-xs btn-error remove-task" data-task-id="${task.id}">移除</button>
                `;
            case 'processing':
                return `
                    <button class="btn btn-xs btn-warning cancel-task" data-task-id="${task.id}">取消</button>
                `;
            case 'completed':
                return `
                    <button class="btn btn-xs btn-info view-result" data-task-id="${task.id}">查看结果</button>
                    <button class="btn btn-xs btn-ghost remove-task" data-task-id="${task.id}">移除</button>
                `;
            case 'failed':
                return `
                    <button class="btn btn-xs btn-warning retry-task" data-task-id="${task.id}">重试</button>
                    <button class="btn btn-xs btn-info view-error" data-task-id="${task.id}">查看错误</button>
                    <button class="btn btn-xs btn-ghost remove-task" data-task-id="${task.id}">移除</button>
                `;
            default:
                return '';
        }
    }

    /**
     * 绑定任务事件
     */
    bindTaskEvents(element, task) {
        element.addEventListener('click', (e) => {
            const action = e.target.dataset.action || e.target.className.split(' ').find(c => c.endsWith('-task'));
            const taskId = e.target.dataset.taskId;

            if (taskId !== task.id) return;

            switch (action) {
                case 'remove-task':
                    this.removeTask(taskId);
                    break;
                case 'cancel-task':
                    this.cancelTask(taskId);
                    break;
                case 'retry-task':
                    this.retryTask(taskId);
                    break;
                case 'view-result':
                    this.viewTaskResult(taskId);
                    break;
                case 'view-error':
                    this.viewTaskError(taskId);
                    break;
            }
        });
    }

    /**
     * 移除任务
     */
    removeTask(taskId) {
        // 从各个列表中移除
        this.queue = this.queue.filter(t => t.id !== taskId);
        this.completed = this.completed.filter(t => t.id !== taskId);
        this.failed = this.failed.filter(t => t.id !== taskId);

        // 移除DOM元素
        const element = document.getElementById(`task-${taskId}`);
        if (element) {
            element.remove();
        }

        this.totalTasks--;
        this.updateUI();
    }

    /**
     * 取消任务
     */
    cancelTask(taskId) {
        const task = this.processing.find(t => t.id === taskId);
        if (task) {
            task.status = 'cancelled';
            this.moveTaskToFailed(task, new Error('用户取消'));
        }
    }

    /**
     * 重试任务
     */
    retryTask(taskId) {
        const taskIndex = this.failed.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
            const task = this.failed.splice(taskIndex, 1)[0];
            
            // 重置任务状态
            task.status = 'waiting';
            task.progress = 0;
            task.startTime = null;
            task.endTime = null;
            task.error = null;
            task.result = null;

            // 添加回队列
            this.queue.push(task);
            this.updateUI();
            this.renderTask(task, 'waiting');

            // 如果正在运行，继续处理
            if (this.isRunning) {
                this.processNext();
            }
        }
    }

    /**
     * 查看任务结果
     */
    viewTaskResult(taskId) {
        const task = this.completed.find(t => t.id === taskId);
        if (task && task.result) {
            // 这里可以打开一个模态框显示结果
            console.log('任务结果:', task.result);
            alert(`任务 "${task.name}" 的结果:\n${JSON.stringify(task.result, null, 2)}`);
        }
    }

    /**
     * 查看任务错误
     */
    viewTaskError(taskId) {
        const task = this.failed.find(t => t.id === taskId);
        if (task && task.error) {
            // 这里可以打开一个模态框显示错误
            console.error('任务错误:', task.error);
            alert(`任务 "${task.name}" 的错误:\n${task.error.message}`);
        }
    }

    /**
     * 更新任务进度
     */
    updateTaskProgress(task) {
        const element = document.getElementById(`task-${task.id}`);
        if (element) {
            const progressFill = element.querySelector('.progress-fill-small');
            const progressText = element.querySelector('.progress-text-small');
            
            if (progressFill) {
                progressFill.style.width = `${task.progress}%`;
            }
            if (progressText) {
                progressText.textContent = `${Math.round(task.progress)}%`;
            }
        }
    }

    /**
     * 清空所有列表
     */
    clearAllLists() {
        this.elements.waitingList.innerHTML = '';
        this.elements.processingList.innerHTML = '';
        this.elements.completedList.innerHTML = '';
        this.elements.failedList.innerHTML = '';
    }

    /**
     * 所有任务完成回调
     */
    onAllTasksComplete() {
        this.isRunning = false;
        this.elements.startButton.disabled = false;
        this.elements.pauseButton.disabled = true;
        this.elements.stopButton.disabled = true;

        console.log('所有批量处理任务完成');

        if (this.options.onComplete) {
            this.options.onComplete({
                total: this.totalTasks,
                completed: this.completed.length,
                failed: this.failed.length
            });
        }
    }

    /**
     * 默认任务处理器
     */
    async defaultProcessor(data, options = {}) {
        // 模拟处理过程
        return new Promise((resolve) => {
            let progress = 0;
            const interval = setInterval(() => {
                progress += 10;
                if (options.onProgress) {
                    options.onProgress({ progress });
                }
                
                if (progress >= 100) {
                    clearInterval(interval);
                    resolve({ success: true, data: data });
                }
            }, 100);
        });
    }

    /**
     * 获取处理统计
     */
    getStats() {
        return {
            total: this.totalTasks,
            waiting: this.queue.length,
            processing: this.processing.length,
            completed: this.completed.length,
            failed: this.failed.length,
            isRunning: this.isRunning
        };
    }

    /**
     * 销毁组件
     */
    destroy() {
        this.stop();
        this.container.innerHTML = '';
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BatchProcessor;
} else {
    window.BatchProcessor = BatchProcessor;
}