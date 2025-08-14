/**
 * 增强数据预览组件
 * 提供分页显示、统计信息、数据对比等功能
 */

class DataPreview {
    constructor() {
        this.originalData = null;
        this.processedData = null;
        this.currentData = null;
        this.currentPage = 1;
        this.rowsPerPage = 100;
        this.totalPages = 1;
        this.availableFiles = [];
        this.currentFileIndex = 0;
        this.currentSheetIndex = 0;
        this.isCompareMode = false;
        
        this.init();
    }

    /**
     * 初始化数据预览组件
     */
    init() {
        this.bindEvents();
        this.initElements();
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 分页控制事件
        document.getElementById('prev-page')?.addEventListener('click', () => this.prevPage());
        document.getElementById('next-page')?.addEventListener('click', () => this.nextPage());
        document.getElementById('rows-per-page')?.addEventListener('change', (e) => this.changeRowsPerPage(e.target.value));
        
        // 文件和工作表选择事件
        document.getElementById('preview-file-select')?.addEventListener('change', (e) => this.changeFile(e.target.value));
        document.getElementById('preview-sheet-select')?.addEventListener('change', (e) => this.changeSheet(e.target.value));
        
        // 控制按钮事件
        document.getElementById('compare-data')?.addEventListener('click', () => this.toggleCompareMode());
        document.getElementById('refresh-preview')?.addEventListener('click', () => this.refreshPreview());
        
        // 导出按钮事件
        document.getElementById('export-excel')?.addEventListener('click', () => this.exportExcel());
        document.getElementById('export-csv')?.addEventListener('click', () => this.exportCSV());
    }

    /**
     * 初始化元素
     */
    initElements() {
        this.previewContainer = document.getElementById('data-preview');
        this.statsContainer = document.getElementById('data-stats');
        this.controlsContainer = document.getElementById('preview-controls');
        this.paginationContainer = document.getElementById('pagination-controls');
        this.exportActions = document.getElementById('export-actions');
    }

    /**
     * 设置原始数据
     * @param {Array} files - 文件数据数组
     */
    setOriginalData(files) {
        this.originalData = files;
        this.availableFiles = files;
        this.updateFileSelectors();
        this.showData(files);
        this.updateStats();
    }

    /**
     * 设置处理后数据
     * @param {Array} data - 处理后的数据
     */
    setProcessedData(data) {
        this.processedData = data;
        this.showData(data);
        this.updateStats();
        this.showControls();
    }

    /**
     * 更新文件选择器
     */
    updateFileSelectors() {
        const fileSelect = document.getElementById('preview-file-select');
        const sheetSelect = document.getElementById('preview-sheet-select');
        
        if (!fileSelect) return;
        
        // 清空现有选项
        fileSelect.innerHTML = '<option value="">选择文件</option>';
        
        this.availableFiles.forEach((file, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = file.fileName || `文件 ${index + 1}`;
            fileSelect.appendChild(option);
        });
        
        // 默认选择第一个文件
        if (this.availableFiles.length > 0) {
            fileSelect.value = 0;
            this.changeFile(0);
        }
    }

    /**
     * 更新工作表选择器
     * @param {Object} fileData - 文件数据
     */
    updateSheetSelectors(fileData) {
        const sheetSelect = document.getElementById('preview-sheet-select');
        if (!sheetSelect || !fileData.sheets) return;
        
        sheetSelect.innerHTML = '<option value="">选择工作表</option>';
        
        Object.keys(fileData.sheets).forEach((sheetName, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = sheetName;
            sheetSelect.appendChild(option);
        });
        
        // 默认选择第一个工作表
        if (Object.keys(fileData.sheets).length > 0) {
            sheetSelect.value = 0;
            this.changeSheet(0);
        }
    }

    /**
     * 切换文件
     * @param {number} fileIndex - 文件索引
     */
    changeFile(fileIndex) {
        if (fileIndex === '' || !this.availableFiles[fileIndex]) return;
        
        this.currentFileIndex = parseInt(fileIndex);
        const fileData = this.availableFiles[this.currentFileIndex];
        
        this.updateSheetSelectors(fileData);
        this.currentData = fileData.data || fileData;
        this.renderTable();
        this.updatePagination();
    }

    /**
     * 切换工作表
     * @param {number} sheetIndex - 工作表索引
     */
    changeSheet(sheetIndex) {
        if (sheetIndex === '') return;
        
        this.currentSheetIndex = parseInt(sheetIndex);
        const fileData = this.availableFiles[this.currentFileIndex];
        
        if (fileData.sheets) {
            const sheetNames = Object.keys(fileData.sheets);
            const sheetName = sheetNames[this.currentSheetIndex];
            this.currentData = fileData.sheets[sheetName];
        }
        
        this.renderTable();
        this.updatePagination();
    }

    /**
     * 显示数据
     * @param {Array|Object} data - 要显示的数据
     */
    showData(data) {
        if (Array.isArray(data)) {
            this.currentData = data;
        } else if (data && typeof data === 'object') {
            // 如果是单个文件对象
            this.currentData = data.data || data;
        }
        
        this.renderTable();
        this.updatePagination();
    }

    /**
     * 渲染表格
     */
    renderTable() {
        if (!this.currentData || this.currentData.length === 0) {
            this.showEmptyState();
            return;
        }
        
        // 分页处理
        const startIndex = (this.currentPage - 1) * this.rowsPerPage;
        const endIndex = startIndex + this.rowsPerPage;
        const pageData = this.currentData.slice(startIndex, endIndex);
        
        // 获取列名
        const columns = Object.keys(this.currentData[0] || {});
        
        // 生成表格HTML
        const tableHtml = this.generateTableHtml(columns, pageData);
        this.previewContainer.innerHTML = tableHtml;
        
        // 显示控制元素
        this.showControls();
    }

    /**
     * 生成表格HTML
     * @param {Array} columns - 列名数组
     * @param {Array} data - 数据数组
     * @returns {string} 表格HTML
     */
    generateTableHtml(columns, data) {
        let html = '<table class="table table-zebra table-compact w-full">';
        
        // 表头
        html += '<thead><tr>';
        html += '<th class="text-center w-12">#</th>'; // 行号列
        columns.forEach(column => {
            html += `<th class="min-w-[120px]">${this.escapeHtml(column)}</th>`;
        });
        html += '</tr></thead>';
        
        // 表体
        html += '<tbody>';
        const startRowNumber = (this.currentPage - 1) * this.rowsPerPage + 1;
        
        data.forEach((row, index) => {
            html += '<tr>';
            html += `<td class="text-center text-xs text-base-content/50">${startRowNumber + index}</td>`;
            columns.forEach(column => {
                const value = row[column];
                const displayValue = this.formatCellValue(value, column); // 传递列名
                html += `<td class="max-w-[200px] truncate" title="${this.escapeHtml(String(value))}">${displayValue}</td>`;
            });
            html += '</tr>';
        });
        
        html += '</tbody></table>';
        
        return html;
    }

    /**
     * 格式化单元格值
     * @param {any} value - 单元格值
     * @param {string} columnName - 列名（用于判断是否为日期列）
     * @returns {string} 格式化后的值
     */
    formatCellValue(value, columnName = '') {
        if (value === null || value === undefined) {
            return '<span class="text-base-content/30 italic">null</span>';
        }
        
        if (value === '') {
            return '<span class="text-base-content/30 italic">空</span>';
        }
        
        // 完全不进行格式化，直接显示原始字符串
        const stringValue = String(value);
        if (stringValue.length > 50) {
            return this.escapeHtml(stringValue.substring(0, 50)) + '...';
        }
        
        return this.escapeHtml(stringValue);
    }

    /**
     * 检查列名是否为日期列
     * @param {string} columnName - 列名
     * @returns {boolean} 是否为日期列
     */
    isDateColumn(columnName) {
        if (!columnName) return false;
        
        const lowerColumnName = columnName.toLowerCase();
        const dateKeywords = [
            '日期', '时间', '投放日期', '报告日期', '统计日期', '创建时间', '更新时间',
            'date', 'time', 'created', 'updated', 'report', 'stat'
        ];
        
        return dateKeywords.some(keyword => lowerColumnName.includes(keyword));
    }

    /**
     * 检查是否为真正的日期格式（严格检查）
     * @param {any} value - 值
     * @returns {boolean} 是否为真正的日期
     */
    isActualDate(value) {
        // 首先检查是否为Date对象
        if (value instanceof Date) {
            return !isNaN(value.getTime());
        }
        
        // 对于字符串，使用严格的日期格式检查
        if (typeof value === 'string') {
            const strictDatePatterns = [
                /^\d{4}-\d{1,2}-\d{1,2}$/,     // YYYY-MM-DD 或 YYYY-M-D
                /^\d{1,2}\/\d{1,2}\/\d{4}$/,   // MM/DD/YYYY 或 M/D/YYYY（完整年份）
                /^\d{4}\/\d{1,2}\/\d{1,2}$/,   // YYYY/MM/DD 或 YYYY/M/D
                /^\d{1,2}-\d{1,2}-\d{4}$/      // MM-DD-YYYY 或 M-D-YYYY（完整年份）
            ];
            
            // 必须匹配严格格式并且能被正确解析
            const matchesPattern = strictDatePatterns.some(pattern => pattern.test(value));
            if (!matchesPattern) return false;
            
            const parsedDate = new Date(value);
            return !isNaN(parsedDate.getTime());
        }
        
        return false;
    }

    /**
     * HTML转义
     * @param {string} text - 文本
     * @returns {string} 转义后的文本
     */
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    /**
     * 显示空状态
     */
    showEmptyState() {
        this.previewContainer.innerHTML = `
            <div class="flex items-center justify-center h-[300px] text-base-content/50">
                <div class="text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p class="text-lg">暂无数据</p>
                    <p class="text-sm">请先上传文件或应用处理规则</p>
                </div>
            </div>
        `;
        this.hideControls();
    }

    /**
     * 显示控制元素
     */
    showControls() {
        this.statsContainer?.classList.remove('hidden');
        this.controlsContainer?.classList.remove('hidden');
        this.paginationContainer?.classList.remove('hidden');
        this.exportActions?.classList.remove('hidden');
        
        // 显示对比按钮（仅当有处理后数据时）
        if (this.processedData && this.originalData) {
            document.getElementById('compare-data')?.classList.remove('hidden');
        }
        
        document.getElementById('refresh-preview')?.classList.remove('hidden');
    }

    /**
     * 隐藏控制元素
     */
    hideControls() {
        this.statsContainer?.classList.add('hidden');
        this.controlsContainer?.classList.add('hidden');
        this.paginationContainer?.classList.add('hidden');
        this.exportActions?.classList.add('hidden');
    }

    /**
     * 更新统计信息
     */
    updateStats() {
        if (!this.currentData) return;
        
        const totalRows = this.currentData.length;
        const totalColumns = totalRows > 0 ? Object.keys(this.currentData[0]).length : 0;
        const fileCount = this.availableFiles.length;
        
        // 更新显示
        document.getElementById('total-rows').textContent = totalRows.toLocaleString();
        document.getElementById('total-columns').textContent = totalColumns;
        document.getElementById('files-count').textContent = fileCount;
        
        // 如果有处理后数据，显示处理后行数
        if (this.processedData) {
            const processedRows = Array.isArray(this.processedData) ? 
                this.processedData.length : 
                (this.processedData.length || 0);
            document.getElementById('processed-rows').textContent = processedRows.toLocaleString();
        } else {
            document.getElementById('processed-rows').textContent = totalRows.toLocaleString();
        }
    }

    /**
     * 更新分页信息
     */
    updatePagination() {
        if (!this.currentData) return;
        
        this.totalPages = Math.ceil(this.currentData.length / this.rowsPerPage);
        
        // 更新分页显示
        document.getElementById('current-page').textContent = this.currentPage;
        document.getElementById('total-pages').textContent = this.totalPages;
        document.getElementById('page-info').textContent = this.currentPage;
        
        // 更新按钮状态
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        
        if (prevBtn) prevBtn.disabled = this.currentPage <= 1;
        if (nextBtn) nextBtn.disabled = this.currentPage >= this.totalPages;
    }

    /**
     * 上一页
     */
    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.renderTable();
            this.updatePagination();
        }
    }

    /**
     * 下一页
     */
    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            this.renderTable();
            this.updatePagination();
        }
    }

    /**
     * 改变每页显示行数
     * @param {number} newRowsPerPage - 新的每页行数
     */
    changeRowsPerPage(newRowsPerPage) {
        this.rowsPerPage = parseInt(newRowsPerPage);
        this.currentPage = 1; // 重置到第一页
        this.renderTable();
        this.updatePagination();
    }

    /**
     * 切换对比模式
     */
    toggleCompareMode() {
        if (!this.originalData || !this.processedData) return;
        
        this.isCompareMode = !this.isCompareMode;
        const compareBtn = document.getElementById('compare-data');
        
        if (this.isCompareMode) {
            compareBtn.textContent = '显示处理结果';
            compareBtn.classList.add('btn-active');
            this.showData(this.originalData);
        } else {
            compareBtn.textContent = '对比原始数据';
            compareBtn.classList.remove('btn-active');
            this.showData(this.processedData);
        }
    }

    /**
     * 刷新预览
     */
    refreshPreview() {
        const dataToShow = this.isCompareMode ? this.originalData : (this.processedData || this.originalData);
        this.showData(dataToShow);
        this.updateStats();
    }

    /**
     * 导出为Excel
     */
    async exportExcel() {
        if (!this.currentData || this.currentData.length === 0) {
            alert('没有数据可导出');
            return;
        }
        
        try {
            // 获取主应用实例
            const app = window.app;
            if (!app || !app.exporter) {
                throw new Error('导出器不可用');
            }
            
            // 生成文件名
            const fileName = this.generateFileName('excel');
            const sheetName = this.isCompareMode ? '原始数据' : '处理后数据';
            
            // 使用主应用的导出器
            const result = await app.exporter.exportToExcel(this.currentData, {
                filename: fileName,
                sheetName: sheetName
            });
            
            if (result.success) {
                alert('Excel文件导出成功');
            } else {
                if (
                    typeof result.message === 'string' &&
                    result.message.includes('user activation is required')
                ) {
                    return;
                }
                throw new Error(result.message || '导出失败');
            }
            
        } catch (error) {
            if (
                error &&
                typeof error.message === 'string' &&
                error.message.includes('user activation is required')
            ) {
                return;
            }
            alert(`Excel导出失败: ${error.message}`);
        }
    }

    /**
     * 导出为CSV
     */
    exportCSV() {
        if (!this.currentData || this.currentData.length === 0) {
            alert('没有数据可导出');
            return;
        }
        
        try {
            // 创建工作表
            const ws = XLSX.utils.json_to_sheet(this.currentData);
            
            // 转换为CSV
            const csvContent = XLSX.utils.sheet_to_csv(ws);
            
            // 创建下载链接
            const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            
            link.setAttribute('href', url);
            // 删除或注释所有 link.setAttribute('download', ...) 及相关自动下载逻辑
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            alert('CSV文件导出成功');
        } catch (error) {
            if (
                error &&
                typeof error.message === 'string' &&
                error.message.includes('user activation is required')
            ) {
                return;
            }
            alert('CSV导出失败');
        }
    }

    /**
     * 生成文件名
     * @param {string} type - 文件类型
     * @returns {string} 文件名
     */
    generateFileName(type) {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
        const prefix = this.isCompareMode ? 'original_data' : 'processed_data';
        const extension = type === 'excel' ? 'xlsx' : 'csv';
        
        return `${prefix}_${timestamp}.${extension}`;
    }

    /**
     * 获取当前显示的数据
     * @returns {Array} 当前数据
     */
    getCurrentData() {
        return this.currentData;
    }

    /**
     * 获取原始数据
     * @returns {Array} 原始数据
     */
    getOriginalData() {
        return this.originalData;
    }

    /**
     * 获取处理后数据
     * @returns {Array} 处理后数据
     */
    getProcessedData() {
        return this.processedData;
    }

    /**
     * 清空预览
     */
    clear() {
        this.originalData = null;
        this.processedData = null;
        this.currentData = null;
        this.availableFiles = [];
        this.currentPage = 1;
        this.isCompareMode = false;
        
        this.showEmptyState();
        this.updateStats();
    }

    /**
     * 获取列信息用于规则编辑器
     * @returns {Array} 列名数组
     */
    getAvailableColumns() {
        if (!this.currentData || this.currentData.length === 0) {
            return [];
        }
        
        return Object.keys(this.currentData[0]);
    }
}

export default DataPreview; 