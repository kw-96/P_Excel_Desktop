/**
 * 数据处理Worker - 在独立进程中处理数据操作
 */

const { parentPort, workerData } = require('worker_threads');

class DataProcessorWorker {
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
            case 'filter-data':
                await this.filterData(data, id);
                break;
            case 'sort-data':
                await this.sortData(data, id);
                break;
            case 'merge-data':
                await this.mergeData(data, id);
                break;
            case 'aggregate-data':
                await this.aggregateData(data, id);
                break;
            case 'transform-data':
                await this.transformData(data, id);
                break;
            case 'calculate-column':
                await this.calculateColumn(data, id);
                break;
            case 'remove-duplicates':
                await this.removeDuplicates(data, id);
                break;
            case 'fill-empty-values':
                await this.fillEmptyValues(data, id);
                break;
            default:
                throw new Error(`未知的消息类型: ${type}`);
        }
    }

    /**
     * 筛选数据
     */
    async filterData(data, messageId) {
        const { dataset, conditions, options = {} } = data;
        
        try {
            this.isProcessing = true;
            this.sendProgress({ stage: 'filtering', progress: 0 }, messageId);

            const result = [];
            const totalRows = dataset.length;
            
            for (let i = 0; i < totalRows; i++) {
                const row = dataset[i];
                
                if (this.evaluateConditions(row, conditions)) {
                    result.push(row);
                }

                // 报告进度
                if (i % 1000 === 0) {
                    const progress = (i / totalRows) * 100;
                    this.sendProgress({ 
                        stage: 'filtering', 
                        progress,
                        processedRows: i + 1,
                        totalRows,
                        matchedRows: result.length
                    }, messageId);
                }

                // 让出控制权
                if (i % 10000 === 0) {
                    await new Promise(resolve => setImmediate(resolve));
                }
            }

            this.sendProgress({ stage: 'complete', progress: 100 }, messageId);
            
            this.sendResult({
                success: true,
                data: result,
                metadata: {
                    originalRows: totalRows,
                    filteredRows: result.length,
                    filterRate: totalRows > 0 ? (result.length / totalRows) * 100 : 0
                }
            }, messageId);

        } catch (error) {
            this.sendError(error, messageId);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * 评估筛选条件
     */
    evaluateConditions(row, conditions) {
        if (!conditions || conditions.length === 0) {
            return true;
        }

        return conditions.every(condition => {
            const { column, operator, value, logicOperator = 'AND' } = condition;
            const cellValue = row[column];

            let result = false;

            switch (operator) {
                case 'equals':
                    result = this.compareValues(cellValue, value, '===');
                    break;
                case 'not_equals':
                    result = this.compareValues(cellValue, value, '!==');
                    break;
                case 'greater_than':
                    result = this.compareValues(cellValue, value, '>');
                    break;
                case 'greater_than_or_equal':
                    result = this.compareValues(cellValue, value, '>=');
                    break;
                case 'less_than':
                    result = this.compareValues(cellValue, value, '<');
                    break;
                case 'less_than_or_equal':
                    result = this.compareValues(cellValue, value, '<=');
                    break;
                case 'contains':
                    result = String(cellValue || '').toLowerCase().includes(String(value || '').toLowerCase());
                    break;
                case 'not_contains':
                    result = !String(cellValue || '').toLowerCase().includes(String(value || '').toLowerCase());
                    break;
                case 'starts_with':
                    result = String(cellValue || '').toLowerCase().startsWith(String(value || '').toLowerCase());
                    break;
                case 'ends_with':
                    result = String(cellValue || '').toLowerCase().endsWith(String(value || '').toLowerCase());
                    break;
                case 'is_empty':
                    result = !cellValue || cellValue === '' || cellValue === null || cellValue === undefined;
                    break;
                case 'is_not_empty':
                    result = cellValue && cellValue !== '' && cellValue !== null && cellValue !== undefined;
                    break;
                case 'in_list':
                    result = Array.isArray(value) && value.includes(cellValue);
                    break;
                case 'not_in_list':
                    result = Array.isArray(value) && !value.includes(cellValue);
                    break;
                case 'between':
                    if (Array.isArray(value) && value.length === 2) {
                        const numValue = Number(cellValue);
                        result = numValue >= Number(value[0]) && numValue <= Number(value[1]);
                    }
                    break;
                case 'regex':
                    try {
                        const regex = new RegExp(value, 'i');
                        result = regex.test(String(cellValue || ''));
                    } catch (e) {
                        result = false;
                    }
                    break;
                default:
                    result = true;
            }

            return result;
        });
    }

    /**
     * 比较值
     */
    compareValues(a, b, operator) {
        // 尝试数字比较
        const numA = Number(a);
        const numB = Number(b);
        
        if (!isNaN(numA) && !isNaN(numB)) {
            switch (operator) {
                case '===': return numA === numB;
                case '!==': return numA !== numB;
                case '>': return numA > numB;
                case '>=': return numA >= numB;
                case '<': return numA < numB;
                case '<=': return numA <= numB;
            }
        }

        // 日期比较
        const dateA = new Date(a);
        const dateB = new Date(b);
        
        if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
            switch (operator) {
                case '===': return dateA.getTime() === dateB.getTime();
                case '!==': return dateA.getTime() !== dateB.getTime();
                case '>': return dateA.getTime() > dateB.getTime();
                case '>=': return dateA.getTime() >= dateB.getTime();
                case '<': return dateA.getTime() < dateB.getTime();
                case '<=': return dateA.getTime() <= dateB.getTime();
            }
        }

        // 字符串比较
        const strA = String(a || '');
        const strB = String(b || '');
        
        switch (operator) {
            case '===': return strA === strB;
            case '!==': return strA !== strB;
            case '>': return strA > strB;
            case '>=': return strA >= strB;
            case '<': return strA < strB;
            case '<=': return strA <= strB;
            default: return false;
        }
    }

    /**
     * 排序数据
     */
    async sortData(data, messageId) {
        const { dataset, sortColumns, options = {} } = data;
        
        try {
            this.isProcessing = true;
            this.sendProgress({ stage: 'sorting', progress: 0 }, messageId);

            // 复制数据以避免修改原数组
            const result = [...dataset];
            
            // 执行排序
            result.sort((a, b) => {
                for (const sort of sortColumns) {
                    const { column, direction = 'asc' } = sort;
                    const aVal = a[column];
                    const bVal = b[column];
                    
                    let comparison = this.compareForSort(aVal, bVal);
                    
                    if (comparison !== 0) {
                        return direction === 'desc' ? -comparison : comparison;
                    }
                }
                return 0;
            });

            this.sendProgress({ stage: 'complete', progress: 100 }, messageId);
            
            this.sendResult({
                success: true,
                data: result,
                metadata: {
                    totalRows: result.length,
                    sortColumns: sortColumns
                }
            }, messageId);

        } catch (error) {
            this.sendError(error, messageId);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * 排序比较函数
     */
    compareForSort(a, b) {
        // 处理null和undefined
        if (a === null || a === undefined) return b === null || b === undefined ? 0 : -1;
        if (b === null || b === undefined) return 1;

        // 数字比较
        const numA = Number(a);
        const numB = Number(b);
        if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB;
        }

        // 日期比较
        const dateA = new Date(a);
        const dateB = new Date(b);
        if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
            return dateA.getTime() - dateB.getTime();
        }

        // 字符串比较
        return String(a).localeCompare(String(b));
    }

    /**
     * 合并数据
     */
    async mergeData(data, messageId) {
        const { datasets, mergeType, joinKeys, options = {} } = data;
        
        try {
            this.isProcessing = true;
            this.sendProgress({ stage: 'merging', progress: 0 }, messageId);

            let result;
            
            switch (mergeType) {
                case 'inner':
                    result = await this.innerJoin(datasets, joinKeys);
                    break;
                case 'left':
                    result = await this.leftJoin(datasets, joinKeys);
                    break;
                case 'right':
                    result = await this.rightJoin(datasets, joinKeys);
                    break;
                case 'full':
                    result = await this.fullJoin(datasets, joinKeys);
                    break;
                case 'union':
                    result = await this.unionData(datasets);
                    break;
                case 'concat':
                    result = await this.concatData(datasets);
                    break;
                default:
                    throw new Error(`不支持的合并类型: ${mergeType}`);
            }

            this.sendProgress({ stage: 'complete', progress: 100 }, messageId);
            
            this.sendResult({
                success: true,
                data: result,
                metadata: {
                    mergeType,
                    inputDatasets: datasets.length,
                    resultRows: result.length
                }
            }, messageId);

        } catch (error) {
            this.sendError(error, messageId);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * 内连接
     */
    async innerJoin(datasets, joinKeys) {
        if (datasets.length < 2) {
            throw new Error('内连接至少需要两个数据集');
        }

        const [leftDataset, rightDataset] = datasets;
        const result = [];

        for (const leftRow of leftDataset) {
            for (const rightRow of rightDataset) {
                if (this.matchJoinKeys(leftRow, rightRow, joinKeys)) {
                    result.push({ ...leftRow, ...rightRow });
                }
            }
        }

        return result;
    }

    /**
     * 左连接
     */
    async leftJoin(datasets, joinKeys) {
        if (datasets.length < 2) {
            throw new Error('左连接至少需要两个数据集');
        }

        const [leftDataset, rightDataset] = datasets;
        const result = [];

        for (const leftRow of leftDataset) {
            let matched = false;
            
            for (const rightRow of rightDataset) {
                if (this.matchJoinKeys(leftRow, rightRow, joinKeys)) {
                    result.push({ ...leftRow, ...rightRow });
                    matched = true;
                }
            }
            
            if (!matched) {
                result.push(leftRow);
            }
        }

        return result;
    }

    /**
     * 右连接
     */
    async rightJoin(datasets, joinKeys) {
        if (datasets.length < 2) {
            throw new Error('右连接至少需要两个数据集');
        }

        const [leftDataset, rightDataset] = datasets;
        return await this.leftJoin([rightDataset, leftDataset], joinKeys);
    }

    /**
     * 全连接
     */
    async fullJoin(datasets, joinKeys) {
        const leftResult = await this.leftJoin(datasets, joinKeys);
        const rightResult = await this.rightJoin(datasets, joinKeys);
        
        // 合并结果并去重
        const combined = [...leftResult, ...rightResult];
        const unique = [];
        const seen = new Set();

        for (const row of combined) {
            const key = JSON.stringify(row);
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(row);
            }
        }

        return unique;
    }

    /**
     * 联合数据
     */
    async unionData(datasets) {
        const result = [];
        const seen = new Set();

        for (const dataset of datasets) {
            for (const row of dataset) {
                const key = JSON.stringify(row);
                if (!seen.has(key)) {
                    seen.add(key);
                    result.push(row);
                }
            }
        }

        return result;
    }

    /**
     * 连接数据
     */
    async concatData(datasets) {
        return datasets.reduce((acc, dataset) => acc.concat(dataset), []);
    }

    /**
     * 匹配连接键
     */
    matchJoinKeys(leftRow, rightRow, joinKeys) {
        return joinKeys.every(key => {
            const leftKey = typeof key === 'string' ? key : key.left;
            const rightKey = typeof key === 'string' ? key : key.right;
            return leftRow[leftKey] === rightRow[rightKey];
        });
    }

    /**
     * 聚合数据
     */
    async aggregateData(data, messageId) {
        const { dataset, aggregations, groupBy = [], options = {} } = data;
        
        try {
            this.isProcessing = true;
            this.sendProgress({ stage: 'aggregating', progress: 0 }, messageId);

            const groups = new Map();
            const totalRows = dataset.length;

            // 分组数据
            for (let i = 0; i < totalRows; i++) {
                const row = dataset[i];
                const groupKey = groupBy.length > 0 ? 
                    groupBy.map(col => row[col]).join('|') : 
                    'all';

                if (!groups.has(groupKey)) {
                    const groupData = {};
                    
                    // 添加分组列
                    groupBy.forEach(col => {
                        groupData[col] = row[col];
                    });
                    
                    // 初始化聚合值
                    aggregations.forEach(agg => {
                        const alias = agg.alias || `${agg.function}_${agg.column}`;
                        groupData[alias] = this.initializeAggregation(agg.function);
                    });
                    
                    groups.set(groupKey, {
                        data: groupData,
                        count: 0,
                        values: new Map()
                    });
                }

                // 更新聚合值
                const group = groups.get(groupKey);
                group.count++;
                
                aggregations.forEach(agg => {
                    const alias = agg.alias || `${agg.function}_${agg.column}`;
                    const value = row[agg.column];
                    
                    if (!group.values.has(alias)) {
                        group.values.set(alias, []);
                    }
                    group.values.get(alias).push(value);
                    
                    group.data[alias] = this.updateAggregation(
                        group.data[alias],
                        value,
                        agg.function,
                        group.count
                    );
                });

                // 报告进度
                if (i % 1000 === 0) {
                    const progress = (i / totalRows) * 90;
                    this.sendProgress({ 
                        stage: 'aggregating', 
                        progress,
                        processedRows: i + 1,
                        totalRows,
                        groups: groups.size
                    }, messageId);
                }
            }

            // 完成聚合计算
            const result = Array.from(groups.values()).map(group => {
                const finalData = { ...group.data };
                
                // 完成平均值计算
                aggregations.forEach(agg => {
                    if (agg.function === 'avg') {
                        const alias = agg.alias || `${agg.function}_${agg.column}`;
                        const values = group.values.get(alias) || [];
                        const validValues = values.filter(v => v !== null && v !== undefined && !isNaN(Number(v)));
                        finalData[alias] = validValues.length > 0 ? 
                            validValues.reduce((sum, v) => sum + Number(v), 0) / validValues.length : 
                            null;
                    }
                });
                
                return finalData;
            });

            this.sendProgress({ stage: 'complete', progress: 100 }, messageId);
            
            this.sendResult({
                success: true,
                data: result,
                metadata: {
                    originalRows: totalRows,
                    groups: result.length,
                    aggregations: aggregations.length
                }
            }, messageId);

        } catch (error) {
            this.sendError(error, messageId);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * 初始化聚合值
     */
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
                return 0;
            default:
                return null;
        }
    }

    /**
     * 更新聚合值
     */
    updateAggregation(current, value, func, count) {
        const numValue = Number(value);
        
        switch (func) {
            case 'sum':
                return current + (isNaN(numValue) ? 0 : numValue);
            case 'count':
                return count;
            case 'min':
                return Math.min(current, isNaN(numValue) ? Infinity : numValue);
            case 'max':
                return Math.max(current, isNaN(numValue) ? -Infinity : numValue);
            case 'avg':
                return current; // 将在最后计算
            default:
                return current;
        }
    }

    /**
     * 删除重复数据
     */
    async removeDuplicates(data, messageId) {
        const { dataset, columns = [], options = {} } = data;
        
        try {
            this.isProcessing = true;
            this.sendProgress({ stage: 'removing_duplicates', progress: 0 }, messageId);

            const seen = new Set();
            const result = [];
            const totalRows = dataset.length;

            for (let i = 0; i < totalRows; i++) {
                const row = dataset[i];
                
                // 生成唯一键
                const key = columns.length > 0 ? 
                    columns.map(col => row[col]).join('|') : 
                    JSON.stringify(row);

                if (!seen.has(key)) {
                    seen.add(key);
                    result.push(row);
                }

                // 报告进度
                if (i % 1000 === 0) {
                    const progress = (i / totalRows) * 100;
                    this.sendProgress({ 
                        stage: 'removing_duplicates', 
                        progress,
                        processedRows: i + 1,
                        totalRows,
                        uniqueRows: result.length
                    }, messageId);
                }
            }

            this.sendProgress({ stage: 'complete', progress: 100 }, messageId);
            
            this.sendResult({
                success: true,
                data: result,
                metadata: {
                    originalRows: totalRows,
                    uniqueRows: result.length,
                    duplicatesRemoved: totalRows - result.length
                }
            }, messageId);

        } catch (error) {
            this.sendError(error, messageId);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * 填充空值
     */
    async fillEmptyValues(data, messageId) {
        const { dataset, fillRules, options = {} } = data;
        
        try {
            this.isProcessing = true;
            this.sendProgress({ stage: 'filling_empty_values', progress: 0 }, messageId);

            const result = [];
            const totalRows = dataset.length;

            for (let i = 0; i < totalRows; i++) {
                const row = { ...dataset[i] };
                
                // 应用填充规则
                fillRules.forEach(rule => {
                    const { column, method, value } = rule;
                    
                    if (this.isEmpty(row[column])) {
                        switch (method) {
                            case 'constant':
                                row[column] = value;
                                break;
                            case 'forward_fill':
                                if (i > 0) {
                                    row[column] = result[i - 1][column];
                                }
                                break;
                            case 'backward_fill':
                                // 需要预先扫描
                                for (let j = i + 1; j < totalRows; j++) {
                                    if (!this.isEmpty(dataset[j][column])) {
                                        row[column] = dataset[j][column];
                                        break;
                                    }
                                }
                                break;
                            case 'mean':
                                row[column] = this.calculateColumnMean(dataset, column);
                                break;
                            case 'median':
                                row[column] = this.calculateColumnMedian(dataset, column);
                                break;
                            case 'mode':
                                row[column] = this.calculateColumnMode(dataset, column);
                                break;
                        }
                    }
                });

                result.push(row);

                // 报告进度
                if (i % 1000 === 0) {
                    const progress = (i / totalRows) * 100;
                    this.sendProgress({ 
                        stage: 'filling_empty_values', 
                        progress,
                        processedRows: i + 1,
                        totalRows
                    }, messageId);
                }
            }

            this.sendProgress({ stage: 'complete', progress: 100 }, messageId);
            
            this.sendResult({
                success: true,
                data: result,
                metadata: {
                    totalRows: result.length,
                    fillRules: fillRules.length
                }
            }, messageId);

        } catch (error) {
            this.sendError(error, messageId);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * 检查值是否为空
     */
    isEmpty(value) {
        return value === null || value === undefined || value === '' || 
               (typeof value === 'string' && value.trim() === '');
    }

    /**
     * 计算列平均值
     */
    calculateColumnMean(dataset, column) {
        const values = dataset
            .map(row => row[column])
            .filter(val => !this.isEmpty(val) && !isNaN(Number(val)))
            .map(val => Number(val));
        
        return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : null;
    }

    /**
     * 计算列中位数
     */
    calculateColumnMedian(dataset, column) {
        const values = dataset
            .map(row => row[column])
            .filter(val => !this.isEmpty(val) && !isNaN(Number(val)))
            .map(val => Number(val))
            .sort((a, b) => a - b);
        
        if (values.length === 0) return null;
        
        const mid = Math.floor(values.length / 2);
        return values.length % 2 === 0 ? 
            (values[mid - 1] + values[mid]) / 2 : 
            values[mid];
    }

    /**
     * 计算列众数
     */
    calculateColumnMode(dataset, column) {
        const counts = new Map();
        
        dataset.forEach(row => {
            const value = row[column];
            if (!this.isEmpty(value)) {
                counts.set(value, (counts.get(value) || 0) + 1);
            }
        });
        
        if (counts.size === 0) return null;
        
        let maxCount = 0;
        let mode = null;
        
        for (const [value, count] of counts) {
            if (count > maxCount) {
                maxCount = count;
                mode = value;
            }
        }
        
        return mode;
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
}

// 创建Worker实例
const worker = new DataProcessorWorker();

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