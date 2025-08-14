/**
 * P_Excel桌面版 - 渲染进程主入口文件
 */

class P_ExcelRenderer {
    constructor() {
        this.files = [];
        this.currentData = null;
        this.isProcessing = false;
        
        this.initializeEventListeners();
        this.initializeUI();
    }

    /**
     * 初始化事件监听器
     */
    initializeEventListeners() {
        // 文件上传相关
        const uploadArea = document.getElementById('upload-area');
        const fileInput = document.getElementById('file-input');

        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
        uploadArea.addEventListener('dragleave', this.handleDragLeave.bind(this));
        uploadArea.addEventListener('drop', this.handleDrop.bind(this));
        fileInput.addEventListener('change', this.handleFileSelect.bind(this));

        // 快捷操作按钮
        document.getElementById('btn-filter-month')?.addEventListener('click', this.filterCurrentMonth.bind(this));
        document.getElementById('btn-extract-quality')?.addEventListener('click', this.extractQualityResources.bind(this));
        document.getElementById('btn-remove-duplicates')?.addEventListener('click', this.removeDuplicates.bind(this));
        document.getElementById('btn-sort-by-date')?.addEventListener('click', this.sortByDate.bind(this));
        document.getElementById('btn-generate-summary')?.addEventListener('click', this.generateSummary.bind(this));

        // 导出按钮
        document.getElementById('btn-export-excel')?.addEventListener('click', this.exportExcel.bind(this));
        document.getElementById('btn-export-csv')?.addEventListener('click', this.exportCSV.bind(this));

        // 菜单事件
        window.addEventListener('menu-open-file', this.openFileDialog.bind(this));
        window.addEventListener('menu-save', this.saveFile.bind(this));
        window.addEventListener('menu-about', this.showAbout.bind(this));

        // Electron API事件监听
        if (window.electronAPI) {
            window.electronAPI.onProgressUpdate(this.updateProgress.bind(this));
            window.electronAPI.onFileProcessed(this.handleFileProcessed.bind(this));
            window.electronAPI.onError(this.handleError.bind(this));
        }
    }

    /**
     * 初始化UI
     */
    async initializeUI() {
        try {
            // 更新版本信息
            if (window.electronAPI) {
                const appInfo = await window.electronAPI.getAppInfo();
                document.querySelector('.badge-primary').textContent = `v${appInfo.version}`;
            }

            // 更新状态
            this.updateStatus('就绪');
            this.updateMemoryUsage();
            
            console.log('P_Excel桌面版UI初始化完成');
        } catch (error) {
            console.error('UI初始化失败:', error);
        }
    }

    /**
     * 处理拖拽悬停
     */
    handleDragOver(event) {
        event.preventDefault();
        event.currentTarget.classList.add('drag-over');
    }

    /**
     * 处理拖拽离开
     */
    handleDragLeave(event) {
        event.currentTarget.classList.remove('drag-over');
    }

    /**
     * 处理文件拖拽
     */
    handleDrop(event) {
        event.preventDefault();
        event.currentTarget.classList.remove('drag-over');
        
        const files = Array.from(event.dataTransfer.files);
        this.processFiles(files);
    }

    /**
     * 处理文件选择
     */
    handleFileSelect(event) {
        const files = Array.from(event.target.files);
        this.processFiles(files);
    }

    /**
     * 处理文件
     */
    async processFiles(files) {
        if (this.isProcessing) {
            this.showNotification('正在处理文件，请稍候...', 'warning');
            return;
        }

        try {
            this.isProcessing = true;
            this.showLoadingOverlay(true);
            this.updateStatus('正在处理文件...');

            for (const file of files) {
                if (this.isValidFile(file)) {
                    await this.addFile(file);
                } else {
                    this.showNotification(`不支持的文件格式: ${file.name}`, 'error');
                }
            }

            this.updateFileList();
            this.showQuickActions();
            
        } catch (error) {
            console.error('文件处理失败:', error);
            this.handleError(error);
        } finally {
            this.isProcessing = false;
            this.showLoadingOverlay(false);
            this.updateStatus('就绪');
        }
    }

    /**
     * 验证文件格式
     */
    isValidFile(file) {
        const validExtensions = ['.xlsx', '.xls', '.csv'];
        const fileName = file.name.toLowerCase();
        return validExtensions.some(ext => fileName.endsWith(ext));
    }

    /**
     * 添加文件
     */
    async addFile(file) {
        const fileInfo = {
            id: Date.now() + Math.random(),
            name: file.name,
            size: file.size,
            type: this.getFileType(file.name),
            file: file,
            processed: false,
            data: null
        };

        this.files.push(fileInfo);
        
        // 如果是第一个文件，自动预览
        if (this.files.length === 1) {
            await this.previewFile(fileInfo);
        }
    }

    /**
     * 获取文件类型
     */
    getFileType(fileName) {
        const ext = fileName.toLowerCase().split('.').pop();
        return ext === 'csv' ? 'csv' : 'excel';
    }

    /**
     * 更新文件列表显示
     */
    updateFileList() {
        const fileList = document.getElementById('file-list');
        const container = document.getElementById('files-container');
        
        if (this.files.length === 0) {
            fileList.classList.add('hidden');
            return;
        }

        fileList.classList.remove('hidden');
        container.innerHTML = '';

        this.files.forEach(file => {
            const fileItem = this.createFileItem(file);
            container.appendChild(fileItem);
        });

        this.updateFileCount();
    }

    /**
     * 创建文件项元素
     */
    createFileItem(file) {
        const div = document.createElement('div');
        div.className = 'file-item fade-in';
        div.innerHTML = `
            <div class="file-info">
                <div class="file-icon ${file.type}">
                    ${file.type === 'excel' ? 'XLS' : 'CSV'}
                </div>
                <div class="file-details">
                    <h4>${file.name}</h4>
                    <p>${this.formatFileSize(file.size)} • ${file.processed ? '已处理' : '待处理'}</p>
                </div>
            </div>
            <div class="file-actions">
                <button class="btn btn-sm btn-primary" onclick="app.previewFile('${file.id}')">预览</button>
                <button class="btn btn-sm btn-error" onclick="app.removeFile('${file.id}')">删除</button>
            </div>
        `;
        return div;
    }

    /**
     * 格式化文件大小
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 预览文件
     */
    async previewFile(fileId) {
        const file = this.files.find(f => f.id == fileId);
        if (!file) return;

        try {
            this.showLoadingOverlay(true);
            this.updateStatus('正在加载文件预览...');

            // 这里应该调用主进程的文件解析功能
            // 暂时使用模拟数据
            const previewData = await this.mockFilePreview(file);
            
            this.currentData = previewData;
            this.showDataPreview(previewData);
            
        } catch (error) {
            console.error('文件预览失败:', error);
            this.handleError(error);
        } finally {
            this.showLoadingOverlay(false);
            this.updateStatus('就绪');
        }
    }

    /**
     * 模拟文件预览（实际应该调用主进程API）
     */
    async mockFilePreview(file) {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve({
                    fileName: file.name,
                    totalRows: 1000,
                    totalColumns: 10,
                    headers: ['ID', '姓名', '邮箱', '电话', '部门', '职位', '入职日期', '薪资', '状态', '备注'],
                    data: Array.from({ length: 20 }, (_, i) => [
                        i + 1,
                        `用户${i + 1}`,
                        `user${i + 1}@example.com`,
                        `138${String(i).padStart(8, '0')}`,
                        ['技术部', '市场部', '人事部', '财务部'][i % 4],
                        ['工程师', '经理', '专员', '主管'][i % 4],
                        `2023-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
                        (8000 + i * 500).toLocaleString(),
                        ['在职', '离职'][i % 10 === 0 ? 1 : 0],
                        `备注信息${i + 1}`
                    ])
                });
            }, 1000);
        });
    }

    /**
     * 显示数据预览
     */
    showDataPreview(data) {
        const preview = document.getElementById('data-preview');
        const container = document.getElementById('preview-container');
        
        preview.classList.remove('hidden');
        
        const table = document.createElement('table');
        table.className = 'data-table';
        
        // 创建表头
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        data.headers.forEach(header => {
            const th = document.createElement('th');
            th.textContent = header;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // 创建表体
        const tbody = document.createElement('tbody');
        data.data.forEach(row => {
            const tr = document.createElement('tr');
            row.forEach(cell => {
                const td = document.createElement('td');
                td.textContent = cell;
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        
        container.innerHTML = `
            <div class="mb-4">
                <p class="text-sm text-base-content opacity-70">
                    文件: ${data.fileName} | 总行数: ${data.totalRows.toLocaleString()} | 总列数: ${data.totalColumns} | 显示前20行
                </p>
            </div>
        `;
        container.appendChild(table);
    }

    /**
     * 显示快捷操作
     */
    showQuickActions() {
        document.getElementById('quick-actions').classList.remove('hidden');
    }

    /**
     * 筛选本月数据
     */
    async filterCurrentMonth() {
        if (!this.currentData) {
            this.showNotification('请先选择要处理的文件', 'warning');
            return;
        }

        try {
            this.showProgressSection();
            this.updateProgress({ progress: 0, message: '开始筛选本月数据...' });
            
            // 模拟处理过程
            await this.simulateProgress('筛选本月数据');
            
            this.showNotification('本月数据筛选完成', 'success');
            this.showExportSection();
            
        } catch (error) {
            this.handleError(error);
        }
    }

    /**
     * 提取优质资源位
     */
    async extractQualityResources() {
        if (!this.currentData) {
            this.showNotification('请先选择要处理的文件', 'warning');
            return;
        }

        try {
            this.showProgressSection();
            this.updateProgress({ progress: 0, message: '开始提取优质资源位...' });
            
            await this.simulateProgress('提取优质资源位');
            
            this.showNotification('优质资源位提取完成', 'success');
            this.showExportSection();
            
        } catch (error) {
            this.handleError(error);
        }
    }

    /**
     * 删除重复数据
     */
    async removeDuplicates() {
        if (!this.currentData) {
            this.showNotification('请先选择要处理的文件', 'warning');
            return;
        }

        try {
            this.showProgressSection();
            this.updateProgress({ progress: 0, message: '开始删除重复数据...' });
            
            await this.simulateProgress('删除重复数据');
            
            this.showNotification('重复数据删除完成', 'success');
            this.showExportSection();
            
        } catch (error) {
            this.handleError(error);
        }
    }

    /**
     * 按时间排序
     */
    async sortByDate() {
        if (!this.currentData) {
            this.showNotification('请先选择要处理的文件', 'warning');
            return;
        }

        try {
            this.showProgressSection();
            this.updateProgress({ progress: 0, message: '开始按时间排序...' });
            
            await this.simulateProgress('按时间排序');
            
            this.showNotification('时间排序完成', 'success');
            this.showExportSection();
            
        } catch (error) {
            this.handleError(error);
        }
    }

    /**
     * 生成数据摘要
     */
    async generateSummary() {
        if (!this.currentData) {
            this.showNotification('请先选择要处理的文件', 'warning');
            return;
        }

        try {
            this.showProgressSection();
            this.updateProgress({ progress: 0, message: '开始生成数据摘要...' });
            
            await this.simulateProgress('生成数据摘要');
            
            this.showNotification('数据摘要生成完成', 'success');
            this.showExportSection();
            
        } catch (error) {
            this.handleError(error);
        }
    }

    /**
     * 模拟处理进度
     */
    async simulateProgress(operation) {
        const steps = [
            { progress: 20, message: `正在分析数据结构...` },
            { progress: 40, message: `正在执行${operation}...` },
            { progress: 60, message: `正在优化结果...` },
            { progress: 80, message: `正在准备输出...` },
            { progress: 100, message: `${operation}完成` }
        ];

        for (const step of steps) {
            await new Promise(resolve => setTimeout(resolve, 500));
            this.updateProgress(step);
        }
    }

    /**
     * 显示进度区域
     */
    showProgressSection() {
        document.getElementById('progress-section').classList.remove('hidden');
    }

    /**
     * 更新进度
     */
    updateProgress(data) {
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');
        const progressDetails = document.getElementById('progress-details');

        if (progressBar) progressBar.value = data.progress;
        if (progressText) progressText.textContent = `${data.progress}%`;
        if (progressDetails) progressDetails.textContent = data.message;
    }

    /**
     * 显示导出区域
     */
    showExportSection() {
        document.getElementById('export-section').classList.remove('hidden');
    }

    /**
     * 导出Excel
     */
    async exportExcel() {
        try {
            this.updateStatus('正在导出Excel文件...');
            
            if (window.electronAPI) {
                await window.electronAPI.saveFile(this.currentData, { format: 'excel' });
            }
            
            this.showNotification('Excel文件导出成功', 'success');
            
        } catch (error) {
            this.handleError(error);
        } finally {
            this.updateStatus('就绪');
        }
    }

    /**
     * 导出CSV
     */
    async exportCSV() {
        try {
            this.updateStatus('正在导出CSV文件...');
            
            if (window.electronAPI) {
                await window.electronAPI.saveFile(this.currentData, { format: 'csv' });
            }
            
            this.showNotification('CSV文件导出成功', 'success');
            
        } catch (error) {
            this.handleError(error);
        } finally {
            this.updateStatus('就绪');
        }
    }

    /**
     * 删除文件
     */
    removeFile(fileId) {
        this.files = this.files.filter(f => f.id != fileId);
        this.updateFileList();
        
        if (this.files.length === 0) {
            this.hideAllSections();
        }
    }

    /**
     * 隐藏所有区域
     */
    hideAllSections() {
        document.getElementById('data-preview').classList.add('hidden');
        document.getElementById('quick-actions').classList.add('hidden');
        document.getElementById('progress-section').classList.add('hidden');
        document.getElementById('export-section').classList.add('hidden');
    }

    /**
     * 打开文件对话框
     */
    async openFileDialog() {
        if (window.electronAPI) {
            try {
                const files = await window.electronAPI.openFile();
                if (files && files.length > 0) {
                    this.processFiles(files);
                }
            } catch (error) {
                this.handleError(error);
            }
        }
    }

    /**
     * 保存文件
     */
    async saveFile() {
        if (!this.currentData) {
            this.showNotification('没有可保存的数据', 'warning');
            return;
        }

        await this.exportExcel();
    }

    /**
     * 显示关于对话框
     */
    async showAbout() {
        if (window.electronAPI) {
            const appInfo = await window.electronAPI.getAppInfo();
            alert(`P_Excel桌面版\n版本: ${appInfo.version}\n描述: ${appInfo.description}`);
        }
    }

    /**
     * 更新状态
     */
    updateStatus(status) {
        const statusText = document.getElementById('status-text');
        if (statusText) {
            statusText.textContent = status;
        }
    }

    /**
     * 更新内存使用
     */
    async updateMemoryUsage() {
        if (window.electronAPI) {
            try {
                const memInfo = await window.electronAPI.getMemoryUsage();
                const memoryUsage = document.getElementById('memory-usage');
                if (memoryUsage && memInfo) {
                    memoryUsage.textContent = `内存使用: ${Math.round(memInfo.used / 1024 / 1024)} MB`;
                }
            } catch (error) {
                console.error('获取内存使用信息失败:', error);
            }
        }
    }

    /**
     * 更新文件计数
     */
    updateFileCount() {
        const fileCount = document.getElementById('file-count');
        if (fileCount) {
            fileCount.textContent = `文件: ${this.files.length}`;
        }
    }

    /**
     * 显示/隐藏加载遮罩
     */
    showLoadingOverlay(show) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.toggle('hidden', !show);
        }
    }

    /**
     * 显示通知
     */
    showNotification(message, type = 'info') {
        // 简单的通知实现，实际项目中可以使用更好的通知库
        const alertClass = {
            'success': 'alert-success',
            'error': 'alert-error',
            'warning': 'alert-warning',
            'info': 'alert-info'
        }[type] || 'alert-info';

        const notification = document.createElement('div');
        notification.className = `alert ${alertClass} fixed top-4 right-4 w-auto max-w-md z-50`;
        notification.innerHTML = `
            <span>${message}</span>
            <button class="btn btn-sm btn-ghost" onclick="this.parentElement.remove()">×</button>
        `;

        document.body.appendChild(notification);

        // 3秒后自动移除
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 3000);
    }

    /**
     * 处理错误
     */
    handleError(error) {
        console.error('发生错误:', error);
        this.showNotification(error.message || '发生未知错误', 'error');
        this.updateStatus('错误');
    }

    /**
     * 处理文件处理完成
     */
    handleFileProcessed(data) {
        console.log('文件处理完成:', data);
        this.showNotification('文件处理完成', 'success');
    }
}

// 创建应用实例
const app = new P_ExcelRenderer();

// 定期更新内存使用情况
setInterval(() => {
    app.updateMemoryUsage();
}, 5000);

console.log('P_Excel桌面版渲染进程已启动');