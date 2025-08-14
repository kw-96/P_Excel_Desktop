/**
 * 流式数据处理器 - 处理大文件的分块读取和流式处理
 */

const fs = require('fs');
const { Transform, Readable, Writable } = require('stream');
const { pipeline } = require('stream/promises');
const EventEmitter = require('events');
const xlsx = require('xlsx');
const csv = require('csv-parser');

class StreamProcessor extends EventEmitter {
    constructor(options = {}) {
        super();
        this.options = {
            chunkSize: options.chunkSize || 100000, // 10万行
            memoryLimit: options.memoryLimit || 4 * 1024 * 1024 * 1024, // 4GB
            enableCompression: options.enableCompression || true,
            ...options
        };
        this.currentMemoryUsage = 0;
        this.processedRows = 0;
        this.totalRows = 0;
    }

    /**
     * 流式读取Excel文件
     */
    async streamReadExcel(filePath, options = {}) {
        const {
            sheetName = null,
            startRow = 0,
            endRow = null,
            onProgress = null
        } = options;

        try {
            // 读取Excel文件
            const workbook = xlsx.readFile(filePath, { 
                cellDates: true,
                cellNF: false,
                cellText: false
            });

            const worksheet = sheetName ? 
                workbook.Sheets[sheetName] : 
                workbook.Sheets[workbook.SheetNames[0]];

            if (!worksheet) {
                throw new Error(`工作表不存在: ${sheetName || workbook.SheetNames[0]}`);
            }

            // 获取数据范围
            const range = xlsx.utils.decode_range(worksheet['!ref']);
            this.totalRows = range.e.r - range.s.r + 1;

            // 创建流式读取器
            const stream = new Readable({
                objectMode: true,
                read() {}
            });

            // 分块处理数据
            const actualStartRow = Math.max(startRow, range.s.r);
            const actualEndRow = endRow ? Math.min(endRow, range.e.r) : range.e.r;
            
            this.processExcelInChunks(worksheet, range, actualStartRow, actualEndRow, stream, onProgress);

            return stream;

        } catch (error) {
            console.error('流式读取Excel失败:', error);
            throw error;
        }
    }

    /**
     * 分块处理Excel数据
     */
    async processExcelInChunks(worksheet, range, startRow, endRow, stream, onProgress) {
        try {
            const chunkSize = this.options.chunkSize;
            let currentRow = startRow;

            // 获取表头
            const headers = [];
            for (let col = range.s.c; col <= range.e.c; col++) {
                const cellAddress = xlsx.utils.encode_cell({ r: range.s.r, c: col });
                const cell = worksheet[cellAddress];
                headers.push(cell ? cell.v : `Column${col + 1}`);
            }

            while (currentRow <= endRow) {
                const chunkEndRow = Math.min(currentRow + chunkSize - 1, endRow);
                const chunk = [];

                // 读取当前块的数据
                for (let row = currentRow; row <= chunkEndRow; row++) {
                    const rowData = {};
                    for (let col = range.s.c; col <= range.e.c; col++) {
                        const cellAddress = xlsx.utils.encode_cell({ r: row, c: col });
                        const cell = worksheet[cellAddress];
                        const header = headers[col - range.s.c];
                        rowData[header] = cell ? cell.v : null;
                    }
                    chunk.push(rowData);
                }

                // 检查内存使用
                await this.checkMemoryUsage();

                // 发送数据块
                stream.push({
                    type: 'data',
                    chunk: chunk,
                    startRow: currentRow,
                    endRow: chunkEndRow,
                    headers: headers
                });

                this.processedRows += chunk.length;

                // 报告进度
                if (onProgress) {
                    onProgress({
                        processedRows: this.processedRows,
                        totalRows: this.totalRows,
                        progress: Math.round((this.processedRows / this.totalRows) * 100)
                    });
                }

                // 发出进度事件
                this.emit('progress', {
                    processedRows: this.processedRows,
                    totalRows: this.totalRows,
                    progress: Math.round((this.processedRows / this.totalRows) * 100)
                });

                currentRow = chunkEndRow + 1;

                // 让出控制权，避免阻塞
                await new Promise(resolve => setImmediate(resolve));
            }

            // 结束流
            stream.push(null);

        } catch (error) {
            stream.destroy(error);
        }
    }

    /**
     * 流式读取CSV文件
     */
    async streamReadCSV(filePath, options = {}) {
        const {
            delimiter = ',',
            encoding = 'utf8',
            skipEmptyLines = true,
            onProgress = null
        } = options;

        try {
            // 获取文件大小
            const stats = await fs.promises.stat(filePath);
            const fileSize = stats.size;
            let processedBytes = 0;

            // 创建读取流
            const readStream = fs.createReadStream(filePath, { encoding });
            
            // 创建CSV解析流
            const csvStream = csv({
                separator: delimiter,
                skipEmptyLines: skipEmptyLines
            });

            // 创建数据处理流
            const processStream = new Transform({
                objectMode: true,
                transform(chunk, encoding, callback) {
                    processedBytes += Buffer.byteLength(JSON.stringify(chunk));
                    
                    // 报告进度
                    if (onProgress) {
                        onProgress({
                            processedBytes,
                            totalBytes: fileSize,
                            progress: Math.round((processedBytes / fileSize) * 100)
                        });
                    }

                    this.push(chunk);
                    callback();
                }
            });

            // 创建管道
            const stream = pipeline(readStream, csvStream, processStream);
            
            return processStream;

        } catch (error) {
            console.error('流式读取CSV失败:', error);
            throw error;
        }
    }

    /**
     * 流式筛选数据
     */
    createFilterStream(conditions) {
        return new Transform({
            objectMode: true,
            transform(chunk, encoding, callback) {
                try {
                    if (chunk.type === 'data') {
                        const filteredChunk = chunk.chunk.filter(row => 
                            this.evaluateConditions(row, conditions)
                        );
                        
                        if (filteredChunk.length > 0) {
                            this.push({
                                ...chunk,
                                chunk: filteredChunk
                            });
                        }
                    } else {
                        this.push(chunk);
                    }
                    callback();
                } catch (error) {
                    callback(error);
                }
            },

            evaluateConditions(row, conditions) {
                return conditions.every(condition => {
                    const { column, operator, value } = condition;
                    const cellValue = row[column];

                    switch (operator) {
                        case 'equals':
                            return cellValue == value;
                        case 'not_equals':
                            return cellValue != value;
                        case 'greater_than':
                            return Number(cellValue) > Number(value);
                        case 'less_than':
                            return Number(cellValue) < Number(value);
                        case 'contains':
                            return String(cellValue).includes(String(value));
                        case 'starts_with':
                            return String(cellValue).startsWith(String(value));
                        case 'ends_with':
                            return String(cellValue).endsWith(String(value));
                        case 'is_empty':
                            return !cellValue || cellValue === '';
                        case 'is_not_empty':
                            return cellValue && cellValue !== '';
                        default:
                            return true;
                    }
                });
            }
        });
    }

    /**
     * 流式排序数据
     */
    createSortStream(sortColumns) {
        const chunks = [];
        
        return new Transform({
            objectMode: true,
            transform(chunk, encoding, callback) {
                if (chunk.type === 'data') {
                    chunks.push(chunk);
                }
                callback();
            },
            
            flush(callback) {
                try {
                    // 合并所有数据块
                    const allData = chunks.reduce((acc, chunk) => {
                        return acc.concat(chunk.chunk);
                    }, []);

                    // 排序数据
                    allData.sort((a, b) => {
                        for (const sort of sortColumns) {
                            const { column, direction = 'asc' } = sort;
                            const aVal = a[column];
                            const bVal = b[column];
                            
                            let comparison = 0;
                            if (aVal < bVal) comparison = -1;
                            else if (aVal > bVal) comparison = 1;
                            
                            if (comparison !== 0) {
                                return direction === 'desc' ? -comparison : comparison;
                            }
                        }
                        return 0;
                    });

                    // 分块输出排序后的数据
                    const chunkSize = this.options?.chunkSize || 100000;
                    for (let i = 0; i < allData.length; i += chunkSize) {
                        const chunk = allData.slice(i, i + chunkSize);
                        this.push({
                            type: 'data',
                            chunk: chunk,
                            startRow: i,
                            endRow: i + chunk.length - 1,
                            headers: chunks[0]?.headers || []
                        });
                    }

                    callback();
                } catch (error) {
                    callback(error);
                }
            }
        });
    }

    /**
     * 流式聚合数据
     */
    createAggregateStream(aggregations, groupBy = []) {
        const groups = new Map();

        return new Transform({
            objectMode: true,
            transform(chunk, encoding, callback) {
                try {
                    if (chunk.type === 'data') {
                        chunk.chunk.forEach(row => {
                            // 生成分组键
                            const groupKey = groupBy.length > 0 ? 
                                groupBy.map(col => row[col]).join('|') : 
                                'all';

                            if (!groups.has(groupKey)) {
                                const groupData = {};
                                groupBy.forEach(col => {
                                    groupData[col] = row[col];
                                });
                                
                                aggregations.forEach(agg => {
                                    groupData[agg.alias || `${agg.function}_${agg.column}`] = 
                                        this.initializeAggregation(agg.function);
                                });
                                
                                groups.set(groupKey, {
                                    data: groupData,
                                    counts: new Map()
                                });
                            }

                            // 更新聚合值
                            const group = groups.get(groupKey);
                            aggregations.forEach(agg => {
                                const alias = agg.alias || `${agg.function}_${agg.column}`;
                                const value = row[agg.column];
                                
                                group.data[alias] = this.updateAggregation(
                                    group.data[alias],
                                    value,
                                    agg.function,
                                    group.counts.get(alias) || 0
                                );
                                
                                group.counts.set(alias, (group.counts.get(alias) || 0) + 1);
                            });
                        });
                    }
                    callback();
                } catch (error) {
                    callback(error);
                }
            },

            flush(callback) {
                try {
                    const result = Array.from(groups.values()).map(group => group.data);
                    
                    this.push({
                        type: 'data',
                        chunk: result,
                        startRow: 0,
                        endRow: result.length - 1,
                        headers: Object.keys(result[0] || {})
                    });

                    callback();
                } catch (error) {
                    callback(error);
                }
            },

            initializeAggregation(func) {
                switch (func) {
                    case 'sum':
                    case 'count':
                        return 0;
                    case 'min':
                        return Infinity;
                    case 'max':
                        return -Infinity;
                    case 'avg':
                        return { sum: 0, count: 0 };
                    default:
                        return null;
                }
            },

            updateAggregation(current, value, func, count) {
                const numValue = Number(value);
                
                switch (func) {
                    case 'sum':
                        return current + (isNaN(numValue) ? 0 : numValue);
                    case 'count':
                        return current + 1;
                    case 'min':
                        return Math.min(current, isNaN(numValue) ? Infinity : numValue);
                    case 'max':
                        return Math.max(current, isNaN(numValue) ? -Infinity : numValue);
                    case 'avg':
                        const newSum = current.sum + (isNaN(numValue) ? 0 : numValue);
                        const newCount = current.count + 1;
                        return { sum: newSum, count: newCount, value: newSum / newCount };
                    default:
                        return current;
                }
            }
        });
    }

    /**
     * 流式写入文件
     */
    createWriteStream(filePath, format = 'csv') {
        if (format === 'csv') {
            return this.createCSVWriteStream(filePath);
        } else if (format === 'excel') {
            return this.createExcelWriteStream(filePath);
        } else {
            throw new Error(`不支持的输出格式: ${format}`);
        }
    }

    /**
     * 创建CSV写入流
     */
    createCSVWriteStream(filePath) {
        const writeStream = fs.createWriteStream(filePath, { encoding: 'utf8' });
        let headerWritten = false;

        return new Writable({
            objectMode: true,
            write(chunk, encoding, callback) {
                try {
                    if (chunk.type === 'data' && chunk.chunk.length > 0) {
                        // 写入表头
                        if (!headerWritten && chunk.headers) {
                            writeStream.write(chunk.headers.join(',') + '\n');
                            headerWritten = true;
                        }

                        // 写入数据行
                        chunk.chunk.forEach(row => {
                            const values = chunk.headers.map(header => {
                                const value = row[header];
                                if (value === null || value === undefined) {
                                    return '';
                                }
                                // 处理包含逗号或引号的值
                                const strValue = String(value);
                                if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
                                    return `"${strValue.replace(/"/g, '""')}"`;
                                }
                                return strValue;
                            });
                            writeStream.write(values.join(',') + '\n');
                        });
                    }
                    callback();
                } catch (error) {
                    callback(error);
                }
            },

            final(callback) {
                writeStream.end();
                callback();
            }
        });
    }

    /**
     * 创建Excel写入流
     */
    createExcelWriteStream(filePath) {
        const chunks = [];

        return new Writable({
            objectMode: true,
            write(chunk, encoding, callback) {
                if (chunk.type === 'data') {
                    chunks.push(chunk);
                }
                callback();
            },

            final(callback) {
                try {
                    // 合并所有数据块
                    const allData = chunks.reduce((acc, chunk) => {
                        return acc.concat(chunk.chunk);
                    }, []);

                    // 创建工作簿
                    const workbook = xlsx.utils.book_new();
                    const worksheet = xlsx.utils.json_to_sheet(allData);
                    xlsx.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

                    // 写入文件
                    xlsx.writeFile(workbook, filePath);
                    callback();
                } catch (error) {
                    callback(error);
                }
            }
        });
    }

    /**
     * 检查内存使用情况
     */
    async checkMemoryUsage() {
        const memoryUsage = process.memoryUsage();
        this.currentMemoryUsage = memoryUsage.heapUsed;

        if (this.currentMemoryUsage > this.options.memoryLimit) {
            // 触发内存警告
            this.emit('memoryWarning', {
                current: this.currentMemoryUsage,
                limit: this.options.memoryLimit,
                usage: (this.currentMemoryUsage / this.options.memoryLimit) * 100
            });

            // 强制垃圾回收
            if (global.gc) {
                global.gc();
            }

            // 等待一段时间让内存释放
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    /**
     * 处理大文件
     */
    async processLargeFile(filePath, operations, outputPath) {
        try {
            const fileExt = filePath.toLowerCase().split('.').pop();
            let sourceStream;

            // 创建源数据流
            if (fileExt === 'csv') {
                sourceStream = await this.streamReadCSV(filePath, {
                    onProgress: (progress) => this.emit('progress', progress)
                });
            } else if (['xlsx', 'xls'].includes(fileExt)) {
                sourceStream = await this.streamReadExcel(filePath, {
                    onProgress: (progress) => this.emit('progress', progress)
                });
            } else {
                throw new Error(`不支持的文件格式: ${fileExt}`);
            }

            // 创建处理流管道
            const streams = [sourceStream];

            // 添加操作流
            operations.forEach(operation => {
                switch (operation.type) {
                    case 'filter':
                        streams.push(this.createFilterStream(operation.conditions));
                        break;
                    case 'sort':
                        streams.push(this.createSortStream(operation.columns));
                        break;
                    case 'aggregate':
                        streams.push(this.createAggregateStream(operation.aggregations, operation.groupBy));
                        break;
                }
            });

            // 添加输出流
            const outputFormat = outputPath.toLowerCase().split('.').pop();
            streams.push(this.createWriteStream(outputPath, outputFormat === 'csv' ? 'csv' : 'excel'));

            // 执行流管道
            await pipeline(...streams);

            this.emit('complete', {
                inputFile: filePath,
                outputFile: outputPath,
                processedRows: this.processedRows
            });

            return {
                success: true,
                inputFile: filePath,
                outputFile: outputPath,
                processedRows: this.processedRows
            };

        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * 获取处理统计信息
     */
    getStats() {
        return {
            processedRows: this.processedRows,
            totalRows: this.totalRows,
            currentMemoryUsage: this.currentMemoryUsage,
            memoryLimit: this.options.memoryLimit,
            progress: this.totalRows > 0 ? Math.round((this.processedRows / this.totalRows) * 100) : 0
        };
    }

    /**
     * 重置统计信息
     */
    reset() {
        this.processedRows = 0;
        this.totalRows = 0;
        this.currentMemoryUsage = 0;
    }
}

module.exports = StreamProcessor;