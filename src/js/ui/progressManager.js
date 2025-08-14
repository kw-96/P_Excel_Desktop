/**
 * 进度管理器
 * 管理数据处理过程的进度显示
 */

class ProgressManager {
    constructor() {
        this.modal = null;
        this.isActive = false;
        this.currentStep = 0;
        this.totalSteps = 4;
        this.steps = [
            { name: '文件解析', detail: '正在解析上传的文件...' },
            { name: '数据预处理', detail: '正在清理和整理数据...' },
            { name: '应用规则', detail: '正在应用筛选和排序规则...' },
            { name: '生成结果', detail: '正在生成最终结果...' }
        ];
        this.cancelled = false;
        
        this.init();
    }

    /**
     * 初始化进度管理器
     */
    init() {
        this.modal = document.getElementById('progress-modal');
        this.bindEvents();
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 取消按钮事件
        document.getElementById('cancel-processing')?.addEventListener('click', () => {
            this.cancel();
        });
    }

    /**
     * 开始进度显示
     * @param {string} title - 进度标题
     */
    start(title = '数据处理中') {
        this.isActive = true;
        this.cancelled = false;
        this.currentStep = 0;
        
        // 重置所有步骤状态
        this.resetSteps();
        
        // 更新标题
        const titleElement = this.modal?.querySelector('h3');
        if (titleElement) {
            titleElement.textContent = title;
        }
        
        // 显示模态框
        this.show();
        
        // 开始第一步
        this.nextStep();
    }

    /**
     * 显示模态框
     */
    show() {
        if (this.modal) {
            this.modal.classList.add('modal-open');
        }
    }

    /**
     * 隐藏模态框
     */
    hide() {
        if (this.modal) {
            this.modal.classList.remove('modal-open');
        }
        this.isActive = false;
    }

    /**
     * 重置所有步骤状态
     */
    resetSteps() {
        for (let i = 1; i <= this.totalSteps; i++) {
            const icon = document.getElementById(`step${i}-icon`);
            const status = document.getElementById(`step${i}-status`);
            
            if (icon) {
                icon.className = 'w-4 h-4 rounded-full bg-base-300';
            }
            if (status) {
                status.textContent = '等待中';
                status.className = 'text-xs text-base-content/50 ml-auto';
            }
        }
        
        // 重置总体进度
        this.updateOverallProgress(0);
        this.updateCurrentStep('准备开始...', '正在初始化数据处理流程');
    }

    /**
     * 下一步
     * @param {string} customDetail - 自定义详细信息
     */
    nextStep(customDetail = '') {
        if (this.cancelled || !this.isActive) return;
        
        this.currentStep++;
        
        if (this.currentStep > this.totalSteps) {
            this.complete();
            return;
        }
        
        const step = this.steps[this.currentStep - 1];
        const detail = customDetail || step.detail;
        
        // 更新当前步骤显示
        this.updateCurrentStep(step.name, detail);
        
        // 更新步骤状态
        this.updateStepStatus(this.currentStep, 'processing');
        
        // 更新总体进度
        const progress = (this.currentStep / this.totalSteps) * 100;
        this.updateOverallProgress(progress);
        
        // 如果有前一步，标记为完成
        if (this.currentStep > 1) {
            this.updateStepStatus(this.currentStep - 1, 'completed');
        }
    }

    /**
     * 更新当前步骤信息
     * @param {string} stepName - 步骤名称
     * @param {string} detail - 详细信息
     */
    updateCurrentStep(stepName, detail) {
        const stepElement = document.getElementById('current-step');
        const detailElement = document.getElementById('step-detail');
        
        if (stepElement) {
            stepElement.textContent = stepName;
        }
        if (detailElement) {
            detailElement.textContent = detail;
        }
    }

    /**
     * 更新总体进度
     * @param {number} progress - 进度百分比 (0-100)
     */
    updateOverallProgress(progress) {
        const progressBar = document.getElementById('overall-progress');
        const progressText = document.getElementById('overall-progress-text');
        
        if (progressBar) {
            progressBar.value = progress;
        }
        if (progressText) {
            progressText.textContent = `${Math.round(progress)}%`;
        }
    }

    /**
     * 更新步骤状态
     * @param {number} stepNumber - 步骤编号 (1-4)
     * @param {string} status - 状态 ('waiting'|'processing'|'completed'|'error')
     */
    updateStepStatus(stepNumber, status) {
        const icon = document.getElementById(`step${stepNumber}-icon`);
        const statusText = document.getElementById(`step${stepNumber}-status`);
        
        if (!icon || !statusText) return;
        
        switch (status) {
            case 'waiting':
                icon.className = 'w-4 h-4 rounded-full bg-base-300';
                statusText.textContent = '等待中';
                statusText.className = 'text-xs text-base-content/50 ml-auto';
                break;
            case 'processing':
                icon.className = 'w-4 h-4 rounded-full bg-primary animate-pulse';
                statusText.textContent = '处理中';
                statusText.className = 'text-xs text-primary ml-auto';
                break;
            case 'completed':
                icon.className = 'w-4 h-4 rounded-full bg-success flex items-center justify-center';
                icon.innerHTML = '<svg class="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>';
                statusText.textContent = '已完成';
                statusText.className = 'text-xs text-success ml-auto';
                break;
            case 'error':
                icon.className = 'w-4 h-4 rounded-full bg-error flex items-center justify-center';
                icon.innerHTML = '<svg class="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>';
                statusText.textContent = '出错';
                statusText.className = 'text-xs text-error ml-auto';
                break;
        }
    }

    /**
     * 设置特定步骤的详细信息
     * @param {number} stepNumber - 步骤编号
     * @param {string} detail - 详细信息
     */
    setStepDetail(stepNumber, detail) {
        if (stepNumber === this.currentStep) {
            this.updateCurrentStep(this.steps[stepNumber - 1].name, detail);
        }
    }

    /**
     * 更新步骤进度（在当前步骤内的进度）
     * @param {number} stepProgress - 步骤内进度 (0-100)
     */
    updateStepProgress(stepProgress) {
        if (this.currentStep === 0) return;
        
        const baseProgress = ((this.currentStep - 1) / this.totalSteps) * 100;
        const stepContribution = (1 / this.totalSteps) * 100;
        const totalProgress = baseProgress + (stepContribution * stepProgress / 100);
        
        this.updateOverallProgress(totalProgress);
    }

    /**
     * 完成处理
     * @param {string} message - 完成消息
     */
    complete(message = '数据处理完成') {
        if (this.cancelled) return;
        
        // 标记最后一步为完成
        if (this.currentStep <= this.totalSteps) {
            this.updateStepStatus(this.currentStep, 'completed');
        }
        
        // 更新显示
        this.updateCurrentStep('处理完成', message);
        this.updateOverallProgress(100);
        
        // 隐藏取消按钮
        const cancelBtn = document.getElementById('cancel-processing');
        if (cancelBtn) {
            cancelBtn.style.display = 'none';
        }
        
        // 延迟关闭模态框
        setTimeout(() => {
            this.hide();
            // 恢复取消按钮
            if (cancelBtn) {
                cancelBtn.style.display = 'block';
            }
        }, 1500);
    }

    /**
     * 处理出错
     * @param {string} error - 错误信息
     * @param {number} stepNumber - 出错的步骤编号
     */
    error(error, stepNumber = null) {
        const errorStep = stepNumber || this.currentStep;
        
        // 标记当前步骤为错误
        if (errorStep > 0 && errorStep <= this.totalSteps) {
            this.updateStepStatus(errorStep, 'error');
        }
        
        // 更新显示
        this.updateCurrentStep('处理失败', error);
        
        // 更改取消按钮为关闭按钮
        const cancelBtn = document.getElementById('cancel-processing');
        if (cancelBtn) {
            cancelBtn.textContent = '关闭';
            cancelBtn.onclick = () => this.hide();
        }
    }

    /**
     * 取消处理
     */
    cancel() {
        this.cancelled = true;
        this.isActive = false;
        
        // 更新显示
        this.updateCurrentStep('已取消', '用户取消了数据处理操作');
        
        // 标记当前步骤为等待状态
        if (this.currentStep > 0 && this.currentStep <= this.totalSteps) {
            this.updateStepStatus(this.currentStep, 'waiting');
        }
        
        this.hide();
    }

    /**
     * 检查是否已取消
     * @returns {boolean} 是否已取消
     */
    isCancelled() {
        return this.cancelled;
    }

    /**
     * 检查是否活跃
     * @returns {boolean} 是否活跃
     */
    isRunning() {
        return this.isActive && !this.cancelled;
    }

    /**
     * 获取当前步骤
     * @returns {number} 当前步骤编号
     */
    getCurrentStep() {
        return this.currentStep;
    }

    /**
     * 设置总步骤数（用于自定义流程）
     * @param {number} totalSteps - 总步骤数
     * @param {Array} stepDefinitions - 步骤定义数组
     */
    setCustomSteps(totalSteps, stepDefinitions) {
        this.totalSteps = totalSteps;
        this.steps = stepDefinitions;
        this.currentStep = 0;
    }

    /**
     * 添加日志信息
     * @param {string} message - 日志消息
     * @param {string} type - 消息类型 ('info'|'warning'|'error')
     */
    addLog(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
        
        // 如果是当前步骤的详细信息，更新显示
        if (type === 'info' && this.isActive) {
            const currentStepName = this.currentStep > 0 ? this.steps[this.currentStep - 1].name : '准备中';
            this.updateCurrentStep(currentStepName, message);
        }
    }

    /**
     * 模拟进度更新（用于测试）
     * @param {number} duration - 持续时间（毫秒）
     */
    simulateProgress(duration = 5000) {
        this.start('模拟数据处理');
        
        const stepDuration = duration / this.totalSteps;
        let currentStep = 0;
        
        const interval = setInterval(() => {
            if (this.cancelled || !this.isActive) {
                clearInterval(interval);
                return;
            }
            
            currentStep++;
            if (currentStep <= this.totalSteps) {
                this.nextStep();
                
                // 模拟步骤内进度
                let stepProgress = 0;
                const stepInterval = setInterval(() => {
                    stepProgress += 10;
                    this.updateStepProgress(stepProgress);
                    
                    if (stepProgress >= 100) {
                        clearInterval(stepInterval);
                    }
                }, stepDuration / 10);
            } else {
                clearInterval(interval);
                this.complete();
            }
        }, stepDuration);
    }
}

export default ProgressManager; 