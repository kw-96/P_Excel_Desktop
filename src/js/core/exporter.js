/**
 * 文件导出器
 * 支持Excel和CSV格式的数据导出
 */

import formatter from '../utils/formatter.js';
import logger from '../utils/logger.js';

class Exporter {
    constructor() {
        this.XLSX = window.XLSX;
        this.defaultExportOptions = {
            format: 'xlsx', // xlsx, csv
            sheetName: 'Sheet1',
            filename: null, // 自动生成
            includeHeaders: true,
            compression: false
        };
    }

    /**
     * 导出数据为Excel文件
     * @param {Array} data - 要导出的数据数组
     * @param {Object} options - 导出选项
     * @returns {Promise<void>}
     */
    async exportToExcel(data, options = {}) {
        try {
            const config = { ...this.defaultExportOptions, ...options };
            
            if (!data || !Array.isArray(data) || data.length === 0) {
                throw new Error('没有可导出的数据');
            }

            logger.info('开始导出Excel文件', { 
                rows: data.length, 
                filename: config.filename 
            });
            
            logger.info('导出器配置检查', {
                config: config,
                dataType: Array.isArray(data) ? 'array' : typeof data,
                firstRowType: data.length > 0 ? typeof data[0] : 'undefined'
            });

            // 使用智能数据预处理，只对确定的日期列进行保护
            const processedData = this._preprocessDataForExport(data);
            logger.info('智能数据预处理完成', { originalRows: data.length, finalRows: processedData.length });

            // 创建工作簿
            const wb = this.XLSX.utils.book_new();
            
            // 创建工作表，使用简化选项（调试模式）
            logger.info('准备创建工作表', {
                dataLength: processedData.length,
                firstRowSample: processedData[0],
                dataKeys: processedData.length > 0 ? Object.keys(processedData[0]) : [],
                dataValues: processedData.length > 0 ? Object.values(processedData[0]) : []
            });
            
            const ws = this.XLSX.utils.json_to_sheet(processedData);
            // 自动设置列宽
            if (processedData.length > 0) {
                const keys = Object.keys(processedData[0]);
                ws['!cols'] = keys.map(key => {
                    const maxLen = Math.max(
                        key.length,
                        ...processedData.map(row => (row[key] ? String(row[key]).length : 0))
                    );
                    return { wch: Math.max(8, Math.min(maxLen + 2, 40)) };
                });
            }
            
            // 详细检查工作表内容
            const allKeys = Object.keys(ws);
            const cellKeys = allKeys.filter(key => key !== '!ref' && key !== '!margins');
            const sampleCells = {};
            ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].forEach(cell => {
                if (ws[cell]) {
                    sampleCells[cell] = ws[cell];
                }
            });
            
            logger.info('工作表创建完成', { 
                range: ws['!ref'],
                totalKeys: allKeys.length,
                cellCount: cellKeys.length,
                sampleCells: sampleCells,
                hasData: cellKeys.length > 0
            });

            // 智能设置工作表格式，只对日期列进行特殊处理
            this._setWorksheetTextFormat(ws, processedData);

            // 添加工作表到工作簿
            this.XLSX.utils.book_append_sheet(wb, ws, config.sheetName);

            // 生成文件名
            const filename = config.filename || this._generateFilename('data', 'xlsx');

            // 改进的导出逻辑
            await this._downloadExcelFile(wb, filename);

            logger.info('Excel文件导出成功', { filename });
            return { success: true, filename };

        } catch (error) {
            // 静默处理showSaveFilePicker的user activation错误，不抛出异常
            if (
                error &&
                typeof error.message === 'string' &&
                error.message.includes('showSaveFilePicker') &&
                error.message.includes('user activation is required')
            ) {
                return;
            }
            logger.error('Excel导出失败', error);
            throw new Error(`Excel导出失败: ${error.message}`);
        }
    }

    /**
     * 导出数据为CSV文件
     * @param {Array} data - 要导出的数据数组
     * @param {Object} options - 导出选项
     * @returns {Promise<void>}
     */
    async exportToCSV(data, options = {}) {
        try {
            const config = { ...this.defaultExportOptions, ...options };
            
            if (!data || !Array.isArray(data) || data.length === 0) {
                throw new Error('没有可导出的数据');
            }

            logger.info('开始导出CSV文件', { 
                rows: data.length, 
                filename: config.filename 
            });

            // 转换为CSV格式
            const csvContent = this._convertToCSV(data, config);

            // 生成文件名
            const filename = config.filename || this._generateFilename('data', 'csv');

            // 使用新的下载方法，支持路径选择
            await this._downloadCSVFile(csvContent, filename);

            logger.info('CSV文件导出成功', { filename });
            return { success: true, filename };

        } catch (error) {
            if (error && (error.name === 'AbortError' || (typeof error.message === 'string' && error.message.includes('user activation is required')))) {
                return { success: false, cancelled: true };
            }
            return { success: false, error: error.message };
        }
    }

    /**
     * 批量导出多个数据集为多个工作表的Excel文件
     * @param {Array} datasets - 数据集数组 [{data: [], name: '', options: {}}]
     * @param {Object} options - 导出选项
     * @returns {Promise<void>}
     */
    async exportMultipleSheets(datasets, options = {}) {
        try {
            if (!datasets || !Array.isArray(datasets) || datasets.length === 0) {
                throw new Error('没有可导出的数据集');
            }

            logger.info('开始导出多工作表Excel文件', { 
                sheets: datasets.length,
                filename: options.filename 
            });

            // 创建工作簿
            const wb = this.XLSX.utils.book_new();

            // 添加每个数据集为工作表
            datasets.forEach((dataset, index) => {
                const { data, name, options: sheetOptions = {} } = dataset;
                
                if (!data || !Array.isArray(data) || data.length === 0) {
                    logger.warn(`数据集 ${index + 1} 为空，跳过`);
                    return;
                }

                // 预处理数据，防止自动日期转换
                const processedData = this._preprocessDataForExport(data);

                const sheetName = name || `Sheet${index + 1}`;
                const ws = this.XLSX.utils.json_to_sheet(processedData, {
                    header: sheetOptions.includeHeaders !== false ? Object.keys(processedData[0]) : undefined,
                    cellDates: false,  // 防止自动日期转换
                    dateNF: '@',       // 将日期格式设为文本
                    raw: false         // 禁用原始值处理，强制文本处理
                });

                // 为工作表设置列格式为文本（防止Excel自动转换）
                this._setWorksheetTextFormat(ws, processedData);
                
                // 额外保护：为整个工作表设置默认格式
                if (!ws['!cols']) ws['!cols'] = [];
                const headers = Object.keys(processedData[0]);
                headers.forEach((header, index) => {
                    if (!ws['!cols'][index]) ws['!cols'][index] = {};
                    ws['!cols'][index].z = '@'; // 设置列格式为文本
                });

                this.XLSX.utils.book_append_sheet(wb, ws, sheetName);
            });

            // 生成文件名
            const filename = options.filename || this._generateFilename('多表数据', 'xlsx');

            // 改进的导出逻辑
            await this._downloadExcelFile(wb, filename);

            logger.info('多工作表Excel文件导出成功', { filename });
            return { success: true, filename };

        } catch (error) {
            // 静默处理showSaveFilePicker的user activation错误，不抛出异常
            if (
                error &&
                typeof error.message === 'string' &&
                error.message.includes('showSaveFilePicker') &&
                error.message.includes('user activation is required')
            ) {
                return;
            }
            logger.error('多工作表导出失败', error);
            throw new Error(`多工作表导出失败: ${error.message}`);
        }
    }

    /**
     * 导出处理前后的对比数据
     * @param {Array} originalData - 原始数据
     * @param {Array} processedData - 处理后数据
     * @param {Object} options - 导出选项
     * @returns {Promise<void>}
     */
    async exportComparison(originalData, processedData, options = {}) {
        try {
            const datasets = [
                {
                    data: originalData,
                    name: '原始数据',
                    options: { includeHeaders: true }
                },
                {
                    data: processedData,
                    name: '处理结果',
                    options: { includeHeaders: true }
                }
            ];

            const filename = options.filename || this._generateFilename('数据对比', 'xlsx');
            
            return await this.exportMultipleSheets(datasets, { ...options, filename });
        } catch (error) {
            // 静默处理showSaveFilePicker的user activation错误，不抛出异常
            if (
                error &&
                typeof error.message === 'string' &&
                error.message.includes('showSaveFilePicker') &&
                error.message.includes('user activation is required')
            ) {
                return;
            }
            logger.error('对比数据导出失败', error);
            throw new Error(`对比数据导出失败: ${error.message}`);
        }
    }

    /**
     * 将数据转换为CSV格式
     * @param {Array} data - 数据数组
     * @param {Object} options - 转换选项
     * @returns {string} CSV字符串
     */
    _convertToCSV(data, options = {}) {
        if (!data || data.length === 0) return '';

        const separator = options.separator || ',';
        const lineBreak = options.lineBreak || '\n';
        const quote = '"';
        
        // 获取列名
        const headers = Object.keys(data[0]);
        
        // 创建CSV内容
        let csvContent = '';
        
        // 添加标题行
        if (options.includeHeaders !== false) {
            csvContent += headers.map(header => this._escapeCSVField(header, quote, separator)).join(separator) + lineBreak;
        }
        
        // 添加数据行
        data.forEach(row => {
            const values = headers.map(header => {
                const value = row[header];
                return this._escapeCSVField(value, quote, separator);
            });
            csvContent += values.join(separator) + lineBreak;
        });
        
        return csvContent;
    }

    /**
     * 转义CSV字段
     * @param {any} field - 字段值
     * @param {string} quote - 引号字符
     * @param {string} separator - 分隔符
     * @returns {string} 转义后的字段
     */
    _escapeCSVField(field, quote, separator) {
        if (field === null || field === undefined) {
            return '';
        }
        
        let value = String(field);
        
        // 如果包含分隔符、引号或换行符，需要用引号包围
        if (value.includes(separator) || value.includes(quote) || value.includes('\n') || value.includes('\r')) {
            // 转义引号（双引号）
            value = value.replace(new RegExp(quote, 'g'), quote + quote);
            // 用引号包围
            value = quote + value + quote;
        }
        
        return value;
    }

    /**
     * 下载Excel文件 - 改进版本
     * @param {Object} workbook - XLSX工作簿对象
     * @param {string} filename - 文件名
     * @returns {Promise<void>}
     */
    async _downloadExcelFile(workbook, filename) {
        try {
            // 只保留文件系统API导出
            if (window.showSaveFilePicker) {
                try {
                    logger.info('使用文件系统访问API，用户可选择保存路径');
                    const fileHandle = await window.showSaveFilePicker({
                        suggestedName: filename,
                        types: [{
                            description: 'Excel文件 (*.xlsx)',
                            accept: {
                                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
                            }
                        }],
                        excludeAcceptAllOption: false
                    });
                    const buffer = this.XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
                    logger.info('工作簿写入检查', {
                        bufferSize: buffer.byteLength,
                        bufferType: buffer.constructor.name,
                        isEmpty: buffer.byteLength === 0,
                        firstBytes: Array.from(buffer.slice(0, 10))
                    });
                    const writable = await fileHandle.createWritable();
                    await writable.write(buffer);
                    await writable.close();
                    const savedFileName = fileHandle.name;
                    logger.info('文件保存成功', { filename: savedFileName, method: 'FileSystemAPI' });
                    return;
                } catch (error) {
                    if (error.name === 'AbortError') {
                        logger.info('用户取消了文件保存操作');
                        // 用户主动取消时不弹出任何错误通知
                        return;
                    } else {
                        if (
                            error &&
                            typeof error.message === 'string' &&
                            error.message.includes('user activation is required')
                        ) {
                            return;
                        }
                        logger.error('文件系统访问API失败', error);
                        throw error;
                    }
                }
            } else {
                throw new Error('当前浏览器不支持文件系统访问API，无法保存文件');
            }
        } catch (error) {
            if (
                error &&
                typeof error.message === 'string' &&
                error.message.includes('user activation is required')
            ) {
                return;
            }
            logger.error('Excel文件下载失败', error);
            throw error;
        }
    }

    /**
     * 下载CSV文件 - 支持路径选择
     * @param {string} content - CSV内容
     * @param {string} filename - 文件名
     * @returns {Promise<void>}
     */
    async _downloadCSVFile(content, filename) {
        try {
            if (window.showSaveFilePicker) {
                try {
                    logger.info('使用文件系统访问API保存CSV文件，用户可选择保存路径');
                    const fileHandle = await window.showSaveFilePicker({
                        suggestedName: filename,
                        types: [{
                            description: 'CSV文件 (*.csv)',
                            accept: {
                                'text/csv': ['.csv']
                            }
                        }],
                        excludeAcceptAllOption: false
                    });
                    const writable = await fileHandle.createWritable();
                    const bomContent = '\ufeff' + content;
                    await writable.write(bomContent);
                    await writable.close();
                    const savedFileName = fileHandle.name;
                    logger.info('CSV文件保存成功', { filename: savedFileName, method: 'FileSystemAPI' });
                    return;
                } catch (error) {
                    if (error.name === 'AbortError') {
                        logger.info('用户取消了CSV文件保存操作');
                        // 用户主动取消时不弹出任何错误通知
                        return;
                    } else {
                        if (
                            error &&
                            typeof error.message === 'string' &&
                            error.message.includes('user activation is required')
                        ) {
                            return;
                        }
                        logger.error('文件系统访问API失败', error);
                        throw error;
                    }
                }
            } else {
                throw new Error('当前浏览器不支持文件系统访问API，无法保存文件');
            }
        } catch (error) {
            if (
                error &&
                typeof error.message === 'string' &&
                error.message.includes('user activation is required')
            ) {
                return;
            }
            logger.error('CSV文件下载失败', error);
            throw error;
        }
    }





    /**
     * 生成文件名
     * @param {string} baseName - 基础名称
     * @param {string} extension - 文件扩展名
     * @returns {string} 生成的文件名
     */
    _generateFilename(baseName, extension) {
        const timestamp = formatter.formatDate(new Date(), 'YYYY-MM-DD_HH-mm-ss');
        return `${baseName}_${timestamp}.${extension}`;
    }

    /**
     * 导出日志文件
     * @param {Array} logs - 日志数组
     * @param {Object} options - 导出选项
     * @returns {Promise<void>}
     */
    async exportLogs(logs, options = {}) {
        try {
            if (!logs || logs.length === 0) {
                throw new Error('没有可导出的日志');
            }

            // 格式化日志数据
            const logData = logs.map(log => ({
                时间: formatter.formatDate(log.timestamp, 'YYYY-MM-DD HH:mm:ss'),
                级别: log.level,
                消息: log.message,
                数据: log.data ? JSON.stringify(log.data) : '',
                堆栈: log.stack || ''
            }));

            const filename = options.filename || this._generateFilename('系统日志', 'xlsx');
            
            return await this.exportToExcel(logData, { 
                ...options, 
                filename,
                sheetName: '系统日志' 
            });
        } catch (error) {
            // 静默处理showSaveFilePicker的user activation错误，不抛出异常
            if (
                error &&
                typeof error.message === 'string' &&
                error.message.includes('showSaveFilePicker') &&
                error.message.includes('user activation is required')
            ) {
                return;
            }
            logger.error('日志导出失败', error);
            throw new Error(`日志导出失败: ${error.message}`);
        }
    }

    /**
     * 获取支持的导出格式
     * @returns {Array} 支持的格式列表
     */
    getSupportedFormats() {
        return [
            { value: 'xlsx', label: 'Excel文件 (.xlsx)', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
            { value: 'csv', label: 'CSV文件 (.csv)', mimeType: 'text/csv' }
        ];
    }

    /**
     * 检查是否支持指定格式
     * @param {string} format - 文件格式
     * @returns {boolean} 是否支持
     */
    isFormatSupported(format) {
        const supportedFormats = ['xlsx', 'xls', 'csv'];
        return supportedFormats.includes(format.toLowerCase());
    }

    /**
     * 统一预处理数据（不做内容变更，仅保留接口，便于后续扩展）
     * @param {Array} data - 数据数组
     * @returns {Array} 预处理后的数据数组
     */
    _preprocessDataForExport(data) {
        if (!data || data.length === 0) return data;
        return data.map(row => ({ ...row }));
    }

    /**
     * 识别日期/需文本保护的列
     * @param {Array} headers - 列名数组
     * @returns {Array} 需文本保护的列名数组
     */
    _identifyTextProtectColumns(headers) {
        const keywords = [
            '日期', '时间', '投放日期', '报告日期', '统计日期', '创建时间', '更新时间',
            'date', 'time', 'created', 'updated', 'report', 'stat'
        ];
        return headers.filter(header => {
            const lowerHeader = header.toLowerCase();
            return keywords.some(keyword => lowerHeader.includes(keyword));
        });
    }

    /**
     * 设置工作表所有列为文本格式保护
     * @param {Object} worksheet - XLSX工作表对象
     * @param {Array} data - 数据数组
     */
    _setWorksheetTextFormat(worksheet, data) {
        if (!data || data.length === 0) return;
        const headers = Object.keys(data[0]);
        if (!worksheet['!cols']) worksheet['!cols'] = [];
        headers.forEach((header, index) => {
            if (!worksheet['!cols'][index]) worksheet['!cols'][index] = {};
            worksheet['!cols'][index].z = '@'; // 所有列都文本保护
        });
    }
}

// 导出单例实例
const exporter = new Exporter();
export default exporter; 