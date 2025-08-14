/**
 * 进度监控组件 - 显示处理进度和资源使用情况
 */

class ProgressMonitor {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            showMemoryUsage: options.showMemoryUsage !== false,
            showCPUUsage: options.showCPUUsage !== false,
            showProgress: options.showProgress !== false,
            updateInterval: options.updateInterval || 1000,
            ...options
        };
        
        this.isMonitoring = false;
        this.currentProgress = 0;
        this.currentStage = '';
        this.memoryUsage = 0;
        this.cpuUsage = 0;
        this.updateTimer = null;
        
        this.init();
    }

    /**
     * 初始化监控组件
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
            <div class="progress-monitor">
                <div class="progress-section" ${this.options.showProgress ? '' : 'style="display: none;"'}>
                    <div class="progress-header">
                        <h3 class="progress-title">处理进度</h3>
                        <span class="progress-percentage">0%</span>
                    </div>
                    <div class="progress-bar-container">
                        <div class="progress-bar">
                            <div class="progress-fill"></div>
                        </div>
                    </div>
                    <div class="progress-details">
                        <span class="progress-stage">准备中...</span>
                        <span class="progress-eta">预计时间: --</span>
                    </div>
                </div>
                
                <div class="resource-section">
                    <div class="resource-item memory-usage" ${this.options.showMemoryUsage ? '' : 'style="display: none;"'}>
                        <div class="resource-header">
                            <span class="resource-label">内存使用</span>
                            <span class="resource-value">0 MB</span>
                        </div>
                        <div class="resource-bar">
                            <div class="resource-fill memory-fill"></div>
                        </div>
                    </div>
                    
                    <div class="resource-item cpu-usage" ${this.options.showCPUUsage ? '' : 'style="display: none;"'}>
                        <div class="resource-header">
                            <span class="resource-label">CPU使用</span>
                            <span class="resource-value">0%</span>
                        </div>
                        <div class="resource-bar">
                            <div class="resource-fill cpu-fill"></div>
                        </div>
                    </div>
                </div>
                
                <div class="monitor-controls">
                    <button class="btn btn-sm btn-primary start-monitor">开始监控</button>
                    <button class="btn btn-sm btn-secondary stop-monitor" disabled>停止监控</button>
                    <button class="btn btn-sm btn-ghost clear-monitor">清除</button>
                </div>
            </div>
        `;

        // 获取DOM元素引用
        this.elements = {
            progressPercentage: this.container.querySelector('.progress-percentage'),
            progressFill: this.container.querySelector('.progress-fill'),
            progressStage: this.container.querySelector('.progress-stage'),
            progressEta: this.container.querySelector('.progress-eta'),
            memoryValue: this.container.querySelector('.memory-usage .resource-value'),
            memoryFill: this.container.querySelector('.memory-fill'),
            cpuValue: this.container.querySelector('.cpu-usage .resource-value'),
            cpuFill: this.container.querySelector('.cpu-fill'),
            startButton: this.container.querySelector('.start-monitor'),
            stopButton: this.container.querySelector('.stop-monitor'),
            clearButton: this.container.querySelector('.clear-monitor')
        };
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        this.elements.startButton.addEventListener('click', () => {
            this.startMonitoring();
        });

        this.elements.stopButton.addEventListener('click', () => {
            this.stopMonitoring();
        });

        this.elements.clearButton.addEventListener('click', () => {
            this.clearProgress();
        });

        // 监听Electron API事件
        if (window.electronAPI) {
            window.electronAPI.onProgressUpdate((progress) => {
                this.updateProgress(progress);
            });
        }
    }

    /**
     * 开始监控
     */
    startMonitoring() {
        if (this.isMonitoring) return;

        this.isMonitoring = true;
        this.elements.startButton.disabled = true;
        this.elements.stopButton.disabled = false;

        // 开始定期更新资源使用情况
        this.updateTimer = setInterval(() => {
            this.updateResourceUsage();
        }, this.options.updateInterval);

        console.log('开始进度监控');
    }

    /**
     * 停止监控
     */
    stopMonitoring() {
        if (!this.isMonitoring) return;

        this.isMonitoring = false;
        this.elements.startButton.disabled = false;
        this.elements.stopButton.disabled = true;

        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }

        console.log('停止进度监控');
    }

    /**
     * 更新进度
     */
    updateProgress(progress) {
        const { progress: percent = 0, stage = '', message = '', eta = null } = progress;

        this.currentProgress = Math.max(0, Math.min(100, percent));
        this.currentStage = stage;

        // 更新进度条
        this.elements.progressPercentage.textContent = `${Math.round(this.currentProgress)}%`;
        this.elements.progressFill.style.width = `${this.currentProgress}%`;

        // 更新阶段信息
        if (stage) {
            this.elements.progressStage.textContent = stage;
        }
        if (message) {
            this.elements.progressStage.textContent = message;
        }

        // 更新预计时间
        if (eta) {
            this.elements.progressEta.textContent = `预计时间: ${this.formatTime(eta)}`;
        } else if (this.currentProgress > 0 && this.currentProgress < 100) {
            // 简单的ETA计算
            const elapsed = Date.now() - (this.startTime || Date.now());
            const estimated = (elapsed / this.currentProgress) * (100 - this.currentProgress);
            this.elements.progressEta.textContent = `预计时间: ${this.formatTime(estimated)}`;
        }

        // 设置进度条颜色
        this.updateProgressColor();

        // 如果进度完成，自动停止监控
        if (this.currentProgress >= 100) {
            setTimeout(() => {
                this.stopMonitoring();
            }, 2000);
        }
    }

    /**
     * 更新进度条颜色
     */
    updateProgressColor() {
        const fill = this.elements.progressFill;
        
        if (this.currentProgress < 30) {
            fill.className = 'progress-fill progress-danger';
        } else if (this.currentProgress < 70) {
            fill.className = 'progress-fill progress-warning';
        } else if (this.currentProgress < 100) {
            fill.className = 'progress-fill progress-info';
        } else {
            fill.className = 'progress-fill progress-success';
        }
    }

    /**
     * 更新资源使用情况
     */
    async updateResourceUsage() {
        if (!this.isMonitoring) return;

        try {
            if (window.electronAPI) {
                // 获取内存使用情况
                if (this.options.showMemoryUsage) {
                    const memoryInfo = await window.electronAPI.getMemoryUsage();
                    this.updateMemoryUsage(memoryInfo);
                }

                // 获取系统信息（包含CPU使用率）
                if (this.options.showCPUUsage) {
                    const systemInfo = await window.electronAPI.getSystemInfo();
                    this.updateCPUUsage(systemInfo);
                }
            }
        } catch (error) {
            console.error('更新资源使用情况失败:', error);
        }
    }

    /**
     * 更新内存使用情况
     */
    updateMemoryUsage(memoryInfo) {
        if (!memoryInfo) return;

        const usedMB = Math.round(memoryInfo.used / 1024 / 1024);
        const totalMB = Math.round(memoryInfo.systemTotal / 1024 / 1024);
        const usagePercent = (memoryInfo.used / memoryInfo.systemTotal) * 100;

        this.memoryUsage = usagePercent;
        this.elements.memoryValue.textContent = `${usedMB} MB / ${totalMB} MB`;
        this.elements.memoryFill.style.width = `${Math.min(100, usagePercent)}%`;

        // 设置内存使用率颜色
        if (usagePercent > 90) {
            this.elements.memoryFill.className = 'resource-fill memory-fill fill-danger';
        } else if (usagePercent > 70) {
            this.elements.memoryFill.className = 'resource-fill memory-fill fill-warning';
        } else {
            this.elements.memoryFill.className = 'resource-fill memory-fill fill-success';
        }
    }

    /**
     * 更新CPU使用情况
     */
    updateCPUUsage(systemInfo) {
        if (!systemInfo || !systemInfo.loadavg) return;

        // 简单的CPU使用率计算（基于负载平均值）
        const cpuCount = systemInfo.cpus || 1;
        const loadAvg = systemInfo.loadavg[0] || 0;
        const cpuPercent = Math.min(100, (loadAvg / cpuCount) * 100);

        this.cpuUsage = cpuPercent;
        this.elements.cpuValue.textContent = `${Math.round(cpuPercent)}%`;
        this.elements.cpuFill.style.width = `${cpuPercent}%`;

        // 设置CPU使用率颜色
        if (cpuPercent > 90) {
            this.elements.cpuFill.className = 'resource-fill cpu-fill fill-danger';
        } else if (cpuPercent > 70) {
            this.elements.cpuFill.className = 'resource-fill cpu-fill fill-warning';
        } else {
            this.elements.cpuFill.className = 'resource-fill cpu-fill fill-success';
        }
    }

    /**
     * 清除进度
     */
    clearProgress() {
        this.currentProgress = 0;
        this.currentStage = '';
        this.startTime = null;

        this.elements.progressPercentage.textContent = '0%';
        this.elements.progressFill.style.width = '0%';
        this.elements.progressStage.textContent = '准备中...';
        this.elements.progressEta.textContent = '预计时间: --';
        
        this.updateProgressColor();
    }

    /**
     * 设置进度
     */
    setProgress(percent, stage = '', message = '') {
        if (!this.startTime && percent > 0) {
            this.startTime = Date.now();
        }

        this.updateProgress({
            progress: percent,
            stage: stage || this.currentStage,
            message: message
        });
    }

    /**
     * 格式化时间
     */
    formatTime(milliseconds) {
        if (!milliseconds || milliseconds <= 0) return '--';

        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}小时${minutes % 60}分钟`;
        } else if (minutes > 0) {
            return `${minutes}分钟${seconds % 60}秒`;
        } else {
            return `${seconds}秒`;
        }
    }

    /**
     * 获取当前状态
     */
    getStatus() {
        return {
            isMonitoring: this.isMonitoring,
            progress: this.currentProgress,
            stage: this.currentStage,
            memoryUsage: this.memoryUsage,
            cpuUsage: this.cpuUsage
        };
    }

    /**
     * 销毁组件
     */
    destroy() {
        this.stopMonitoring();
        this.container.innerHTML = '';
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProgressMonitor;
} else {
    window.ProgressMonitor = ProgressMonitor;
}