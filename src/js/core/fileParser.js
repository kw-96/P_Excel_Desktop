/**
 * RuleXcel - 文件解析器
 * 负责解析Excel(.xlsx, .xls)和CSV文件
 * 使用SheetJS库进行文件解析
 * @author RuleXcel
 */

import validator from '../utils/validator.js';
import logger from '../utils/logger.js';

export class FileParser {
    constructor() {
        this.validator = validator;
        this.logger = logger;
        
        // 支持的文件类型
        this.supportedTypes = {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
            'application/vnd.ms-excel': 'xls',
            'text/csv': 'csv',
            'application/csv': 'csv'
        };
        
        // 文件大小限制 (10MB)
        this.maxFileSize = 10 * 1024 * 1024;
        
        // 检查必要的依赖库
        this.checkDependencies();
    }
    
    /**
     * 检查必要的依赖库是否已加载
     */
    checkDependencies() {
        if (typeof XLSX === 'undefined') {
            throw new Error('XLSX库未加载，请确保已正确引入libs/xlsx.min.js');
        }
        
        if (typeof aq === 'undefined') {
            console.warn('Arquero库未加载，部分功能可能受限');
        }
        
        this.logger.debug('依赖库检查完成', {
            XLSX: typeof XLSX !== 'undefined',
            Arquero: typeof aq !== 'undefined'
        });
    }

    /**
     * 解析文件
     * @param {File} file - 要解析的文件
     * @returns {Promise<Array>} 解析后的数据数组
     */
    async parseFile(file) {
        try {
            // 验证文件
            this.validateFile(file);
            
            // 读取文件
            const arrayBuffer = await this.readFileAsArrayBuffer(file);
            
            // 根据文件类型解析
            const fileType = this.getFileType(file);
            let data;
            
            switch (fileType) {
                case 'xlsx':
                case 'xls':
                    data = this.parseExcelFile(arrayBuffer);
                    break;
                case 'csv':
                    data = this.parseCsvFile(arrayBuffer);
                    break;
                default:
                    throw new Error(`不支持的文件类型: ${file.type}`);
            }
            
            // 验证解析结果
            this.validateParsedData(data);
            
            this.logger.info(`文件解析成功: ${file.name}`, {
                文件大小: `${(file.size / 1024).toFixed(2)}KB`,
                记录数: data.length,
                列数: data.length > 0 ? Object.keys(data[0]).length : 0
            });
            
            return data;
            
        } catch (error) {
            this.logger.error(`文件解析失败: ${file.name}`, error);
            throw new Error(`解析文件 "${file.name}" 时出错: ${error.message}`);
        }
    }

    /**
     * 验证文件
     * @param {File} file - 要验证的文件
     */
    validateFile(file) {
        // 检查文件是否存在
        if (!file) {
            throw new Error('文件不能为空');
        }

        // 检查文件大小
        if (file.size > this.maxFileSize) {
            throw new Error(`文件大小超过限制 (${this.maxFileSize / 1024 / 1024}MB)`);
        }

        // 检查文件类型
        const fileType = this.getFileType(file);
        if (!fileType) {
            throw new Error(`不支持的文件类型: ${file.type || '未知'}`);
        }

        // 检查文件扩展名
        const extension = this.getFileExtension(file.name);
        if (!['xlsx', 'xls', 'csv'].includes(extension)) {
            throw new Error(`不支持的文件扩展名: .${extension}`);
        }
    }

    /**
     * 获取文件类型
     * @param {File} file - 文件对象
     * @returns {string} 文件类型
     */
    getFileType(file) {
        // 优先使用MIME类型判断
        if (file.type && this.supportedTypes[file.type]) {
            return this.supportedTypes[file.type];
        }
        
        // fallback到文件扩展名判断
        const extension = this.getFileExtension(file.name);
        if (['xlsx', 'xls', 'csv'].includes(extension)) {
            return extension;
        }
        
        return null;
    }

    /**
     * 获取文件扩展名
     * @param {string} fileName - 文件名
     * @returns {string} 扩展名
     */
    getFileExtension(fileName) {
        return fileName.split('.').pop().toLowerCase();
    }

    /**
     * 读取文件为ArrayBuffer
     * @param {File} file - 文件对象
     * @returns {Promise<ArrayBuffer>} ArrayBuffer数据
     */
    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                resolve(event.target.result);
            };
            
            reader.onerror = () => {
                reject(new Error('文件读取失败'));
            };
            
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * 解析Excel文件
     * @param {ArrayBuffer} arrayBuffer - 文件数据
     * @returns {Array} 解析后的数据
     */
    parseExcelFile(arrayBuffer) {
        try {
            // 使用最保守的解析方式，完全避免任何自动转换
            const workbook = XLSX.read(arrayBuffer, { 
                type: 'array',
                cellDates: false,    // 禁用自动日期转换
                cellNF: false,      // 禁用数字格式化
                cellText: true,     // 强制文本模式
                raw: false,         // 禁用原始值
                dateNF: '@',        // 强制日期为文本
                cellStyles: false,  // 禁用样式解析
                sheetStubs: true    // 包含空单元格
            });
            
            // 获取第一个工作表
            const sheetName = workbook.SheetNames[0];
            if (!sheetName) {
                throw new Error('Excel文件中没有找到工作表');
            }
            
            const worksheet = workbook.Sheets[sheetName];
            
            // 使用最原始的CSV转换方式
            const csvData = XLSX.utils.sheet_to_csv(worksheet, { FS: '\t' });
            const rawData = this.parseCSVText(csvData);
            
            // 完全不处理数据格式，直接返回
            return this.processRawDataWithoutFormatting(rawData);
            
        } catch (error) {
            throw new Error(`Excel文件解析失败: ${error.message}`);
        }
    }

    /**
     * 解析CSV文本为数组格式
     * @param {string} csvText - CSV文本
     * @returns {Array} 数据数组
     */
    parseCSVText(csvText) {
        const lines = csvText.split('\n');
        const data = [];
        
        for (const line of lines) {
            if (line.trim()) {
                // 使用制表符分割，保持最原始的格式
                const row = line.split('\t');
                data.push(row);
            }
        }
        
        return data;
    }

    /**
     * 处理原始数据但不进行任何格式转换
     * @param {Array} rawData - 原始数据
     * @returns {Array} 处理后的数据
     */
    processRawDataWithoutFormatting(rawData) {
        if (!rawData || rawData.length === 0) {
            return [];
        }
        
        // 获取表头
        const headers = rawData[0];
        if (!headers || headers.length === 0) {
            throw new Error('Excel文件没有有效的表头');
        }
        
        // 分析每列的数据，过滤掉完全空的列
        const nonEmptyColumnIndices = this.findNonEmptyColumns(rawData);
        
        // 只保留非空列的表头
        const filteredHeaders = nonEmptyColumnIndices.map(index => headers[index]);
        
        // 清理表头（去除空值和重复值）
        const cleanHeaders = this.cleanHeaders(filteredHeaders);
        
        // 转换数据行，但不进行任何格式化
        const dataRows = rawData.slice(1);
        const processedData = [];
        
        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            if (this.isEmptyRow(row)) {
                continue; // 跳过空行
            }
            
            const rowObject = {};
            for (let j = 0; j < cleanHeaders.length; j++) {
                const header = cleanHeaders[j];
                const originalColumnIndex = nonEmptyColumnIndices[j];
                const value = row[originalColumnIndex];
                // 完全不进行格式化，保持原始字符串
                rowObject[header] = value ? value.toString().trim() : '';
            }
            
            processedData.push(rowObject);
        }
        
        return processedData;
    }

    /**
     * 专门处理.xls文件的单元格值提取
     * @param {Object} cell - 单元格对象
     * @param {number} rowNum - 行号
     * @param {number} colNum - 列号
     * @returns {string} 单元格值
     */
    extractCellValueForXLS(cell, rowNum, colNum) {
        // 优先使用原始格式化文本
        if (cell.w !== undefined) {
            return cell.w;
        }
        
        // 对于没有w属性的情况，检查数据类型
        if (cell.v !== undefined) {
            // 检查是否是被误解析为日期的数据
            if (cell.t === 'd' || cell.v instanceof Date) {
                // 这可能是被误解析的分数或百分比
                return this.recoverOriginalFormat(cell);
            }
            
            // 对于数值类型，检查是否可能是分数
            if (cell.t === 'n' && typeof cell.v === 'number') {
                return this.detectAndFormatFraction(cell.v, cell);
            }
            
            return cell.v.toString();
        }
        
        return '';
    }

    /**
     * 尝试恢复被误解析为日期的原始格式
     * @param {Object} cell - 单元格对象
     * @returns {string} 恢复的原始格式
     */
    recoverOriginalFormat(cell) {
        const value = cell.v;
        
        if (value instanceof Date) {
            // 检查Excel序列号，判断是否可能是分数
            const excelSerialNumber = (value.getTime() - new Date(1900, 0, 1).getTime()) / (24 * 60 * 60 * 1000) + 1;
            
            // 如果序列号很小，可能是分数被误解析
            if (excelSerialNumber > 0 && excelSerialNumber < 1) {
                // 尝试转换为分数格式
                return this.convertDecimalToFraction(excelSerialNumber);
            }
            
            // 如果是2000-2100年之间的日期，可能是真正的日期
            const year = value.getFullYear();
            if (year >= 2000 && year <= 2100) {
                return value.toISOString().split('T')[0];
            }
        }
        
        return value.toString();
    }

    /**
     * 检测并格式化可能的分数
     * @param {number} numValue - 数值
     * @param {Object} cell - 单元格对象
     * @returns {string} 格式化后的值
     */
    detectAndFormatFraction(numValue, cell) {
        // 如果有格式化文本且看起来像分数，直接使用
        if (cell.w && /^\d+\/\d+$/.test(cell.w)) {
            return cell.w;
        }
        
        // 如果是小于1的小数，可能是分数的小数形式
        if (numValue > 0 && numValue < 1) {
            const fraction = this.convertDecimalToFraction(numValue);
            if (fraction !== numValue.toString()) {
                return fraction;
            }
        }
        
        // 如果是百分比范围的小数
        if (numValue > 0 && numValue < 0.1) {
            return (numValue * 100).toFixed(2) + '%';
        }
        
        return numValue.toString();
    }

    /**
     * 将小数转换为分数格式
     * @param {number} decimal - 小数值
     * @returns {string} 分数格式或原始值
     */
    convertDecimalToFraction(decimal) {
        // 常见分数的小数对照表
        const commonFractions = {
            0.5: '1/2',
            0.333333: '1/3',
            0.666667: '2/3',
            0.25: '1/4',
            0.75: '3/4',
            0.2: '1/5',
            0.4: '2/5',
            0.6: '3/5',
            0.8: '4/5',
            0.166667: '1/6',
            0.833333: '5/6'
        };
        
        // 检查是否匹配常见分数（允许一定误差）
        for (const [dec, fraction] of Object.entries(commonFractions)) {
            if (Math.abs(decimal - parseFloat(dec)) < 0.001) {
                return fraction;
            }
        }
        
        // 尝试其他分数转换
        for (let denominator = 2; denominator <= 100; denominator++) {
            for (let numerator = 1; numerator < denominator; numerator++) {
                const fractionValue = numerator / denominator;
                if (Math.abs(decimal - fractionValue) < 0.001) {
                    return `${numerator}/${denominator}`;
                }
            }
        }
        
        return decimal.toString();
    }

    /**
     * 处理Excel数据格式
     * @param {Array} rawData - 原始数据
     * @returns {Array} 处理后的数据
     */
    processExcelData(rawData) {
        if (!rawData || rawData.length === 0) {
            return [];
        }
        
        // 获取表头
        const headers = rawData[0];
        if (!headers || headers.length === 0) {
            throw new Error('Excel文件没有有效的表头');
        }
        
        // 清理表头（去除空值和重复值）
        const cleanHeaders = this.cleanHeaders(headers);
        
        // 转换数据行
        const dataRows = rawData.slice(1);
        const processedData = [];
        
        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            if (this.isEmptyRow(row)) {
                continue; // 跳过空行
            }
            
            const rowObject = {};
            for (let j = 0; j < cleanHeaders.length; j++) {
                const header = cleanHeaders[j];
                const value = row[j];
                // 基于列名判断是否为日期列
                const isDateColumn = this.isLikelyDateColumn(header);
                rowObject[header] = this.formatCellValue(value, isDateColumn);
            }
            
            processedData.push(rowObject);
        }
        
        return processedData;
    }

    /**
     * 解析CSV文件
     * @param {ArrayBuffer} arrayBuffer - 文件数据
     * @returns {Array} 解析后的数据
     */
    parseCsvFile(arrayBuffer) {
        try {
            // 将ArrayBuffer转换为字符串
            const decoder = new TextDecoder('utf-8');
            let csvText = decoder.decode(arrayBuffer);
            
            // 尝试检测编码，如果是乱码则尝试GBK
            if (this.containsGarbledText(csvText)) {
                const gbkDecoder = new TextDecoder('gbk');
                csvText = gbkDecoder.decode(arrayBuffer);
            }
            
            // 直接解析CSV文本，不使用XLSX库
            const rawData = this.parseCSVTextDirect(csvText);
            
            return this.processRawDataWithoutFormatting(rawData);
            
        } catch (error) {
            throw new Error(`CSV文件解析失败: ${error.message}`);
        }
    }

    /**
     * 直接解析CSV文本，不依赖XLSX库
     * @param {string} csvText - CSV文本
     * @returns {Array} 数据数组
     */
    parseCSVTextDirect(csvText) {
        const lines = csvText.split('\n');
        const data = [];
        
        for (const line of lines) {
            if (line.trim()) {
                // 简单的CSV解析，处理逗号分隔
                const row = this.parseCSVLine(line);
                data.push(row);
            }
        }
        
        return data;
    }

    /**
     * 解析CSV行，处理引号和转义
     * @param {string} line - CSV行
     * @returns {Array} 行数据
     */
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current.trim());
        return result;
    }

    /**
     * 检测文本是否包含乱码
     * @param {string} text - 文本内容
     * @returns {boolean} 是否包含乱码
     */
    containsGarbledText(text) {
        // 简单的乱码检测：包含大量问号或特殊字符
        const garbledPattern = /[��]/g;
        const matches = text.match(garbledPattern);
        return matches && matches.length > 10;
    }

    /**
     * 清理表头
     * @param {Array} headers - 原始表头
     * @returns {Array} 清理后的表头
     */
    cleanHeaders(headers) {
        const cleanHeaders = [];
        const usedHeaders = new Set();
        
        for (let i = 0; i < headers.length; i++) {
            let header = headers[i];
            
            // 处理空表头
            if (!header || header.toString().trim() === '') {
                header = `Column_${i + 1}`;
            } else {
                header = header.toString().trim();
            }
            
            // 处理重复表头
            let finalHeader = header;
            let counter = 1;
            while (usedHeaders.has(finalHeader)) {
                finalHeader = `${header}_${counter}`;
                counter++;
            }
            
            usedHeaders.add(finalHeader);
            cleanHeaders.push(finalHeader);
        }
        
        return cleanHeaders;
    }

    /**
     * 检查是否为空行
     * @param {Array} row - 数据行
     * @returns {boolean} 是否为空行
     */
    isEmptyRow(row) {
        if (!row || row.length === 0) {
            return true;
        }
        
        return row.every(cell => 
            cell === null || 
            cell === undefined || 
            cell.toString().trim() === ''
        );
    }

    /**
     * 查找非空列的索引
     * @param {Array} rawData - 原始数据
     * @returns {Array} 非空列索引数组
     */
    findNonEmptyColumns(rawData) {
        if (!rawData || rawData.length === 0) {
            return [];
        }
        
        const maxColumns = Math.max(...rawData.map(row => row.length));
        const nonEmptyIndices = [];
        
        for (let colIndex = 0; colIndex < maxColumns; colIndex++) {
            let hasNonEmptyData = false;
            
            // 检查表头是否非空
            const header = rawData[0] && rawData[0][colIndex];
            if (header && header.toString().trim() !== '') {
                hasNonEmptyData = true;
            }
            
            // 检查数据行是否有非空内容
            if (!hasNonEmptyData) {
                for (let rowIndex = 1; rowIndex < rawData.length; rowIndex++) {
                    const cell = rawData[rowIndex] && rawData[rowIndex][colIndex];
                    if (cell && cell.toString().trim() !== '') {
                        hasNonEmptyData = true;
                        break;
                    }
                }
            }
            
            if (hasNonEmptyData) {
                nonEmptyIndices.push(colIndex);
            }
        }
        
        return nonEmptyIndices;
    }

    /**
     * 判断列名是否可能是日期列
     * @param {string} header - 列名
     * @returns {boolean} 是否为日期列
     */
    isLikelyDateColumn(header) {
        if (!header) return false;
        
        const lowerHeader = header.toLowerCase();
        const dateKeywords = [
            '日期', '时间', '投放日期', '报告日期', '统计日期', '创建时间', '更新时间',
            'date', 'time', 'created', 'updated', 'report', 'stat'
        ];
        
        return dateKeywords.some(keyword => lowerHeader.includes(keyword));
    }

    /**
     * 格式化单元格值
     * @param {any} value - 单元格值
     * @param {boolean} isDateColumn - 是否为日期列
     * @returns {any} 格式化后的值
     */
    formatCellValue(value, isDateColumn = false) {
        if (value === null || value === undefined) {
            return '';
        }
        
        // 处理字符串
        const stringValue = value.toString().trim();
        
        // 如果是空值，直接返回
        if (stringValue === '') {
            return '';
        }
        
        // 只对明确指定的日期列进行日期转换
        if (isDateColumn) {
            // 尝试转换为日期
            const dateValidation = this.validator.validateDate(stringValue);
            if (dateValidation.isValid) {
                return dateValidation.parsedDate.toISOString().split('T')[0];
            }
        }
        
        // 对于非日期列，保持Excel显示的原始格式
        // 现在我们直接获取了Excel的显示文本，所以直接返回即可
        
        // 检查是否为纯数字字符串（但不包含百分比和分数格式）
        if (/^\d+\.?\d*$/.test(stringValue) && !stringValue.includes('%') && !stringValue.includes('/')) {
            const numValue = parseFloat(stringValue);
            if (!isNaN(numValue)) {
                return numValue;
            }
        }
        
        // 保持原始文本格式，包括百分比、分数等Excel显示的内容
        return stringValue;
    }

    /**
     * 验证解析后的数据
     * @param {Array} data - 解析后的数据
     */
    validateParsedData(data) {
        if (!Array.isArray(data)) {
            throw new Error('解析结果必须是数组');
        }
        
        if (data.length === 0) {
            throw new Error('文件中没有有效数据');
        }
        
        // 检查数据量限制
        const maxRows = 100000; // 10万行限制
        if (data.length > maxRows) {
            throw new Error(`数据行数超过限制 (${maxRows.toLocaleString()}行)`);
        }
        
        // 检查第一行是否有有效字段
        const firstRow = data[0];
        if (!firstRow || typeof firstRow !== 'object') {
            throw new Error('数据格式不正确');
        }
        
        const validFields = Object.keys(firstRow).filter(key => 
            key && key.trim() !== ''
        );
        
        if (validFields.length === 0) {
            throw new Error('没有找到有效的数据字段');
        }
    }

    /**
     * 获取文件信息摘要
     * @param {File} file - 文件对象
     * @param {Array} data - 解析后的数据
     * @returns {Object} 文件信息摘要
     */
    getFileSummary(file, data) {
        const summary = {
            fileName: file.name,
            fileSize: file.size,
            fileType: this.getFileType(file),
            records: data.length,
            columns: data.length > 0 ? Object.keys(data[0]).length : 0,
            columnsNames: data.length > 0 ? Object.keys(data[0]) : [],
            lastModified: new Date(file.lastModified).toISOString()
        };
        
        return summary;
    }
} 