/**
 * RuleXcel - 主应用入口文件
 * 负责初始化应用、绑定事件监听器、协调各个模块
 * @author RuleXcel
 * @version 2.0.0
 */

console.log('main.js 开始加载模块...');

import { FileParser } from './core/fileParser.js';
import { DataProcessor } from './core/dataProcessor.js';
import VisualRuleEngine from './core/ruleEngine.js';
import DataPreview from './ui/dataPreview.js';
import ProgressManager from './ui/progressManager.js';
import QuickActions from './ui/quickActions.js';
import Exporter from './core/exporter.js';
import validator from './utils/validator.js';
import formatter from './utils/formatter.js';
import logger from './utils/logger.js';
import RuleConfigModal from './ui/ruleConfigModal.js';
import ColumnMapper from './core/columnMapper.js';
import RuleProcessor from './core/ruleProcessor.js';



console.log('✅ main.js 模块导入语句执行完毕');

// Web Worker引用
let ruleWorker = null;
let columnWorker = null;
function getRuleWorker() {
  if (!ruleWorker) {
    ruleWorker = new Worker('./core/ruleWorker.js', { type: 'module' });
  }
  return ruleWorker;
}
function getColumnWorker() {
  if (!columnWorker) {
    columnWorker = new Worker('./core/columnWorker.js', { type: 'module' });
  }
  return columnWorker;
}

/**
 * 应用主类
 */
class RuleXcelApp {
    constructor() {
        this.uploadedFiles = []; // 存储上传的文件数据
        this.parsedData = []; // 存储解析后的数据
        this.processedData = null; // 存储处理后的数据
        this.isProcessing = false; // 处理状态标志
        this.currentData = null; // 新增：保存上一步规则处理结果
        this.dataHistory = []; // 新增：数据历史栈
        
        // 初始化组件
        this.initializeComponents();
        
        // 绑定事件
        this.bindEvents();
        
        // 初始化界面
        this.initializeInterface();
        
        console.log('RuleXcel应用初始化完成');
    }

    /**
     * 初始化组件
     */
    initializeComponents() {
        this.fileParser = new FileParser();
        this.dataProcessor = new DataProcessor();
        this.ruleEngine = new VisualRuleEngine();
        this.dataPreview = new DataPreview();
        this.progressManager = new ProgressManager();
        this.quickActions = QuickActions; // QuickActions导出的是实例，不是类
        this.exporter = Exporter; // Exporter导出的是实例，不是类
        
        // 初始化规则配置相关组件
        this.columnMapper = new ColumnMapper([]);
        this.ruleConfigModal = new RuleConfigModal(this.columnMapper);
        this.ruleProcessor = new RuleProcessor([], this.columnMapper);
        
        // 设置规则配置回调
        this.ruleConfigModal.setOnConfig((config) => {
            this.handleRuleConfig(config);
        });
        
        // 初始化日志记录
        logger.info('RuleXcel应用组件初始化完成');
        this.ruleWorker = getRuleWorker();
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 文件上传相关事件
        this.bindFileUploadEvents();
        
        // 快捷操作事件
        this.bindQuickActionEvents();
        
        // 规则应用事件
        this.bindRuleApplicationEvents();
        
        // 导出事件
        this.bindExportEvents();
        
        // 全局事件
        this.bindGlobalEvents();
    }

    /**
     * 绑定文件上传事件
     */
    bindFileUploadEvents() {
        const fileInput = document.getElementById('file-input');
        const uploadArea = document.getElementById('file-upload-area');
        const browseBtn = document.getElementById('browse-files');

        // 文件选择事件
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                this.handleFileSelect(e.target.files);
            });
        }

        // 浏览按钮点击事件
        if (browseBtn) {
            browseBtn.addEventListener('click', () => {
                if (fileInput) {
                    fileInput.click();
                }
            });
        }

        // 拖拽上传事件
        if (uploadArea) {
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('drag-over');
            });

            uploadArea.addEventListener('dragleave', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('drag-over');
            });

            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('drag-over');
                this.handleFileSelect(e.dataTransfer.files);
            });
        }
    }

    /**
     * 绑定快捷操作事件
     */
    bindQuickActionEvents() {
        // 筛选本月数据
        document.getElementById('quick-month-filter')?.addEventListener('click', () => {
            this.handleQuickMonthFilter();
        });

        // 提取优质资源位
        document.getElementById('quick-quality-extract')?.addEventListener('click', () => {
            this.handleQuickQualityExtract();
        });
    }

    /**
     * 绑定规则应用事件
     */
    bindRuleApplicationEvents() {
        // 应用规则按钮
        document.getElementById('apply-rules')?.addEventListener('click', () => {
            this.handleApplyRules();
        });

        // 4个核心规则按钮事件绑定
        document.getElementById('filterBtn')?.addEventListener('click', () => {
            this.handleFilterConfig();
        });

        document.getElementById('sortBtn')?.addEventListener('click', () => {
            this.handleSortConfig();
        });

        document.getElementById('processBtn')?.addEventListener('click', () => {
            this.handleProcessConfig();
        });

        document.getElementById('mergeBtn')?.addEventListener('click', () => {
            this.handleMergeConfig();
        });
    }

    /**
     * 绑定导出事件
     */
    bindExportEvents() {
        // 导出Excel按钮
        document.getElementById('export-excel')?.addEventListener('click', () => {
            this.handleExportExcel();
        });

        // 导出CSV按钮
        document.getElementById('export-csv')?.addEventListener('click', () => {
            this.handleExportCSV();
        });

        // 导出对比数据按钮
        document.getElementById('export-comparison')?.addEventListener('click', () => {
            this.handleExportComparison();
        });
    }

    /**
     * 绑定全局事件
     */
    bindGlobalEvents() {
        // 防止页面默认拖拽行为
        document.addEventListener('dragover', (e) => e.preventDefault());
        document.addEventListener('drop', (e) => e.preventDefault());

        // 全局错误处理
        window.onerror = function(message, source, lineno, colno, error) {
            if (
                (typeof message === 'string' && message.includes('user activation is required')) ||
                (error && error.message && error.message.includes('user activation is required'))
            ) {
                return true; // 阻止默认处理
            }
            console.error('全局错误:', error || message);
        };

        // 未处理的Promise错误
        window.onunhandledrejection = function(event) {
            if (
                event && event.reason && typeof event.reason.message === 'string' &&
                event.reason.message.includes('user activation is required')
            ) {
                return true;
            }
            console.error('未处理的Promise错误:', event.reason);
        };
    }

    /**
     * 初始化界面
     */
    initializeInterface() {
        // 更新统计信息
        this.updateStats();
    }

    /**
     * 处理文件选择
     * @param {FileList} files - 选择的文件
     */
    async handleFileSelect(files) {
        console.log('🚀 handleFileSelect 被调用:', files);
        console.log('文件详情:', {
            filesCount: files ? files.length : 0,
            fileList: files ? Array.from(files).map(f => ({ name: f.name, size: f.size, type: f.type })) : []
        });

        if (!files || files.length === 0) {
            console.log('⚠️ 没有选择文件，退出处理');
            return;
        }

        logger.userAction('用户选择文件', { count: files.length });

        // 验证文件
        const validFiles = this.validateFiles(files);
        if (validFiles.length === 0) {
            console.log('⚠️ 没有有效的文件可上传');
            return;
        }

        // 开始进度显示
        this.progressManager.start('文件解析中');

        try {
            // 解析文件
            this.progressManager.setStepDetail(1, `正在解析 ${validFiles.length} 个文件...`);
            
            const parsePromises = validFiles.map(async (file, index) => {
                const progressDetail = `正在解析文件 ${index + 1}/${validFiles.length}: ${file.name}`;
                this.progressManager.addLog(progressDetail);
                
                const data = await this.fileParser.parseFile(file);
                return {
                    fileName: file.name,
                    file: file,
                    data: data,
                    sheets: data.sheets || null
                };
            });

            const results = await Promise.all(parsePromises);
            
            // 存储解析结果
            this.parsedData = results;
            this.uploadedFiles = validFiles;

            // 更新UI
            this.updateFileList(results);
            this.updateStats();
            
            // 设置可用列名到规则引擎
            if (results.length > 0 && results[0].data) {
                const firstDataArray = Array.isArray(results[0].data) ? results[0].data : [results[0].data];
                if (firstDataArray.length > 0) {
                    const columns = Object.keys(firstDataArray[0]);
                    this.ruleEngine.setAvailableColumns(columns);
                }
            }

            // 显示数据预览
            this.dataPreview.setOriginalData(results);

            this.progressManager.complete('文件解析完成');
            console.log(`成功上传 ${results.length} 个文件`);

        } catch (error) {
            console.error('文件解析失败:', error);
            this.progressManager.error(`文件解析失败: ${error.message}`);
            console.error(`文件解析失败: ${error.message}`);
        }
    }

    /**
     * 验证文件
     * @param {FileList} files - 文件列表
     * @returns {Array} 有效文件数组
     */
    validateFiles(files) {
        const validation = validator.validateFiles(files);
        
        // 显示验证错误
        validation.invalidFiles.forEach(({ file, error }) => {
            console.error(`文件 "${file.name}": ${error}`);
            logger.error('文件验证失败', { filename: file.name, error });
        });

        if (validation.validFiles.length > 0) {
            logger.info('文件验证完成', { 
                total: files.length, 
                valid: validation.validFiles.length,
                invalid: validation.invalidFiles.length 
            });
        }

        return validation.validFiles;
    }

    /**
     * 更新文件列表显示
     * @param {Array} files - 文件数据数组
     */
    updateFileList(files) {
        const fileList = document.getElementById('file-list');
        const fileItems = document.getElementById('file-items');
        
        if (!fileList || !fileItems) return;

        fileList.classList.remove('hidden');
        fileItems.innerHTML = '';

        files.forEach((fileData, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'flex items-center justify-between p-2 bg-base-100 rounded';
            
            const dataLength = Array.isArray(fileData.data) ? fileData.data.length : 
                              (fileData.data && typeof fileData.data === 'object' ? 1 : 0);
            
            fileItem.innerHTML = `
                <div class="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span class="text-sm">${fileData.fileName}</span>
                    <span class="badge badge-sm">${dataLength} 行</span>
                </div>
                <button class="btn btn-xs btn-error btn-outline" onclick="app.removeFile(${index})">
                    删除
                </button>
            `;
            
            fileItems.appendChild(fileItem);
        });
    }

    /**
     * 移除文件
     * @param {number} index - 文件索引
     */
    removeFile(index) {
        if (index >= 0 && index < this.parsedData.length) {
            const fileName = this.parsedData[index].fileName;
            
            this.parsedData.splice(index, 1);
            this.uploadedFiles.splice(index, 1);
            
            this.updateFileList(this.parsedData);
            this.updateStats();
            
            if (this.parsedData.length === 0) {
                document.getElementById('file-list')?.classList.add('hidden');
                this.dataPreview.clear();
                this.processedData = null;
                this.currentData = null; // 重置 currentData
            } else {
                this.dataPreview.setOriginalData(this.parsedData);
                this.currentData = null; // 重置 currentData
            }
            
            console.log(`文件 ${fileName} 已删除`);
        }
    }

    /**
     * 处理快捷操作 - 筛选本月数据
     */
    async handleQuickMonthFilter() {
        if (this.parsedData.length === 0) {
            console.log('请先上传文件');
            return;
        }

        try {
            // 弹出月份选择器
            const selectedMonth = await this.showMonthSelector();
            if (!selectedMonth) {
                return; // 用户取消选择
            }

            const monthStr = `${selectedMonth.year}年${selectedMonth.month}月`;
            console.log(`正在处理${monthStr}数据...`);
            
            // 执行增强版月份数据筛选（传入所有文件数据和选择的月份）
            const result = await this.quickActions.executeAction('filterCurrentMonth', this.parsedData, selectedMonth);
            
            // 调试信息：记录筛选结果
            logger.info('月份筛选操作结果', {
                success: result.success,
                dataLength: result.data ? result.data.length : 0,
                headersLength: result.headers ? result.headers.length : 0,
                message: result.message,
                hasData: result.data && result.data.length > 0,
                hasHeaders: result.headers && result.headers.length > 0
            });
            
            if (result.success && result.data.length > 0) {
                this.processedData = result.data;
                this.dataPreview.setProcessedData(result.data);
                console.log(result.message);
                logger.userAction('筛选月份数据', result.stats);
                
                // 步骤7: 询问用户是否导出Excel文件
                setTimeout(async () => {
                    try {
                        const shouldExport = await this.showExportConfirmDialog(monthStr, result.data.length);
                        if (shouldExport) {
                            await this.exportFilteredMonthData(result.data, result.headers, monthStr);
                        }
                    } catch (exportError) {
                        logger.error('导出失败', exportError);
                        console.error(`导出失败: ${exportError.message}`);
                    }
                }, 500); // 短暂延迟以确保数据预览更新完成
                
            } else if (result.success && result.data.length === 0) {
                console.log(`没有找到符合条件的${monthStr}数据`);
            } else {
                console.error(result.message);
            }
        } catch (error) {
            logger.error('筛选月份数据失败', error);
            console.error(`操作失败: ${error.message}`);
        }
    }

    /**
     * 显示月份选择器
     * @param {string} title - 标题（可选）
     * @returns {Promise<Object|null>} 选择的月份信息或null（取消）
     */
    async showMonthSelector(title = '选择月份') {
        return new Promise((resolve) => {
            // 创建模态框
            const modal = document.createElement('div');
            modal.className = 'modal modal-open';
            modal.innerHTML = `
                <div class="modal-box">
                    <h3 class="font-bold text-lg mb-4">${title}</h3>
                    <div class="form-control w-full max-w-xs mx-auto">
                        <label class="label">
                            <span class="label-text">年份</span>
                        </label>
                        <select id="yearSelect" class="select select-bordered w-full">
                            <option value="2024">2024年</option>
                            <option value="2025" selected>2025年</option>
                            <option value="2026">2026年</option>
                        </select>
                    </div>
                    <div class="form-control w-full max-w-xs mx-auto mt-4">
                        <label class="label">
                            <span class="label-text">月份</span>
                        </label>
                        <select id="monthSelect" class="select select-bordered w-full">
                            <option value="1">1月</option>
                            <option value="2">2月</option>
                            <option value="3">3月</option>
                            <option value="4">4月</option>
                            <option value="5">5月</option>
                            <option value="6" selected>6月</option>
                            <option value="7">7月</option>
                            <option value="8">8月</option>
                            <option value="9">9月</option>
                            <option value="10">10月</option>
                            <option value="11">11月</option>
                            <option value="12">12月</option>
                        </select>
                    </div>
                    <div class="modal-action">
                        <button class="btn btn-primary" id="confirmBtn">确定</button>
                        <button class="btn" id="cancelBtn">取消</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // 绑定事件
            const confirmBtn = modal.querySelector('#confirmBtn');
            const cancelBtn = modal.querySelector('#cancelBtn');
            const yearSelect = modal.querySelector('#yearSelect');
            const monthSelect = modal.querySelector('#monthSelect');

            // ESC键取消事件处理器
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    cleanup();
                    resolve(null);
                }
            };

            // 统一清理函数，确保所有事件监听器都被移除
            const cleanup = () => {
                document.removeEventListener('keydown', handleEscape);
                if (document.body.contains(modal)) {
                    document.body.removeChild(modal);
                }
            };

            confirmBtn.addEventListener('click', () => {
                const year = parseInt(yearSelect.value);
                const month = parseInt(monthSelect.value);
                cleanup();
                resolve({ year, month });
            });

            cancelBtn.addEventListener('click', () => {
                cleanup();
                resolve(null);
            });

            // 添加ESC键监听器
            document.addEventListener('keydown', handleEscape);
        });
    }

    /**
     * 显示导出确认对话框
     * @param {string} monthStr - 月份描述
     * @param {number} dataLength - 数据长度
     * @returns {Promise<boolean>} 是否导出
     */
    async showExportConfirmDialog(monthStr, dataLength) {
        return new Promise((resolve) => {
            // 创建模态框
            const modal = document.createElement('div');
            modal.className = 'modal modal-open';
            modal.innerHTML = `
                <div class="modal-box max-w-md">
                    <h3 class="font-bold text-lg mb-4 flex items-center gap-2">
                        <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                  d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2-2z"></path>
                        </svg>
                        导出${monthStr}数据
                    </h3>
                    <div class="bg-base-200 p-4 rounded-lg mb-4">
                        <div class="stat">
                            <div class="stat-title">筛选结果</div>
                            <div class="stat-value text-primary">${dataLength}</div>
                            <div class="stat-desc">条记录</div>
                        </div>
                    </div>
                    <div class="text-sm text-gray-600 mb-4">
                        <p>💾 文件将保存到浏览器默认下载目录</p>
                        <p>📄 文件名：${monthStr}资源位数据.xlsx</p>
                        <p>⏰ 预计时间：几秒钟</p>
                    </div>
                    <div class="modal-action">
                        <button class="btn btn-primary gap-2" id="confirmBtn">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                            </svg>
                            立即导出
                        </button>
                        <button class="btn btn-ghost" id="cancelBtn">暂不导出</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // 绑定事件
            const confirmBtn = modal.querySelector('#confirmBtn');
            const cancelBtn = modal.querySelector('#cancelBtn');

            // ESC键取消事件处理器
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    cleanup();
                    resolve(false);
                }
            };

            // 统一清理函数，确保所有事件监听器都被移除
            const cleanup = () => {
                document.removeEventListener('keydown', handleEscape);
                if (document.body.contains(modal)) {
                    document.body.removeChild(modal);
                }
            };

            confirmBtn.addEventListener('click', () => {
                cleanup();
                resolve(true);
            });

            cancelBtn.addEventListener('click', () => {
                cleanup();
                resolve(false);
            });

            // 添加ESC键监听器
            document.addEventListener('keydown', handleEscape);
        });
    }

    /**
     * 显示优质资源位导出确认对话框
     * @param {string} monthStr - 月份描述
     * @param {number} dataLength - 数据长度
     * @param {Object} stats - 统计信息
     * @returns {Promise<boolean>} 是否导出
     */
    async showQualityExportConfirmDialog(monthStr, dataLength, stats) {
        return new Promise((resolve) => {
            // 创建模态框
            const modal = document.createElement('div');
            modal.className = 'modal modal-open';
            modal.innerHTML = `
                <div class="modal-box max-w-md">
                    <h3 class="font-bold text-lg mb-4 flex items-center gap-2">
                        <svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path>
                        </svg>
                        导出${monthStr}优质资源位
                    </h3>
                    <div class="bg-base-200 p-4 rounded-lg mb-4">
                        <div class="grid grid-cols-2 gap-4">
                            <div class="stat">
                                <div class="stat-title text-xs">提取结果</div>
                                <div class="stat-value text-lg text-yellow-600">${dataLength}</div>
                                <div class="stat-desc text-xs">优质资源位</div>
                            </div>
                            <div class="stat">
                                <div class="stat-title text-xs">原始数据</div>
                                <div class="stat-value text-lg text-gray-500">${stats.original || 0}</div>
                                <div class="stat-desc text-xs">总记录数</div>
                            </div>
                        </div>
                    </div>
                    <div class="text-sm text-gray-600 mb-4">
                        <p>📊 筛选条件：${stats.qualityCondition || 'F列 > G列'}且符合月份</p>
                        <p>💾 文件将保存到浏览器默认下载目录</p>
                        <p>📄 文件名：${monthStr}优质资源位.xlsx</p>
                        <p>⏰ 预计时间：几秒钟</p>
                    </div>
                    <div class="modal-action">
                        <button class="btn btn-primary gap-2" id="confirmBtn">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                            </svg>
                            立即导出
                        </button>
                        <button class="btn btn-ghost" id="cancelBtn">暂不导出</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // 绑定事件
            const confirmBtn = modal.querySelector('#confirmBtn');
            const cancelBtn = modal.querySelector('#cancelBtn');

            // ESC键取消事件处理器
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    cleanup();
                    resolve(false);
                }
            };

            // 统一清理函数，确保所有事件监听器都被移除
            const cleanup = () => {
                document.removeEventListener('keydown', handleEscape);
                if (document.body.contains(modal)) {
                    document.body.removeChild(modal);
                }
            };

            confirmBtn.addEventListener('click', () => {
                cleanup();
                resolve(true);
            });

            cancelBtn.addEventListener('click', () => {
                cleanup();
                resolve(false);
            });

            // 添加ESC键监听器
            document.addEventListener('keydown', handleEscape);
        });
    }

    /**
     * 导出优质资源位数据为Excel
     * @param {Array} data - 筛选后的数据
     * @param {Array} headers - 表头
     * @param {string} monthStr - 月份描述
     * @param {Object} stats - 统计信息
     */
    async exportQualityResourcesData(data, headers, monthStr = '本月', stats = {}) {
        try {
            logger.info('开始导出优质资源位数据', { 
                rows: data.length, 
                headers: headers ? headers.length : 0,
                monthStr: monthStr,
                stats: stats
            });
            
            // 数据验证和调试信息
            if (!data || data.length === 0) {
                throw new Error('没有可导出的优质资源位数据');
            }
            
            // 智能检测实际数据的列名（防止headers与实际数据不匹配）
            const actualHeaders = data.length > 0 ? Object.keys(data[0]) : [];
            const finalHeaders = headers && headers.length > 0 ? headers : actualHeaders;
            
            logger.info('优质资源位数据结构分析', {
                传入headers: headers,
                实际数据列名: actualHeaders,
                最终使用headers: finalHeaders,
                数据样本: data.length > 0 ? data[0] : null
            });
            
            // 准备导出数据 - 改进逻辑，确保数据完整性
            let exportData;
            
            if (finalHeaders.length > 0) {
                // 使用指定的列顺序重新组织数据
                exportData = data.map((row, index) => {
                    const orderedRow = {};
                    finalHeaders.forEach(header => {
                        let value = row[header];
                        
                        // 增强数据清理：处理可能导致问题的值
                        if (value === null || value === undefined) {
                            value = '';
                        } else if (typeof value === 'object' && value !== null) {
                            // 处理对象类型（包括Date对象）
                            if (value instanceof Date) {
                                value = value.toISOString().split('T')[0]; // 转换为YYYY-MM-DD格式
                            } else {
                                value = JSON.stringify(value);
                            }
                        } else if (typeof value === 'function') {
                            value = '[Function]';
                        } else if (typeof value === 'symbol') {
                            value = '[Symbol]';
                        } else {
                            // 确保是字符串
                            value = String(value);
                        }
                        
                        orderedRow[header] = value;
                    });
                    
                    return orderedRow;
                });
            } else {
                // 如果没有有效的headers，直接使用原始数据
                exportData = data;
                logger.warn('使用原始数据结构导出优质资源位（未找到有效的headers）');
            }
            
            // 最终验证导出数据
            if (!exportData || exportData.length === 0) {
                throw new Error('优质资源位导出数据处理后为空');
            }
            
            // 检查导出数据的完整性
            const hasValidData = exportData.some(row => {
                return Object.values(row).some(value => value !== '' && value !== null && value !== undefined);
            });
            
            if (!hasValidData) {
                logger.error('警告：优质资源位导出数据中所有值都为空', {
                    exportData: exportData.slice(0, 2), // 只记录前两行用于调试
                    headers: finalHeaders
                });
                throw new Error('优质资源位导出数据中所有值都为空，请检查数据结构是否正确');
            }
            
            // 使用导出器导出Excel
            const fileName = `${monthStr}优质资源位.xlsx`;
            const sheetName = `${monthStr}优质资源位`;
            
            let result;
            
            // 使用基础导出方法（支持路径选择）
            try {
                result = await this._exportWithBasicMethod(exportData, finalHeaders, fileName, sheetName);
            } catch (basicError) {
                logger.error('基础导出方法失败，尝试标准导出器', basicError);
                
                // 备用方案：使用标准导出器
                try {
                    result = await this.exporter.exportToExcel(exportData, {
                        filename: fileName,
                        sheetName: sheetName
                    });
                } catch (exportError) {
                    logger.error('所有导出方案都失败', exportError);
                    throw new Error(`导出失败: ${basicError.message} / ${exportError.message}`);
                }
            }
            
            if (result.success) {
                console.log(`${monthStr}优质资源位导出成功`);
                logger.userAction(`导出${monthStr}优质资源位`, {
                    fileName: fileName,
                    rows: exportData.length,
                    columns: finalHeaders.length,
                    actualColumns: actualHeaders.length,
                    qualityCondition: stats.qualityCondition,
                    originalRows: stats.original,
                    monthlyRows: stats.monthly,
                    qualityRows: stats.quality
                });
            } else {
                throw new Error(result.message || '优质资源位导出失败');
            }
            
        } catch (error) {
            logger.error('导出优质资源位数据失败', error);
            throw error;
        }
    }

    /**
     * 导出筛选后的月份数据为Excel
     * @param {Array} data - 筛选后的数据
     * @param {Array} headers - 表头
     * @param {string} monthStr - 月份描述
     */
    async exportFilteredMonthData(data, headers, monthStr = '本月') {
        try {
            logger.info('开始导出本月资源位数据', { 
                rows: data.length, 
                headers: headers ? headers.length : 0,
                monthStr: monthStr 
            });
            
            // 数据验证和调试信息
            if (!data || data.length === 0) {
                throw new Error('没有可导出的数据');
            }
            
            // 智能检测实际数据的列名（防止headers与实际数据不匹配）
            const actualHeaders = data.length > 0 ? Object.keys(data[0]) : [];
            const finalHeaders = headers && headers.length > 0 ? headers : actualHeaders;
            
            logger.info('数据结构分析', {
                传入headers: headers,
                实际数据列名: actualHeaders,
                最终使用headers: finalHeaders,
                数据样本: data.length > 0 ? data[0] : null
            });
            
            // 准备导出数据 - 改进逻辑，确保数据完整性
            let exportData;
            
            if (finalHeaders.length > 0) {
                // 使用指定的列顺序重新组织数据
                exportData = data.map((row, index) => {
                    const orderedRow = {};
                    finalHeaders.forEach(header => {
                        let value = row[header];
                        
                        // 增强数据清理：处理可能导致问题的值
                        if (value === null || value === undefined) {
                            value = '';
                        } else if (typeof value === 'object' && value !== null) {
                            // 处理对象类型（包括Date对象）
                            if (value instanceof Date) {
                                value = value.toISOString().split('T')[0]; // 转换为YYYY-MM-DD格式
                            } else {
                                value = JSON.stringify(value);
                            }
                        } else if (typeof value === 'function') {
                            value = '[Function]';
                        } else if (typeof value === 'symbol') {
                            value = '[Symbol]';
                        } else {
                            // 确保是字符串
                            value = String(value);
                        }
                        
                        orderedRow[header] = value;
                    });
                    
                
                    
                    return orderedRow;
                });
            } else {
                // 如果没有有效的headers，直接使用原始数据
                exportData = data;
                logger.warn('使用原始数据结构导出（未找到有效的headers）');
            }
            
            // 最终验证导出数据
            if (!exportData || exportData.length === 0) {
                throw new Error('导出数据处理后为空');
            }
            
            // 检查导出数据的完整性
            const hasValidData = exportData.some(row => {
                return Object.values(row).some(value => value !== '' && value !== null && value !== undefined);
            });
            
            if (!hasValidData) {
                logger.error('警告：导出数据中所有值都为空', {
                    exportData: exportData.slice(0, 2), // 只记录前两行用于调试
                    headers: finalHeaders
                });
                throw new Error('导出数据中所有值都为空，请检查数据结构是否正确');
            }
            
            // 使用导出器导出Excel
            const fileName = `${monthStr}资源位数据.xlsx`;
            const sheetName = `${monthStr}资源位数据`;
            

            
            let result;
            
            // 使用基础导出方法（支持路径选择）
            try {
                result = await this._exportWithBasicMethod(exportData, finalHeaders, fileName, sheetName);
            } catch (basicError) {
                logger.error('基础导出方法失败，尝试标准导出器', basicError);
                
                // 备用方案：使用标准导出器
                try {
                    result = await this.exporter.exportToExcel(exportData, {
                        filename: fileName,
                        sheetName: sheetName
                    });
                } catch (exportError) {
                    logger.error('所有导出方案都失败', exportError);
                    throw new Error(`导出失败: ${basicError.message} / ${exportError.message}`);
                }
            }
            
            if (result.success) {
                console.log(`${monthStr}资源位数据导出成功`);
                logger.userAction(`导出${monthStr}资源位数据`, {
                    fileName: fileName,
                    rows: exportData.length,
                    columns: finalHeaders.length,
                    actualColumns: actualHeaders.length
                });
            } else {
                throw new Error(result.message || '导出失败');
            }
            
        } catch (error) {
            logger.error('导出本月数据失败', error);
            throw error;
        }
    }

    /**
     * 基础导出方法（绕过复杂的数据预处理）
     * @param {Array} data - 原始数据
     * @param {Array} headers - 表头
     * @param {string} fileName - 文件名
     * @param {string} sheetName - 工作表名
     * @returns {Promise<Object>} 导出结果
     */
    async _exportWithBasicMethod(data, headers, fileName, sheetName) {
        try {
            logger.info('使用基础导出方法', { rows: data.length, headers: headers.length });
            
            // 直接使用XLSX库，不进行复杂的数据预处理
            const XLSX = window.XLSX;
            
            // 创建工作簿
            const wb = XLSX.utils.book_new();
            
            // 直接使用原始数据创建工作表
            const ws = XLSX.utils.json_to_sheet(data);
            
            // 添加工作表到工作簿
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
            
            // 生成Excel文件
            const wbout = XLSX.write(wb, { 
                bookType: 'xlsx', 
                type: 'array' 
            });
            
            // 创建Blob并下载
            const blob = new Blob([wbout], { 
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
            });
            
            // 优先使用文件系统API让用户选择保存路径
            if (window.showSaveFilePicker) {
                try {
                    const fileHandle = await window.showSaveFilePicker({
                        suggestedName: fileName,
                        types: [{
                            description: 'Excel文件 (*.xlsx)',
                            accept: {
                                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
                            }
                        }],
                        excludeAcceptAllOption: false
                    });
                    
                    const writable = await fileHandle.createWritable();
                    await writable.write(wbout);
                    await writable.close();
                    
                    const savedFileName = fileHandle.name;
                    
                } catch (error) {
                    if (error.name === 'AbortError') {
                        throw new Error('用户取消了保存操作');
                    } else {
                        logger.warn('文件系统访问API失败，回退到传统方法', error);
                        // 继续执行传统下载方法
                        // this._performTraditionalDownload(blob, fileName); // 删除或注释所有传统下载相关调用和实现
                    }
                }
            } else {
                // this._performTraditionalDownload(blob, fileName); // 删除或注释所有传统下载相关调用和实现
            }
            
            return { 
                success: true, 
                filename: fileName,
                method: 'basic'
            };
            
        } catch (error) {
            logger.error('基础导出方法失败', error);
            throw error;
        }
    }

    /**
     * 处理快捷操作 - 提取优质资源位
     */
    async handleQuickQualityExtract() {
        if (this.parsedData.length === 0) {
            console.log('请先上传文件');
            return;
        }

        try {
            // 弹出月份选择器
            const selectedMonth = await this.showMonthSelector('提取优质资源位');
            if (!selectedMonth) {
                return; // 用户取消选择
            }

            const monthStr = `${selectedMonth.year}年${selectedMonth.month}月`;
            console.log(`正在提取${monthStr}优质资源位...`);
            
            // 执行增强版优质资源位提取（传入所有文件数据和选择的月份）
            const result = await this.quickActions.executeAction('extractQualityResources', this.parsedData, selectedMonth);
            
            // 调试信息：记录提取结果
            logger.info('优质资源位提取操作结果', {
                success: result.success,
                dataLength: result.data ? result.data.length : 0,
                headersLength: result.headers ? result.headers.length : 0,
                message: result.message,
                hasData: result.data && result.data.length > 0,
                hasHeaders: result.headers && result.headers.length > 0
            });
            
            if (result.success && result.data.length > 0) {
                this.processedData = result.data;
                this.dataPreview.setProcessedData(result.data);
                console.log(result.message);
                logger.userAction('提取优质资源位', result.stats);
                
                // 步骤7: 询问用户是否导出Excel文件
                setTimeout(async () => {
                    try {
                        const shouldExport = await this.showQualityExportConfirmDialog(monthStr, result.data.length, result.stats);
                        if (shouldExport) {
                            await this.exportQualityResourcesData(result.data, result.headers, monthStr, result.stats);
                        }
                    } catch (exportError) {
                        logger.error('导出失败', exportError);
                        console.error(`导出失败: ${exportError.message}`);
                    }
                }, 500); // 短暂延迟以确保数据预览更新完成
                
            } else if (result.success && result.data.length === 0) {
                console.log(`没有找到符合条件的${monthStr}优质资源位`);
            } else {
                console.error(result.message);
            }
        } catch (error) {
            logger.error('提取优质资源位失败', error);
            console.error(`操作失败: ${error.message}`);
        }
    }

    /**
     * 处理筛选配置
     */
    async handleFilterConfig() {
        const columns = await this.getAvailableColumnsAsync();
        const hasPrevious = Array.isArray(this.currentData) && this.currentData.length > 0;
        this.ruleConfigModal.showFilterConfig(columns, hasPrevious);
    }

    /**
     * 处理排序配置
     */
    async handleSortConfig() {
        const columns = await this.getAvailableColumnsAsync();
        const hasPrevious = Array.isArray(this.currentData) && this.currentData.length > 0;
        this.ruleConfigModal.showSortConfig(columns, hasPrevious);
    }

    /**
     * 处理列处理配置
     */
    async handleProcessConfig() {
        const columns = await this.getAvailableColumnsAsync();
        const hasPrevious = Array.isArray(this.currentData) && this.currentData.length > 0;
        this.ruleConfigModal.showProcessConfig(columns, hasPrevious);
    }

    /**
     * 处理合并配置
     */
    handleMergeConfig() {
        const hasPrevious = Array.isArray(this.currentData) && this.currentData.length > 0;
        this.ruleConfigModal.showMergeConfig(this.parsedData || [], hasPrevious);
    }

    /**
     * 获取可用列名（映射为A、B、C格式）
     */
    async getAvailableColumnsAsync() {
        if (!this.parsedData || this.parsedData.length === 0) {
            return [];
        }

        // 获取第一个文件的全部数据
        const firstFile = this.parsedData[0];
        const firstData = Array.isArray(firstFile.data) ? firstFile.data : [firstFile.data];
        
        if (firstData.length === 0) {
            return [];
        }

        const originalColumns = Object.keys(firstData[0]);
        
        // 更新columnMapper的数据
        this.columnMapper.updateData(firstData);
        
        // 返回映射后的列名
        return this.columnMapper.getAvailableColumns();
    }

    /**
     * 规则处理统一入口，优先用Web Worker（大数据量），小数据量直接主线程
     */
    async handleRuleConfig(config) {
        // 只对非合并规则做上传校验
        if (config.type !== 'merge' && (!this.parsedData || this.parsedData.length === 0)) {
            console.log('请先上传文件');
            return;
        }

        let currentData;
        // 数据来源判断
        let dataSource = config.dataSource || 'original';
        if (dataSource === 'previous' && (!this.currentData || !Array.isArray(this.currentData) || this.currentData.length === 0)) {
            alert('上一步结果不可用，请先应用前置规则或选择原始数据');
            return;
        }
        // 合并规则：主流程统一使用主上传区数据
        if (config.type === 'merge') {
            const mergeType = config.mergeType;
            if (!this.parsedData || this.parsedData.length === 0) {
                throw new Error('请先在主上传区上传文件');
            }
            let XLSX = window.XLSX;
            if (!XLSX) {
                XLSX = await import('../libs/xlsx.min.js').then(m => m.default || m);
            }
            const parseFile = async (fileObj) => {
                if (fileObj.file) {
                    const data = await fileObj.file.arrayBuffer();
                    const workbook = XLSX.read(data, { type: 'array' });
                    return workbook;
                } else if (fileObj.data) {
                    return { Sheets: { Sheet1: XLSX.utils.json_to_sheet(fileObj.data) }, SheetNames: ['Sheet1'] };
                }
                throw new Error('文件数据无效');
            };
            let mergedData = [];
            if (mergeType === 'files') {
                for (let i = 0; i < this.parsedData.length; i++) {
                    const wb = await parseFile(this.parsedData[i]);
                    const firstSheet = wb.SheetNames[0];
                    const sheet = wb.Sheets[firstSheet];
                    const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
                    mergedData = mergedData.concat(json);
                }
            } else if (mergeType === 'sheets') {
                const wb = await parseFile(this.parsedData[0]);
                wb.SheetNames.forEach(sheetName => {
                    const sheet = wb.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
                    mergedData = mergedData.concat(json);
                });
            } else {
                throw new Error('不支持的合并类型: ' + mergeType);
            }
            currentData = mergedData;
            this.currentData = mergedData; // 修正：合并后立即赋值，保证链式数据流
            this.ruleProcessor.updateData(currentData);
            console.log('[DEBUG] 合并后 currentData:', currentData);
        } else {
            // 其它规则，数据来源已判断
            if (dataSource === 'previous') {
                currentData = this.currentData;
            } else {
                currentData = this.getCurrentDataForProcessing();
            }
            this.ruleProcessor.updateData(currentData);
        }
        // 应用规则
        let result = currentData;
        // 新增：规则应用前校验数据有效性
        console.log('[DEBUG] 规则应用前 currentData:', currentData);
        if (!Array.isArray(currentData) || currentData.length === 0) {
            this.progressManager.error('当前数据无效，无法应用规则。请检查数据来源或先完成上一步操作。');
            return;
        }
        // 判断是否用Worker（大于2000条用Worker，否则主线程）
        const useWorker = currentData.length > 2000;
        const batchSize = 500;
        if (useWorker) {
            // Worker处理
            this.progressManager.setStepDetail(3, '数据处理中...(Web Worker)');
            return await new Promise((resolve, reject) => {
                let lastPercent = 0;
                const onWorkerMsg = (e) => {
                    const msg = e.data;
                    if (msg.type === 'progress') {
                        this.progressManager.setStepDetail(3, `已处理${msg.percent}%`);
                        if (msg.percent === 100 && msg.partialResult) {
                            this.dataPreview.setProcessedData(msg.partialResult.length > 100 ? msg.partialResult.slice(0, 100) : msg.partialResult);
                        }
                    } else if (msg.type === 'result') {
                        this.processedData = msg.data;
                        this.currentData = msg.data;
                        this.dataHistory.push([...msg.data]);
                        this.progressManager.setStepDetail(4, '更新预览中...');
                        this.dataPreview.setProcessedData(msg.data);
                        this.updateStats();
                        this.progressManager.complete(`规则应用完成，处理了 ${msg.data.length} 行数据`);
                        this.setCurrentStatus(config.type, config.dataSource);
                        this.ruleWorker.removeEventListener('message', onWorkerMsg);
                        resolve(msg.data);
                    } else if (msg.type === 'error') {
                        this.progressManager.error('规则处理失败: ' + msg.message);
                        this.ruleWorker.removeEventListener('message', onWorkerMsg);
                        reject(new Error(msg.message));
                    }
                };
                this.ruleWorker.addEventListener('message', onWorkerMsg);
                // 发送数据到Worker
                let workerData = currentData;
                let workerConfig = { ...config };
                if (config.type === 'merge') {
                    workerConfig.files = [currentData];
                }
                this.ruleWorker.postMessage({ type: 'run', ruleConfig: workerConfig, data: workerData, batchSize });
            });
        } else {
            // 主线程处理（调用原有异步方法）
            const onProgress = (percent, partialResult) => {
                this.progressManager.setStepDetail(3, `已处理${percent}%`);
                if (percent === 100) {
                    this.dataPreview.setProcessedData(partialResult.length > 100 ? partialResult.slice(0, 100) : partialResult);
                }
            };
            switch (config.type) {
                case 'filter':
                    this.progressManager.setStepDetail(3, '筛选数据中...');
                    result = await this.ruleProcessor.filterAsync(config, onProgress, batchSize);
                    break;
                case 'sort':
                    this.progressManager.setStepDetail(3, '排序数据中...');
                    result = await this.ruleProcessor.sortAsync(config, onProgress, batchSize);
                    break;
                case 'process':
                    this.progressManager.setStepDetail(3, '处理列数据中...');
                    result = await this.ruleProcessor.processAsync(config, onProgress, batchSize);
                    break;
                case 'merge':
                    this.progressManager.setStepDetail(3, '合并表格中...');
                    result = await this.ruleProcessor.mergeAsync({ ...config, files: [currentData] }, onProgress, batchSize);
                    this.parsedData = [{ data: result, fileName: '合并结果' }];
                    break;
                default:
                    throw new Error(`未知的规则类型: ${config.type}`);
            }
            this.processedData = result;
            this.currentData = result;
            this.dataHistory.push([...result]);
            this.progressManager.setStepDetail(4, '更新预览中...');
            this.dataPreview.setProcessedData(result);
            this.updateStats();
            this.progressManager.complete(`规则应用完成，处理了 ${result.length} 行数据`);
            this.setCurrentStatus(config.type, config.dataSource);
            return result;
        }
    }

    /**
     * 撤销上一步操作
     */
    undoLastOperation() {
        if (this.dataHistory.length > 1) {
            this.dataHistory.pop(); // 移除当前
            this.currentData = [...this.dataHistory[this.dataHistory.length - 1]];
            this.processedData = this.currentData;
            this.dataPreview.setProcessedData(this.currentData);
            this.setCurrentStatus('撤销', 'previous');
        } else {
            alert('没有可撤销的操作');
        }
    }
    /**
     * 一键重置为原始数据
     */
    resetToOriginalData() {
        this.currentData = null;
        this.dataHistory = [];
        this.processedData = null;
        this.dataPreview.setOriginalData(this.parsedData);
        this.setCurrentStatus('original', 'original');
    }

    /**
     * 获取当前用于处理的数据
     */
    getCurrentDataForProcessing() {
        if (!this.parsedData || this.parsedData.length === 0) {
            return [];
        }

        // 合并所有文件的数据
        let allData = [];
        this.parsedData.forEach(fileData => {
            const dataArray = Array.isArray(fileData.data) ? fileData.data : [fileData.data];
            allData = allData.concat(dataArray);
        });

        return allData;
    }

    /**
     * 处理规则应用
     */
    async handleApplyRules() {
        if (this.parsedData.length === 0) {
            console.log('请先上传文件');
            return;
        }

        if (this.isProcessing) {
            console.log('正在处理中，请稍候...');
            return;
        }

        this.isProcessing = true;
        this.progressManager.start('应用数据处理规则');

        try {
            // 合并所有文件数据
            this.progressManager.setStepDetail(2, '正在合并文件数据...');
            let allData = [];
            
            this.parsedData.forEach((fileData, index) => {
                this.progressManager.addLog(`合并文件 ${index + 1}/${this.parsedData.length}: ${fileData.fileName}`);
                
                let dataArray = fileData.data;
                if (!Array.isArray(dataArray)) {
                    dataArray = [dataArray];
                }
                
                // 添加数据源标识
                const dataWithSource = dataArray.map(row => ({
                    ...row,
                    _fileName: fileData.fileName,
                    _fileIndex: index
                }));
                
                allData = allData.concat(dataWithSource);
            });

            this.progressManager.nextStep('正在应用处理规则...');

            // 应用规则引擎处理
            if (allData.length > 0) {
                // 转换为Arquero表格
                const table = aq.from(allData);
                
                // 应用规则
                const processedTable = this.ruleEngine.applyRules(table);
                this.processedData = processedTable.objects();
                
                this.progressManager.setStepDetail(3, `处理完成，从 ${allData.length} 行数据生成了 ${this.processedData.length} 行结果`);
            } else {
                this.processedData = [];
            }

            this.progressManager.nextStep('正在更新数据预览...');

            // 更新数据预览
            this.dataPreview.setProcessedData(this.processedData);
            this.updateStats();

            this.progressManager.complete(`规则应用完成，处理了 ${this.processedData.length} 行数据`);
            console.log(`规则应用成功，生成 ${this.processedData.length} 行数据`);

        } catch (error) {
            console.error('规则应用失败:', error);
            this.progressManager.error(`规则应用失败: ${error.message}`);
            console.error(`规则应用失败: ${error.message}`);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * 更新统计信息
     */
    updateStats() {
        // 更新文件数量
        const fileCountElement = document.getElementById('file-count');
        if (fileCountElement) {
            fileCountElement.textContent = this.parsedData.length;
        }

        // 更新总记录数
        let totalRecords = 0;
        this.parsedData.forEach(fileData => {
            if (Array.isArray(fileData.data)) {
                totalRecords += fileData.data.length;
            } else if (fileData.data) {
                totalRecords += 1;
            }
        });

        const recordCountElement = document.getElementById('record-count');
        if (recordCountElement) {
            recordCountElement.textContent = totalRecords.toLocaleString();
        }
    }

    /**
     * 处理Excel导出
     */
    async handleExportExcel() {
        const exportData = this.processedData || [];
        if (exportData.length === 0) {
            console.log('没有数据可导出');
            return;
        }
        try {
            const result = await this.exporter.exportToExcel(exportData, {
                filename: `processed_data_${new Date().toISOString().slice(0, 10)}.xlsx`,
                sheetName: '处理结果'
            });
            if (result && result.success) {
                console.log('Excel文件导出成功');
                logger.userAction('导出Excel', { rows: exportData.length });
            }
            // 用户取消(result.cancelled)或失败时不输出任何成功信息
        } catch (error) {
            console.error(`导出失败: ${error.message}`);
        }
    }

    /**
     * 处理CSV导出
     */
    async handleExportCSV() {
        const exportData = this.processedData || [];
        if (exportData.length === 0) {
            console.log('没有数据可导出');
            return;
        }
        try {
            const result = await this.exporter.exportToCSV(exportData, {
                filename: `processed_data_${new Date().toISOString().slice(0, 10)}.csv`,
                encoding: 'utf-8'
            });
            if (result && result.success) {
                console.log('CSV文件导出成功');
                logger.userAction('导出CSV', { rows: exportData.length });
            }
            // 用户取消(result.cancelled)或失败时不输出任何成功信息
        } catch (error) {
            console.error(`导出失败: ${error.message}`);
        }
    }

    /**
     * 处理对比数据导出
     */
    async handleExportComparison() {
        const originalData = this.dataPreview.getOriginalData();
        const processedData = this.processedData;

        if (!originalData || originalData.length === 0) {
            console.log('没有原始数据可对比');
            return;
        }

        if (!processedData || processedData.length === 0) {
            console.log('没有处理后数据可对比');
            return;
        }

        try {
            // 合并原始数据
            let mergedOriginal = [];
            originalData.forEach(fileData => {
                const dataArray = Array.isArray(fileData.data) ? fileData.data : [fileData.data];
                mergedOriginal = mergedOriginal.concat(dataArray);
            });

            const result = await this.exporter.exportComparison(mergedOriginal, processedData, {
                filename: `data_comparison_${new Date().toISOString().slice(0, 10)}.xlsx`
            });

            if (result.success) {
                console.log('对比数据导出成功');
                logger.userAction('导出对比数据', { 
                    originalRows: mergedOriginal.length,
                    processedRows: processedData.length 
                });
            } else {
                if (
                    typeof result.message === 'string' &&
                    result.message.includes('user activation is required')
                ) {
                    return;
                }
                console.error(result.message);
            }
        } catch (error) {
            if (
                error &&
                typeof error.message === 'string' &&
                error.message.includes('user activation is required')
            ) {
                return;
            }
            logger.error('对比数据导出失败', error);
            console.error(`导出失败: ${error.message}`);
        }
    }

    /**
     * 获取当前数据用于导出
     * @returns {Array} 当前数据
     */
    getCurrentDataForExport() {
        // 只返回处理后的数据，且自动解包data字段
        if (Array.isArray(this.processedData) && this.processedData.length === 1 && this.processedData[0].data) {
            return this.processedData[0].data;
        }
        return this.processedData || [];
    }

    /**
     * 上传/解析文件后，重置 currentData 并刷新状态提示
     */
    resetCurrentData() {
        this.currentData = null;
        this.setCurrentStatus('original', 'original');
    }

    /**
     * 设置当前数据状态提示
     * @param {string} status - 当前处理规则类型
     * @param {string} source - 当前数据来源
     */
    setCurrentStatus(status, source) {
        const statusEl = document.getElementById('current-data-status');
        if (statusEl) {
            let ruleText = '';
            switch (status) {
                case 'filter': ruleText = '筛选数据'; break;
                case 'sort': ruleText = '排序数据'; break;
                case 'process': ruleText = '处理列'; break;
                case 'merge': ruleText = '合并表格'; break;
                default: ruleText = '原始数据';
            }
            let sourceText = '';
            switch (source) {
                case 'original': sourceText = '原始数据'; break;
                case 'previous': sourceText = '上一步结果'; break;
                case 'merge': sourceText = '合并结果'; break;
                default: sourceText = source || '原始数据';
            }
            statusEl.innerHTML = `<span class="font-bold">当前数据：</span>${ruleText}（来源：${sourceText}）`;
        }
    }

    /**
     * 获取应用实例（用于全局访问）
     * @returns {RuleXcelApp} 应用实例
     */
    static getInstance() {
        return window.app;
    }


}

// 应用启动
console.log('main.js 模块已加载，等待DOM完成...');

// 检测浏览器类型
const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
const isEdge = /Edge/.test(navigator.userAgent);

// 初始化函数
function initializeApp() {
    try {
        window.app = new RuleXcelApp();
        logger.info('RuleXcel应用初始化成功');
        
        // Chrome兼容性修复
        if (isChrome) {
            const fileInput = document.getElementById('file-input');
            const browseBtn = document.getElementById('browse-files');
            
            // Chrome需要额外的事件绑定
            if (browseBtn && fileInput) {
                // 移除可能阻止事件的样式
                browseBtn.style.pointerEvents = 'auto';
                browseBtn.style.zIndex = '1000';
                
                // 添加Chrome兼容的事件监听器
                browseBtn.addEventListener('click', function chromeCompatClick(e) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    
                    // 延迟一小段时间确保事件处理完成
                    setTimeout(() => {
                        fileInput.click();
                    }, 10);
                }, true); // 使用捕获阶段
            }
        }
        
    } catch (error) {
        console.error('❌ RuleXcel应用初始化失败:', error);
        console.error('错误堆栈:', error.stack);
        
        // 显示错误给用户
        document.body.insertAdjacentHTML('afterbegin', `
            <div style="background: red; color: white; padding: 10px; margin: 10px; border-radius: 5px;">
                <strong>应用初始化失败:</strong> ${error.message}
            </div>
        `);
    }
}

// 多重事件监听确保兼容性
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

// Chrome有时需要window.onload
window.addEventListener('load', () => {
    // 如果app还没有初始化，再试一次
    if (!window.app) {
        initializeApp();
    }
});