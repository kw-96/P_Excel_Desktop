/**
 * 数据解析Worker - 在独立进程中解析大文件
 */

const { parentPort, workerData } = require('worker_threads');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

class DataParserWorker {
    constructor() {
        this.isProcessing = false;
        this.setupMessageHandlers();
    }

    /**
     * 设置消息处理器
     */
    setupMessageHandlers() {
        if (parentPort) {
            parentPort.on('message', async (message) => {
                try {
                    await this.handleMessage(message);
                } catch (error) {
                    this.sendError(error, message.id);
                }
            });
        }
    }

    /**
     * 处理消息
     */
    async handleMessage(message) {
        const { type, id, data } = message;

        switch (type) {
            case 'parse-excel':
                await this.parseExcelFile(data, id);
                break;
            case 'parse-csv':
                await this.parseCSVFile(data, id);
                break;
            case 'parse-chunk':
                await this.parseDataChunk(data, id);
                break;
            case 'validate-file':
                await this.validateFile(data, id);
                break;
            case 'get-file-info':
                await this.getFileInfo(data, id);
                break;
            default:
                throw new Error(`未知的消息类型: ${type}`);
        }
    }

    /**
     * 解析Excel文件
     */
    async parseExcelFile(data, messageId) {
        const { filePath, options = {} } = data;
        
        try {
            this.isProcessing = true;
            this.sendProgress({ stage: 'reading', progress: 0 }, messageId);

            // 读取Excel文件
            const workbook = xlsx.readFile(filePath, {
                cellDates: true,
                cellNF: false,
                cellText: false,
                sheetStubs: false
            });

            this.sendProgress({ stage: 'parsing', progress: 25 }, messageId);

            // 获取工作表信息
            const sheetNames = workbook.SheetNames;
            const results = {};

            for (let i = 0; i < sheetNames.length; i++) {
                const sheetName = sheetNames[i];
                const worksheet = workbook.Sheets[sheetName];

                // 解析工作表数据
                const sheetData = await this.parseWorksheet(worksheet, {
                    ...options,
                    sheetName,
                    onProgress: (progress) => {
                        const totalProgress = 25 + (progress / sheetNames.length) * 70;
                        this.sendProgress({ 
                            stage: 'parsing', 
                            progress: totalProgress,
                            currentSheet: sheetName,
                            sheetIndex: i + 1,
                            totalSheets: sheetNames.length
                        }, messageId);
                    }
                });

                results[sheetName] = sheetData;
            }

            this.sendProgress({ stage: 'complete', progress: 100 }, messageId);

            // 发送结果
            this.sendResult({
                success: true,
                data: results,
                metadata: {
                    fileName: path.basename(filePath),
                    fileSize: fs.statSync(filePath).size,
                    sheetCount: sheetNames.length,
                    totalRows: Object.values(results).reduce((sum, sheet) => sum + sheet.data.length, 0)
                }
            }, messageId);

        } catch (error) {
            this.sendError(error, messageId);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * 解析工作表
     */
    async parseWorksheet(worksheet, options = {}) {
        const {
            startRow = 0,
            endRow = null,
            columns = null,
            onProgress = null
        } = options;

        try {
            // 获取数据范围
            const range = xlsx.utils.decode_range(worksheet['!ref'] || 'A1:A1');
            const totalRows = range.e.r - range.s.r + 1;
            
            // 获取表头
            const headers = [];
            for (let col = range.s.c; col <= range.e.c; col++) {
                const cellAddress = xlsx.utils.encode_cell({ r: range.s.r, c: col });
                const cell = worksheet[cellAddress];
                headers.push(cell ? String(cell.v) : `Column${col + 1}`);
            }

            // 筛选需要的列
            const selectedColumns = columns ? 
                headers.filter(header => columns.includes(header)) : 
                headers;

            const data = [];
            const actualStartRow = Math.max(startRow, range.s.r + 1); // 跳过表头
            const actualEndRow = endRow ? Math.min(endRow, range.e.r) : range.e.r;

            // 逐行解析数据
            for (let row = actualStartRow; row <= actualEndRow; row++) {
                const rowData = {};
                
                for (let col = range.s.c; col <= range.e.c; col++) {
                    const header = headers[col - range.s.c];
                    
                    // 如果指定了列筛选，跳过不需要的列
                    if (columns && !columns.includes(header)) {
                        continue;
                    }

                    const cellAddress = xlsx.utils.encode_cell({ r: row, c: col });
                    const cell = worksheet[cellAddress];
                    
                    // 处理不同类型的单元格值
                    let value = null;
                    if (cell) {
                        if (cell.t === 'd') {
                            // 日期类型
                            value = cell.v;
                        } else if (cell.t === 'n') {
                            // 数字类型
                            value = cell.v;
                        } else if (cell.t === 'b') {
                            // 布尔类型
                            value = cell.v;
                        } else {
                            // 文本类型
                            value = String(cell.v);
                        }
                    }
                    
                    rowData[header] = value;
                }

                data.push(rowData);

                // 报告进度
                if (onProgress && (row - actualStartRow) % 1000 === 0) {
                    const progress = ((row - actualStartRow + 1) / (actualEndRow - actualStartRow + 1)) * 100;
                    onProgress(progress);
                }

                // 让出控制权，避免阻塞
                if ((row - actualStartRow) % 10000 === 0) {
                    await new Promise(resolve => setImmediate(resolve));
                }
            }

            return {
                data,
                headers: selectedColumns,
                totalRows: data.length,
                range: {
                    startRow: actualStartRow,
                    endRow: actualEndRow,
                    startCol: range.s.c,
                    endCol: range.e.c
                }
            };

        } catch (error) {
            console.error('解析工作表失败:', error);
            throw error;
        }
    }

    /**
     * 解析CSV文件
     */
    async parseCSVFile(data, messageId) {
        const { filePath, options = {} } = data;
        
        try {
            this.isProcessing = true;
            this.sendProgress({ stage: 'reading', progress: 0 }, messageId);

            const {
                delimiter = ',',
                encoding = 'utf8',
                skipEmptyLines = true,
                maxRows = null
            } = options;

            // 读取文件内容
            const fileContent = fs.readFileSync(filePath, encoding);
            const lines = fileContent.split('\n').filter(line => 
                !skipEmptyLines || line.trim() !== ''
            );

            this.sendProgress({ stage: 'parsing', progress: 25 }, messageId);

            if (lines.length === 0) {
                throw new Error('CSV文件为空');
            }

            // 解析表头
            const headers = lines[0].split(delimiter).map(header => header.trim().replace(/^"|"$/g, ''));
            
            // 解析数据行
            const data = [];
            const totalLines = maxRows ? Math.min(lines.length - 1, maxRows) : lines.length - 1;

            for (let i = 1; i <= totalLines; i++) {
                const line = lines[i];
                if (!line || line.trim() === '') continue;

                const values = this.parseCSVLine(line, delimiter);
                const rowData = {};

                headers.forEach((header, index) => {
                    const value = values[index] || null;
                    rowData[header] = this.parseCSVValue(value);
                });

                data.push(rowData);

                // 报告进度
                if (i % 1000 === 0) {
                    const progress = 25 + (i / totalLines) * 70;
                    this.sendProgress({ 
                        stage: 'parsing', 
                        progress,
                        processedRows: i,
                        totalRows: totalLines
                    }, messageId);
                }

                // 让出控制权
                if (i % 10000 === 0) {
                    await new Promise(resolve => setImmediate(resolve));
                }
            }

            this.sendProgress({ stage: 'complete', progress: 100 }, messageId);

            // 发送结果
            this.sendResult({
                success: true,
                data: {
                    'Sheet1': {
                        data,
                        headers,
                        totalRows: data.length
                    }
                },
                metadata: {
                    fileName: path.basename(filePath),
                    fileSize: fs.statSync(filePath).size,
                    sheetCount: 1,
                    totalRows: data.length
                }
            }, messageId);

        } catch (error) {
            this.sendError(error, messageId);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * 解析CSV行
     */
    parseCSVLine(line, delimiter) {
        const values = [];
        let current = '';
        let inQuotes = false;
        let i = 0;

        while (i < line.length) {
            const char = line[i];
            const nextChar = line[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    // 转义的引号
                    current += '"';
                    i += 2;
                } else {
                    // 开始或结束引号
                    inQuotes = !inQuotes;
                    i++;
                }
            } else if (char === delimiter && !inQuotes) {
                // 字段分隔符
                values.push(current);
                current = '';
                i++;
            } else {
                current += char;
                i++;
            }
        }

        // 添加最后一个字段
        values.push(current);

        return values;
    }

    /**
     * 解析CSV值
     */
    parseCSVValue(value) {
        if (!value || value === '') {
            return null;
        }

        // 移除首尾引号
        const trimmed = value.trim().replace(/^"|"$/g, '');

        // 尝试解析为数字
        if (/^-?\d+\.?\d*$/.test(trimmed)) {
            const num = Number(trimmed);
            return isNaN(num) ? trimmed : num;
        }

        // 尝试解析为布尔值
        if (trimmed.toLowerCase() === 'true') return true;
        if (trimmed.toLowerCase() === 'false') return false;

        // 尝试解析为日期
        if (this.isDateString(trimmed)) {
            const date = new Date(trimmed);
            return isNaN(date.getTime()) ? trimmed : date;
        }

        return trimmed;
    }

    /**
     * 检查是否是日期字符串
     */
    isDateString(str) {
        const datePatterns = [
            /^\d{4}-\d{2}-\d{2}$/,
            /^\d{4}\/\d{2}\/\d{2}$/,
            /^\d{2}\/\d{2}\/\d{4}$/,
            /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/
        ];

        return datePatterns.some(pattern => pattern.test(str));
    }

    /**
     * 解析数据块
     */
    async parseDataChunk(data, messageId) {
        const { chunk, format, options = {} } = data;
        
        try {
            this.sendProgress({ stage: 'processing', progress: 0 }, messageId);

            let result;
            if (format === 'excel') {
                result = await this.parseExcelChunk(chunk, options);
            } else if (format === 'csv') {
                result = await this.parseCSVChunk(chunk, options);
            } else {
                throw new Error(`不支持的格式: ${format}`);
            }

            this.sendProgress({ stage: 'complete', progress: 100 }, messageId);
            this.sendResult({ success: true, data: result }, messageId);

        } catch (error) {
            this.sendError(error, messageId);
        }
    }

    /**
     * 验证文件
     */
    async validateFile(data, messageId) {
        const { filePath } = data;
        
        try {
            // 检查文件是否存在
            if (!fs.existsSync(filePath)) {
                throw new Error('文件不存在');
            }

            // 获取文件信息
            const stats = fs.statSync(filePath);
            const fileExt = path.extname(filePath).toLowerCase();

            // 检查文件格式
            const supportedFormats = ['.xlsx', '.xls', '.csv'];
            if (!supportedFormats.includes(fileExt)) {
                throw new Error(`不支持的文件格式: ${fileExt}`);
            }

            // 检查文件大小
            const maxSize = 10 * 1024 * 1024 * 1024; // 10GB
            if (stats.size > maxSize) {
                throw new Error(`文件过大: ${this.formatBytes(stats.size)}`);
            }

            // 尝试读取文件头部验证格式
            let isValid = false;
            if (fileExt === '.csv') {
                isValid = await this.validateCSVFile(filePath);
            } else {
                isValid = await this.validateExcelFile(filePath);
            }

            this.sendResult({
                success: true,
                valid: isValid,
                fileInfo: {
                    name: path.basename(filePath),
                    size: stats.size,
                    format: fileExt,
                    modified: stats.mtime
                }
            }, messageId);

        } catch (error) {
            this.sendError(error, messageId);
        }
    }

    /**
     * 验证CSV文件
     */
    async validateCSVFile(filePath) {
        try {
            const buffer = fs.readFileSync(filePath, { encoding: 'utf8', flag: 'r' });
            const firstLine = buffer.split('\n')[0];
            return firstLine && firstLine.trim().length > 0;
        } catch (error) {
            return false;
        }
    }

    /**
     * 验证Excel文件
     */
    async validateExcelFile(filePath) {
        try {
            const workbook = xlsx.readFile(filePath, { bookSheets: true });
            return workbook && workbook.SheetNames && workbook.SheetNames.length > 0;
        } catch (error) {
            return false;
        }
    }

    /**
     * 获取文件信息
     */
    async getFileInfo(data, messageId) {
        const { filePath } = data;
        
        try {
            const stats = fs.statSync(filePath);
            const fileExt = path.extname(filePath).toLowerCase();
            
            let fileInfo = {
                name: path.basename(filePath),
                size: stats.size,
                format: fileExt,
                modified: stats.mtime,
                sheets: []
            };

            if (fileExt === '.csv') {
                // CSV文件信息
                const content = fs.readFileSync(filePath, 'utf8');
                const lines = content.split('\n').filter(line => line.trim());
                const headers = lines[0] ? lines[0].split(',').length : 0;
                
                fileInfo.sheets = [{
                    name: 'Sheet1',
                    rows: lines.length - 1,
                    columns: headers
                }];
            } else {
                // Excel文件信息
                const workbook = xlsx.readFile(filePath, { bookSheets: true });
                
                fileInfo.sheets = workbook.SheetNames.map(sheetName => {
                    const worksheet = workbook.Sheets[sheetName];
                    const range = xlsx.utils.decode_range(worksheet['!ref'] || 'A1:A1');
                    
                    return {
                        name: sheetName,
                        rows: range.e.r - range.s.r,
                        columns: range.e.c - range.s.c + 1
                    };
                });
            }

            this.sendResult({ success: true, data: fileInfo }, messageId);

        } catch (error) {
            this.sendError(error, messageId);
        }
    }

    /**
     * 发送进度更新
     */
    sendProgress(progress, messageId) {
        if (parentPort) {
            parentPort.postMessage({
                type: 'progress',
                id: messageId,
                data: progress
            });
        }
    }

    /**
     * 发送结果
     */
    sendResult(result, messageId) {
        if (parentPort) {
            parentPort.postMessage({
                type: 'result',
                id: messageId,
                data: result
            });
        }
    }

    /**
     * 发送错误
     */
    sendError(error, messageId) {
        if (parentPort) {
            parentPort.postMessage({
                type: 'error',
                id: messageId,
                data: {
                    message: error.message,
                    stack: error.stack
                }
            });
        }
    }

    /**
     * 格式化字节数
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// 创建Worker实例
const worker = new DataParserWorker();

// 发送就绪信号
if (parentPort) {
    parentPort.postMessage({
        type: 'ready',
        data: {
            workerId: workerData?.workerId || 'unknown',
            timestamp: Date.now()
        }
    });
}