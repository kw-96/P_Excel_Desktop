/**
 * 快捷操作功能
 * 提供预设的数据处理快捷按钮
 */

import logger from '../utils/logger.js';
import formatter from '../utils/formatter.js';

class QuickActions {
    constructor() {
        this.actions = new Map();
        this._initializeActions();
    }

    /**
     * 初始化快捷操作
     */
    _initializeActions() {
        // 筛选本月数据
        this.actions.set('filterCurrentMonth', {
            id: 'filterCurrentMonth',
            title: '筛选本月数据',
            description: '筛选出本月创建或更新的数据记录',
            icon: '📅',
            category: 'filter',
            dateColumns: ['创建时间', '更新时间', 'date', 'create_time', 'update_time', 'created_at', 'updated_at'],
            handler: this.filterCurrentMonth.bind(this)
        });

        // 筛选上月数据
        this.actions.set('filterLastMonth', {
            id: 'filterLastMonth',
            title: '筛选上月数据',
            description: '筛选出上个月的数据记录',
            icon: '📅',
            category: 'filter',
            handler: this.filterLastMonth.bind(this)
        });

        // 提取优质资源位
        this.actions.set('extractQualityResources', {
            id: 'extractQualityResources',
            title: '提取优质资源位',
            description: '在筛选月份数据基础上，进一步筛选F列大于G列的优质资源位',
            icon: '⭐',
            category: 'filter',
            handler: this.extractQualityResources.bind(this)
        });

        // 删除重复数据
        this.actions.set('removeDuplicates', {
            id: 'removeDuplicates',
            title: '删除重复数据',
            description: '根据指定列删除重复的数据行',
            icon: '🔄',
            category: 'clean',
            handler: this.removeDuplicates.bind(this)
        });

        // 按时间排序
        this.actions.set('sortByTime', {
            id: 'sortByTime',
            title: '按时间排序',
            description: '按时间字段对数据进行排序',
            icon: '⏰',
            category: 'sort',
            handler: this.sortByTime.bind(this)
        });

        // 数据统计摘要
        this.actions.set('generateSummary', {
            id: 'generateSummary',
            title: '生成数据摘要',
            description: '生成数据的统计摘要信息',
            icon: '📊',
            category: 'analyze',
            handler: this.generateSummary.bind(this)
        });
    }

    /**
     * 筛选上月数据
     * @param {Array} allFiles - 所有文件数据
     * @param {Object} options - 选项参数
     * @returns {Object} 处理结果
     */
    async filterLastMonth(allFiles, options = {}) {
        try {
            const now = new Date();
            const lastMonth = {
                year: now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(),
                month: now.getMonth() === 0 ? 12 : now.getMonth()
            };
            
            logger.info('开始筛选上月数据', { targetMonth: lastMonth });
            
            // 复用filterCurrentMonth方法，传入上月参数
            return await this.filterCurrentMonth(allFiles, lastMonth, options);
            
        } catch (error) {
            logger.error('筛选上月数据失败', error);
            return {
                success: false,
                data: allFiles,
                message: `筛选上月数据失败: ${error.message}`,
                error: error.message
            };
        }
    }

    /**
     * 筛选指定月份数据（增强版）
     * @param {Array} allFiles - 所有文件数据
     * @param {Object} selectedMonth - 选择的月份 {year: 2025, month: 6}
     * @param {Object} options - 选项参数
     * @returns {Object} 处理结果
     */
    async filterCurrentMonth(allFiles, selectedMonth = null, options = {}) {
        try {
            logger.info('开始筛选本月数据（增强版）', { files: allFiles.length });

            if (!allFiles || allFiles.length === 0) {
                throw new Error('没有可处理的文件数据');
            }

            // 步骤1: 获取目标日期（用户选择的月份或当前月份）
            let targetYear, targetMonth;
            
            if (selectedMonth) {
                targetYear = selectedMonth.year;
                targetMonth = selectedMonth.month - 1; // JavaScript月份从0开始
            } else {
                const now = new Date();
                targetYear = now.getFullYear();
                targetMonth = now.getMonth();
            }
            
            const monthStart = new Date(targetYear, targetMonth, 1);
            const monthEnd = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);



            // 步骤2: 提取首个表格文件的首个Sheet的第一行作为表头
            if (!allFiles[0] || !allFiles[0].data || allFiles[0].data.length === 0) {
                throw new Error('首个文件没有有效数据');
            }

            const firstFileData = Array.isArray(allFiles[0].data) ? allFiles[0].data : [allFiles[0].data];
            const headers = Object.keys(firstFileData[0]);

            // 步骤3: 获取上传的所有表格的首个Sheet内的日期时间列
            let dateColumn = null;
            const dateColumns = ['日期', '时间', '创建时间', '更新时间', '按报日期', '报告日期', '统计日期', 
                               'date', 'time', 'create_time', 'update_time', 'created_at', 'updated_at', 'report_date'];
            
            // 先尝试精确匹配
            for (const colName of dateColumns) {
                if (headers.includes(colName)) {
                    dateColumn = colName;
                    break;
                }
            }

            // 如果没有精确匹配，尝试模糊匹配
            if (!dateColumn) {
                for (const header of headers) {
                    const lowerHeader = header.toLowerCase();
                    if (lowerHeader.includes('日期') || lowerHeader.includes('时间') || 
                        lowerHeader.includes('date') || lowerHeader.includes('time')) {
                        dateColumn = header;
                        break;
                    }
                }
            }

            // 如果还没找到，智能检测包含日期数据的列
            if (!dateColumn) {
                for (const header of headers) {
                    const sampleValue = firstFileData[0][header];
                    if (sampleValue && this._isDateValue(sampleValue)) {
                        dateColumn = header;
                        break;
                    }
                }
            }

            if (!dateColumn) {
                // 输出调试信息
                const headerInfo = headers.map(h => {
                    const sample = firstFileData[0][h];
                    return `${h}: ${sample}`;
                }).join(', ');
                
                throw new Error(`未找到日期列。\n可用列: ${headerInfo}\n支持的日期列名：${dateColumns.join(', ')}`);
            }



            // 步骤4: 整合所有文件的数据，筛选当前月份
            let allData = [];
            let totalOriginalRows = 0;

            for (const fileData of allFiles) {
                const dataArray = Array.isArray(fileData.data) ? fileData.data : [fileData.data];
                totalOriginalRows += dataArray.length;
                
                // 筛选当月数据
                const monthlyData = dataArray.filter(row => {
                    const dateValue = row[dateColumn];
                    if (!dateValue) return false;

                    const date = new Date(dateValue);
                    if (isNaN(date.getTime())) return false;

                    return date >= monthStart && date <= monthEnd;
                });

                allData = allData.concat(monthlyData);
            }



            if (allData.length === 0) {
                // 分析数据中实际存在的月份
                let foundMonths = new Set();
                for (const fileData of allFiles) {
                    const dataArray = Array.isArray(fileData.data) ? fileData.data : [fileData.data];
                    for (const row of dataArray) {
                        const dateValue = row[dateColumn];
                        if (dateValue) {
                            const date = new Date(dateValue);
                            if (!isNaN(date.getTime())) {
                                const monthStr = `${date.getFullYear()}年${date.getMonth() + 1}月`;
                                foundMonths.add(monthStr);
                            }
                        }
                    }
                }
                
                const targetMonthStr = `${targetYear}年${targetMonth + 1}月`;
                const foundMonthsList = Array.from(foundMonths).join(', ');
                
                return {
                    success: false,
                    data: [],
                    message: `没有找到${targetMonthStr}的数据。\n数据中包含的月份: ${foundMonthsList || '无有效日期'}`,
                    stats: { 
                        original: totalOriginalRows, 
                        filtered: 0,
                        targetMonth: targetMonthStr,
                        foundMonths: Array.from(foundMonths)
                    }
                };
            }

            // 步骤5: F列数据筛选
            const columnF = headers[5]; // F列是第6列（索引5）
            if (columnF && allData.length > 0) {
                const beforeFFilter = allData.length;
                allData = allData.filter(row => {
                    const fValue = row[columnF];
                    
                    // 去除为"-"的行
                    if (fValue === '-' || fValue === '—') {
                        return false;
                    }
                    
                    // 去除小于0.1的行
                    const numValue = parseFloat(fValue);
                    if (!isNaN(numValue) && numValue < 0.1) {
                        return false;
                    }
                    
                    return true;
                });
            }

            // 步骤6: 按日期智能排序（最新日期在上）
            if (allData.length > 0) {
                allData.sort((a, b) => {
                    return this._smartCompareValues(a[dateColumn], b[dateColumn], true, true);
                });
            }

            const resultMessage = `成功处理本月资源位数据：${allData.length} 条记录`;

            return {
                success: true,
                data: allData,
                message: resultMessage,
                headers: headers,
                stats: {
                    original: totalOriginalRows,
                    filtered: allData.length,
                    dateColumn,
                    fColumn: headers[5],
                    monthRange: `${formatter.formatDate(monthStart)} 至 ${formatter.formatDate(monthEnd)}`
                }
            };

        } catch (error) {
            logger.error('筛选本月数据失败', error);
            return {
                success: false,
                data: [],
                message: `筛选失败: ${error.message}`,
                error: error.message
            };
        }
    }

    /**
     * 提取优质资源位 - 基于筛选月份数据的逻辑，添加F列大于G列的条件
     * @param {Array} allFiles - 所有文件数据
     * @param {Object} selectedMonth - 选择的月份 {year, month}
     * @param {Object} options - 选项参数
     * @returns {Object} 处理结果
     */
    async extractQualityResources(allFiles, selectedMonth = null, options = {}) {
        try {
            logger.info('开始提取优质资源位（增强版）', { files: allFiles.length });

            if (!allFiles || allFiles.length === 0) {
                throw new Error('没有可处理的文件数据');
            }

            // 复用筛选月份数据的前置逻辑
            // 步骤1: 获取目标日期（用户选择的月份或当前月份）
            let targetYear, targetMonth;
            
            if (selectedMonth) {
                targetYear = selectedMonth.year;
                targetMonth = selectedMonth.month - 1; // JavaScript月份从0开始
            } else {
                const now = new Date();
                targetYear = now.getFullYear();
                targetMonth = now.getMonth();
            }
            
            const monthStart = new Date(targetYear, targetMonth, 1);
            const monthEnd = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);

            // 步骤2: 提取首个表格文件的首个Sheet的第一行作为表头
            if (!allFiles[0] || !allFiles[0].data || allFiles[0].data.length === 0) {
                throw new Error('首个文件没有有效数据');
            }

            const firstFileData = Array.isArray(allFiles[0].data) ? allFiles[0].data : [allFiles[0].data];
            const headers = Object.keys(firstFileData[0]);

            // 步骤3: 获取日期列（复用filterCurrentMonth的日期列识别逻辑）
            let dateColumn = null;
            const dateColumns = ['日期', '时间', '创建时间', '更新时间', '按报日期', '报告日期', '统计日期', 
                               'date', 'time', 'create_time', 'update_time', 'created_at', 'updated_at', 'report_date'];
            
            // 先尝试精确匹配
            for (const colName of dateColumns) {
                if (headers.includes(colName)) {
                    dateColumn = colName;
                    break;
                }
            }

            // 如果没有精确匹配，尝试模糊匹配
            if (!dateColumn) {
                for (const header of headers) {
                    const lowerHeader = header.toLowerCase();
                    if (lowerHeader.includes('日期') || lowerHeader.includes('时间') || 
                        lowerHeader.includes('date') || lowerHeader.includes('time')) {
                        dateColumn = header;
                        break;
                    }
                }
            }

            // 如果还没找到，智能检测包含日期数据的列
            if (!dateColumn) {
                for (const header of headers) {
                    const sampleValue = firstFileData[0][header];
                    if (sampleValue && this._isDateValue(sampleValue)) {
                        dateColumn = header;
                        break;
                    }
                }
            }

            if (!dateColumn) {
                throw new Error(`未找到日期列。支持的日期列名：${dateColumns.join(', ')}`);
            }

            // 步骤4: 整合所有文件的数据，筛选当前月份
            let allData = [];
            let totalOriginalRows = 0;

            for (const fileData of allFiles) {
                const dataArray = Array.isArray(fileData.data) ? fileData.data : [fileData.data];
                totalOriginalRows += dataArray.length;
                
                // 筛选当月数据
                const monthlyData = dataArray.filter(row => {
                    const dateValue = row[dateColumn];
                    if (!dateValue) return false;

                    const date = new Date(dateValue);
                    if (isNaN(date.getTime())) return false;

                    return date >= monthStart && date <= monthEnd;
                });

                allData = allData.concat(monthlyData);
            }

            if (allData.length === 0) {
                const targetMonthStr = `${targetYear}年${targetMonth + 1}月`;
                return {
                    success: false,
                    data: [],
                    message: `没有找到${targetMonthStr}的数据`,
                    stats: { 
                        original: totalOriginalRows, 
                        filtered: 0,
                        targetMonth: targetMonthStr
                    }
                };
            }

            // 步骤5: F列基础筛选（复用filterCurrentMonth的逻辑）
            const columnF = headers[5]; // F列是第6列（索引5）
            const columnG = headers[6]; // G列是第7列（索引6）
            let beforeFFilter = allData.length;
            
            if (columnF && allData.length > 0) {
                allData = allData.filter(row => {
                    const fValue = row[columnF];
                    
                    // 去除为"-"的行
                    if (fValue === '-' || fValue === '—') {
                        return false;
                    }
                    
                    // 去除小于0.1的行
                    const numValue = parseFloat(fValue);
                    if (!isNaN(numValue) && numValue < 0.1) {
                        return false;
                    }
                    
                    return true;
                });
            }

            // 步骤6: 新增优质资源位条件 - F列大于G列
            let beforeQualityFilter = allData.length;
            if (columnF && columnG && allData.length > 0) {
                allData = allData.filter(row => {
                    const fValue = parseFloat(row[columnF]);
                    const gValue = parseFloat(row[columnG]);
                    
                    // 如果F列或G列不是有效数字，跳过这个条件
                    if (isNaN(fValue) || isNaN(gValue)) {
                        return true; // 保留数据，让其他条件决定
                    }
                    
                    // F列必须大于G列
                    return fValue > gValue;
                });
            }

            // 步骤7: 按日期智能排序（最新日期在上）
            if (allData.length > 0) {
                allData.sort((a, b) => {
                    return this._smartCompareValues(a[dateColumn], b[dateColumn], true, true);
                });
            }

            const resultMessage = `成功提取优质资源位：${allData.length} 条记录（F列>${columnG ? 'G列' : '0.1'}且符合月份条件）`;

            logger.info('优质资源位提取完成', { 
                originalRows: totalOriginalRows,
                monthlyRows: beforeFFilter,
                basicFilterRows: beforeQualityFilter,
                qualityRows: allData.length,
                dateColumn,
                columnF,
                columnG
            });

            return {
                success: true,
                data: allData,
                message: resultMessage,
                headers: headers,
                stats: {
                    original: totalOriginalRows,
                    monthly: beforeFFilter,
                    basicFilter: beforeQualityFilter,
                    quality: allData.length,
                    dateColumn,
                    columnF,
                    columnG,
                    monthRange: `${targetYear}年${targetMonth + 1}月`,
                    qualityCondition: `${columnF} > ${columnG}`
                }
            };

        } catch (error) {
            logger.error('提取优质资源位失败', error);
            return {
                success: false,
                data: [],
                message: `提取失败: ${error.message}`,
                error: error.message
            };
        }
    }

    /**
     * 删除重复数据
     * @param {Array} data - 输入数据
     * @param {Object} options - 选项参数
     * @returns {Object} 处理结果
     */
    async removeDuplicates(data, options = {}) {
        try {
            logger.info('开始删除重复数据', { rows: data.length });

            if (!data || data.length === 0) {
                throw new Error('没有可处理的数据');
            }

            const keyColumns = options.keyColumns || Object.keys(data[0]);
            const seen = new Set();
            const uniqueData = [];

            data.forEach(row => {
                // 创建基于指定列的唯一标识
                const key = keyColumns.map(col => row[col]).join('|');
                
                if (!seen.has(key)) {
                    seen.add(key);
                    uniqueData.push(row);
                }
            });

            const duplicateCount = data.length - uniqueData.length;

            logger.info('重复数据删除完成', { 
                originalRows: data.length,
                uniqueRows: uniqueData.length,
                duplicates: duplicateCount 
            });

            return {
                success: true,
                data: uniqueData,
                message: `删除了 ${duplicateCount} 条重复数据，保留 ${uniqueData.length} 条唯一数据`,
                stats: {
                    original: data.length,
                    unique: uniqueData.length,
                    duplicates: duplicateCount,
                    keyColumns: keyColumns
                }
            };

        } catch (error) {
            logger.error('删除重复数据失败', error);
            return {
                success: false,
                data: data,
                message: `删除重复数据失败: ${error.message}`,
                error: error.message
            };
        }
    }

    /**
     * 按时间排序 - 智能排序不进行数据转换
     * @param {Array} data - 输入数据
     * @param {Object} options - 选项参数
     * @returns {Object} 处理结果
     */
    async sortByTime(data, options = {}) {
        try {
            logger.info('开始按时间排序', { rows: data.length });

            if (!data || data.length === 0) {
                throw new Error('没有可处理的数据');
            }

            // 查找时间列
            const timeColumn = this._findDateColumn(data[0], this.actions.get('filterCurrentMonth').dateColumns);
            
            if (!timeColumn) {
                throw new Error('未找到有效的时间列');
            }

            const descending = options.descending !== false; // 默认降序

            // 智能排序数据，不进行格式转换
            const sortedData = [...data].sort((a, b) => {
                return this._smartCompareValues(a[timeColumn], b[timeColumn], descending, true);
            });

            logger.info('时间排序完成', { 
                rows: sortedData.length,
                timeColumn,
                order: descending ? '降序' : '升序' 
            });

            return {
                success: true,
                data: sortedData,
                message: `已按${timeColumn}列进行${descending ? '降序' : '升序'}排序`,
                stats: {
                    rows: sortedData.length,
                    timeColumn,
                    order: descending ? 'desc' : 'asc'
                }
            };

        } catch (error) {
            logger.error('时间排序失败', error);
            return {
                success: false,
                data: data,
                message: `排序失败: ${error.message}`,
                error: error.message
            };
        }
    }

    /**
     * 生成数据摘要
     * @param {Array} data - 输入数据
     * @param {Object} options - 选项参数
     * @returns {Object} 处理结果
     */
    async generateSummary(data, options = {}) {
        try {
            logger.info('开始生成数据摘要', { rows: data.length });

            if (!data || data.length === 0) {
                throw new Error('没有可处理的数据');
            }

            const summary = {
                总行数: data.length,
                总列数: Object.keys(data[0]).length,
                列名列表: Object.keys(data[0]),
                数值列统计: {},
                文本列统计: {},
                日期范围: {}
            };

            // 分析每一列
            Object.keys(data[0]).forEach(column => {
                const values = data.map(row => row[column]).filter(val => val !== null && val !== undefined && val !== '');
                
                if (values.length === 0) return;

                // 检查是否为数值列
                const numericValues = values.map(val => parseFloat(val)).filter(val => !isNaN(val));
                
                if (numericValues.length > values.length * 0.5) {
                    // 数值列统计
                    summary.数值列统计[column] = {
                        总数: numericValues.length,
                        最小值: Math.min(...numericValues),
                        最大值: Math.max(...numericValues),
                        平均值: numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length,
                        非空率: `${((numericValues.length / data.length) * 100).toFixed(1)}%`
                    };
                } else {
                    // 文本列统计
                    const uniqueValues = new Set(values);
                    summary.文本列统计[column] = {
                        总数: values.length,
                        唯一值数量: uniqueValues.size,
                        最常见值: this._getMostCommonValue(values),
                        非空率: `${((values.length / data.length) * 100).toFixed(1)}%`
                    };
                }

                // 检查是否为日期列
                const dateValues = values.map(val => new Date(val)).filter(date => !isNaN(date.getTime()));
                if (dateValues.length > values.length * 0.3) {
                    summary.日期范围[column] = {
                        最早日期: formatter.formatDate(new Date(Math.min(...dateValues))),
                        最晚日期: formatter.formatDate(new Date(Math.max(...dateValues))),
                        日期数量: dateValues.length
                    };
                }
            });

            logger.info('数据摘要生成完成');

            return {
                success: true,
                data: data, // 返回原始数据
                message: `已生成包含 ${data.length} 行 ${Object.keys(data[0]).length} 列的数据摘要`,
                summary: summary
            };

        } catch (error) {
            logger.error('生成数据摘要失败', error);
            return {
                success: false,
                data: data,
                message: `生成摘要失败: ${error.message}`,
                error: error.message
            };
        }
    }

    /**
     * 查找日期列
     * @param {Object} row - 数据行示例
     * @param {Array} candidateColumns - 候选列名
     * @returns {string|null} 找到的日期列名
     */
    _findDateColumn(row, candidateColumns) {
        const availableColumns = Object.keys(row);
        
        // 先尝试精确匹配
        for (const candidate of candidateColumns) {
            if (availableColumns.includes(candidate)) {
                return candidate;
            }
        }
        
        // 再尝试模糊匹配
        for (const available of availableColumns) {
            const lowerAvailable = available.toLowerCase();
            for (const candidate of candidateColumns) {
                if (lowerAvailable.includes(candidate.toLowerCase()) || 
                    candidate.toLowerCase().includes(lowerAvailable)) {
                    return available;
                }
            }
        }
        
        return null;
    }

    /**
     * 查找质量评估列
     * @param {Object} row - 数据行示例
     * @param {Array} candidateColumns - 候选列名
     * @returns {string|null} 找到的质量列名
     */
    _findQualityColumn(row, candidateColumns) {
        return this._findDateColumn(row, candidateColumns); // 使用相同的匹配逻辑
    }

    /**
     * 获取最常见的值
     * @param {Array} values - 值数组
     * @returns {string} 最常见的值
     */
    _getMostCommonValue(values) {
        const frequency = {};
        let maxCount = 0;
        let mostCommon = values[0];

        values.forEach(value => {
            frequency[value] = (frequency[value] || 0) + 1;
            if (frequency[value] > maxCount) {
                maxCount = frequency[value];
                mostCommon = value;
            }
        });

        return mostCommon;
    }

    /**
     * 检测值是否为日期
     * @param {*} value - 要检测的值
     * @returns {boolean} 是否为日期值
     */
    _isDateValue(value) {
        if (!value) return false;
        
        const date = new Date(value);
        
        // 检查是否为有效日期
        if (isNaN(date.getTime())) return false;
        
        // 检查是否符合常见日期格式
        const str = value.toString();
        const datePatterns = [
            /^\d{4}-\d{2}-\d{2}/, // YYYY-MM-DD
            /^\d{4}\/\d{2}\/\d{2}/, // YYYY/MM/DD
            /^\d{2}\/\d{2}\/\d{4}/, // MM/DD/YYYY
            /^\d{2}-\d{2}-\d{4}/, // MM-DD-YYYY
            /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}/, // YYYY-MM-DD HH:MM
            /^\d{4}\/\d{2}\/\d{2}\s\d{2}:\d{2}/ // YYYY/MM/DD HH:MM
        ];
        
        return datePatterns.some(pattern => pattern.test(str));
    }

    /**
     * 智能值比较 - 不进行数据转换的排序
     * @param {*} valueA - 值A
     * @param {*} valueB - 值B
     * @param {boolean} descending - 是否降序
     * @param {boolean} treatAsDate - 是否当作日期处理
     * @returns {number} 比较结果
     */
    _smartCompareValues(valueA, valueB, descending = false, treatAsDate = false) {
        // 处理空值
        if (!valueA && !valueB) return 0;
        if (!valueA) return descending ? 1 : -1;
        if (!valueB) return descending ? -1 : 1;

        const strA = valueA.toString();
        const strB = valueB.toString();

        // 如果明确指定为日期处理，且值看起来像日期
        if (treatAsDate && this._isDateValue(strA) && this._isDateValue(strB)) {
            // 尝试按日期比较，但不修改原始数据
            const dateA = new Date(strA);
            const dateB = new Date(strB);
            
            if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
                const result = dateA.getTime() - dateB.getTime();
                return descending ? -result : result;
            }
        }

        // 检查是否为数字值（但不是分数格式）
        if (!strA.includes('/') && !strB.includes('/')) {
            const numA = parseFloat(strA.replace('%', ''));
            const numB = parseFloat(strB.replace('%', ''));
            
            if (!isNaN(numA) && !isNaN(numB)) {
                const result = numA - numB;
                return descending ? -result : result;
            }
        }

        // 字符串比较
        const result = strA.localeCompare(strB, 'zh-CN', { numeric: true });
        return descending ? -result : result;
    }

    /**
     * 获取所有可用的快捷操作
     * @returns {Array} 操作列表
     */
    getAvailableActions() {
        return Array.from(this.actions.values()).map(action => ({
            id: action.id,
            title: action.title,
            description: action.description,
            icon: action.icon,
            category: action.category
        }));
    }

    /**
     * 执行指定的快捷操作
     * @param {string} actionId - 操作ID
     * @param {Array} data - 输入数据
     * @param {*} extraParam - 额外参数（用于特殊操作如月份选择）
     * @param {Object} options - 选项参数
     * @returns {Promise<Object>} 处理结果
     */
    async executeAction(actionId, data, extraParam = null, options = {}) {
        const action = this.actions.get(actionId);
        if (!action) {
            throw new Error(`未找到快捷操作: ${actionId}`);
        }

        logger.userAction(`执行快捷操作: ${action.title}`, { actionId, rows: Array.isArray(data) ? data.length : 'N/A' });
        
        // 对于需要文件数组和月份参数的操作
        if ((actionId === 'filterCurrentMonth' || actionId === 'extractQualityResources') && extraParam) {
            return await action.handler(data, extraParam, options);
        }
        
        // 对于需要文件数组但不需要月份参数的操作
        if (actionId === 'extractQualityResources') {
            return await action.handler(data, null, options);
        }
        
        return await action.handler(data, options);
    }

    /**
     * 按类别获取操作
     * @param {string} category - 操作类别
     * @returns {Array} 该类别的操作列表
     */
    getActionsByCategory(category) {
        return this.getAvailableActions().filter(action => action.category === category);
    }
}

// 导出单例实例
const quickActions = new QuickActions();
export default quickActions; 