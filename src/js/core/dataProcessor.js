/**
 * RuleXcel - 数据处理器
 * 负责数据筛选、排序、合并等操作
 * 使用Arquero和JSONLogic进行数据处理
 * @author RuleXcel
 */

import VisualRuleEngine from './ruleEngine.js';
import logger from '../utils/logger.js';

export class DataProcessor {
    constructor() {
        this.ruleEngine = new VisualRuleEngine();
        this.logger = logger;
        
        // 确保Arquero库已加载
        if (typeof aq === 'undefined') {
            throw new Error('Arquero库未加载');
        }
    }

    /**
     * 处理数据
     * @param {Array} data - 原始数据
     * @param {Object} rules - 处理规则
     * @returns {Promise<Array>} 处理后的数据
     */
    async processData(data, rules) {
        try {
            this.logger.info('开始数据处理', {
                原始记录数: data.length,
                规则: rules
            });

            // 验证输入数据
            this.validateInputData(data);
            
            // 创建Arquero表
            let table = aq.from(data);
            
            // 按顺序应用规则
            if (rules.filter) {
                table = await this.applyFilter(table, rules.filter);
            }
            
            if (rules.sort) {
                table = await this.applySort(table, rules.sort);
            }
            
            if (rules.merge) {
                table = await this.applyMerge(table, rules.merge);
            }
            
            // 转换回JavaScript数组
            const processedData = table.objects();
            
            this.logger.info('数据处理完成', {
                处理后记录数: processedData.length,
                处理率: `${((processedData.length / data.length) * 100).toFixed(2)}%`
            });
            
            return processedData;
            
        } catch (error) {
            this.logger.error('数据处理失败:', error);
            throw new Error(`数据处理失败: ${error.message}`);
        }
    }

    /**
     * 验证输入数据
     * @param {Array} data - 输入数据
     */
    validateInputData(data) {
        if (!Array.isArray(data)) {
            throw new Error('输入数据必须是数组');
        }
        
        if (data.length === 0) {
            throw new Error('输入数据不能为空');
        }
        
        // 检查数据结构一致性
        const firstRowKeys = Object.keys(data[0]);
        if (firstRowKeys.length === 0) {
            throw new Error('数据行不能为空');
        }
    }

    /**
     * 应用筛选规则
     * @param {Object} table - Arquero表对象
     * @param {string} filterRule - 筛选规则
     * @returns {Promise<Object>} 筛选后的表对象
     */
    async applyFilter(table, filterRule) {
        try {
            this.logger.info('应用筛选规则:', filterRule);
            
            // 解析筛选规则
            const filterFunction = this.ruleEngine.parseFilterRule(filterRule);
            
            // 应用筛选
            const filteredTable = table.filter(filterFunction);
            
            this.logger.info(`筛选完成，保留 ${filteredTable.numRows()} 行数据`);
            
            return filteredTable;
            
        } catch (error) {
            throw new Error(`筛选规则应用失败: ${error.message}`);
        }
    }

    /**
     * 应用排序规则
     * @param {Object} table - Arquero表对象
     * @param {string} sortRule - 排序规则
     * @returns {Promise<Object>} 排序后的表对象
     */
    async applySort(table, sortRule) {
        try {
            this.logger.info('应用排序规则:', sortRule);
            
            // 解析排序规则
            const sortConfig = this.ruleEngine.parseSortRule(sortRule);
            
            // 应用排序
            let sortedTable = table;
            for (const { column, direction } of sortConfig) {
                if (direction === 'desc') {
                    sortedTable = sortedTable.orderby(aq.desc(column));
                } else {
                    sortedTable = sortedTable.orderby(column);
                }
            }
            
            this.logger.info('排序完成');
            
            return sortedTable;
            
        } catch (error) {
            throw new Error(`排序规则应用失败: ${error.message}`);
        }
    }

    /**
     * 应用合并规则
     * @param {Object} table - Arquero表对象
     * @param {string} mergeRule - 合并规则
     * @returns {Promise<Object>} 合并后的表对象
     */
    async applyMerge(table, mergeRule) {
        try {
            this.logger.info('应用合并规则:', mergeRule);
            
            // 解析合并规则
            const mergeConfig = this.ruleEngine.parseMergeRule(mergeRule);
            
            // 根据合并类型处理
            let mergedTable = table;
            
            switch (mergeConfig.type) {
                case 'group':
                    mergedTable = this.applyGroupBy(table, mergeConfig);
                    break;
                case 'aggregate':
                    mergedTable = this.applyAggregate(table, mergeConfig);
                    break;
                case 'join':
                    // 连接操作需要额外的数据源，暂时不实现
                    throw new Error('连接操作暂未实现');
                default:
                    throw new Error(`未知的合并类型: ${mergeConfig.type}`);
            }
            
            this.logger.info('合并完成');
            
            return mergedTable;
            
        } catch (error) {
            throw new Error(`合并规则应用失败: ${error.message}`);
        }
    }

    /**
     * 应用分组操作
     * @param {Object} table - Arquero表对象
     * @param {Object} config - 分组配置
     * @returns {Object} 分组后的表对象
     */
    applyGroupBy(table, config) {
        const { columns } = config;
        
        if (!columns || columns.length === 0) {
            throw new Error('分组列不能为空');
        }
        
        return table.groupby(columns);
    }

    /**
     * 应用聚合操作
     * @param {Object} table - Arquero表对象
     * @param {Object} config - 聚合配置
     * @returns {Object} 聚合后的表对象
     */
    applyAggregate(table, config) {
        const { groupBy, aggregates } = config;
        
        if (!aggregates || Object.keys(aggregates).length === 0) {
            throw new Error('聚合函数不能为空');
        }
        
        // 构建聚合表达式
        const aggregateExpr = {};
        for (const [alias, { column, func }] of Object.entries(aggregates)) {
            switch (func) {
                case 'count':
                    aggregateExpr[alias] = aq.op.count();
                    break;
                case 'sum':
                    aggregateExpr[alias] = aq.op.sum(column);
                    break;
                case 'avg':
                case 'average':
                    aggregateExpr[alias] = aq.op.average(column);
                    break;
                case 'min':
                    aggregateExpr[alias] = aq.op.min(column);
                    break;
                case 'max':
                    aggregateExpr[alias] = aq.op.max(column);
                    break;
                default:
                    throw new Error(`不支持的聚合函数: ${func}`);
            }
        }
        
        // 应用聚合
        if (groupBy && groupBy.length > 0) {
            return table.groupby(groupBy).rollup(aggregateExpr);
        } else {
            return table.rollup(aggregateExpr);
        }
    }

    /**
     * 数据去重
     * @param {Array} data - 原始数据
     * @param {Array} columns - 去重依据的列
     * @returns {Array} 去重后的数据
     */
    removeDuplicates(data, columns = null) {
        try {
            const table = aq.from(data);
            
            if (columns && columns.length > 0) {
                // 基于指定列去重
                return table.dedupe(columns).objects();
            } else {
                // 全行去重
                return table.dedupe().objects();
            }
            
        } catch (error) {
            throw new Error(`数据去重失败: ${error.message}`);
        }
    }

    /**
     * 数据采样
     * @param {Array} data - 原始数据
     * @param {number} sampleSize - 采样大小
     * @param {string} method - 采样方法 ('random', 'first', 'last')
     * @returns {Array} 采样后的数据
     */
    sampleData(data, sampleSize, method = 'random') {
        try {
            if (sampleSize >= data.length) {
                return data;
            }
            
            const table = aq.from(data);
            
            switch (method) {
                case 'random':
                    return table.sample(sampleSize).objects();
                case 'first':
                    return table.slice(0, sampleSize).objects();
                case 'last':
                    return table.slice(-sampleSize).objects();
                default:
                    throw new Error(`不支持的采样方法: ${method}`);
            }
            
        } catch (error) {
            throw new Error(`数据采样失败: ${error.message}`);
        }
    }

    /**
     * 数据分组统计
     * @param {Array} data - 原始数据
     * @param {string} groupColumn - 分组列
     * @param {Object} aggregates - 聚合配置
     * @returns {Array} 统计结果
     */
    groupStats(data, groupColumn, aggregates = {}) {
        try {
            const table = aq.from(data);
            
            // 默认聚合：计数
            const defaultAggregates = {
                count: aq.op.count()
            };
            
            // 合并用户自定义聚合
            const allAggregates = { ...defaultAggregates, ...aggregates };
            
            return table
                .groupby(groupColumn)
                .rollup(allAggregates)
                .objects();
                
        } catch (error) {
            throw new Error(`分组统计失败: ${error.message}`);
        }
    }

    /**
     * 数据类型转换
     * @param {Array} data - 原始数据
     * @param {Object} typeConfig - 类型转换配置
     * @returns {Array} 转换后的数据
     */
    convertDataTypes(data, typeConfig) {
        try {
            let table = aq.from(data);
            
            for (const [column, targetType] of Object.entries(typeConfig)) {
                switch (targetType) {
                    case 'number':
                        table = table.derive({
                            [column]: aq.escape(d => parseFloat(d[column]) || 0)
                        });
                        break;
                    case 'string':
                        table = table.derive({
                            [column]: aq.escape(d => String(d[column] || ''))
                        });
                        break;
                    case 'date':
                        table = table.derive({
                            [column]: aq.escape(d => new Date(d[column]))
                        });
                        break;
                    case 'boolean':
                        table = table.derive({
                            [column]: aq.escape(d => Boolean(d[column]))
                        });
                        break;
                    default:
                        this.logger.warn(`未知的数据类型: ${targetType}`);
                }
            }
            
            return table.objects();
            
        } catch (error) {
            throw new Error(`数据类型转换失败: ${error.message}`);
        }
    }

    /**
     * 数据清洗
     * @param {Array} data - 原始数据
     * @param {Object} cleanConfig - 清洗配置
     * @returns {Array} 清洗后的数据
     */
    cleanData(data, cleanConfig = {}) {
        try {
            let table = aq.from(data);
            
            // 移除空行
            if (cleanConfig.removeEmptyRows !== false) {
                table = table.filter(aq.escape(d => {
                    const values = Object.values(d);
                    return values.some(v => v !== null && v !== undefined && v !== '');
                }));
            }
            
            // 填充空值
            if (cleanConfig.fillEmpty) {
                const fillValue = cleanConfig.fillEmpty;
                const columns = table.columnNames();
                const fillExpr = {};
                
                columns.forEach(col => {
                    fillExpr[col] = aq.escape(d => d[col] === null || d[col] === undefined || d[col] === '' ? fillValue : d[col]);
                });
                
                table = table.derive(fillExpr);
            }
            
            // 修剪字符串
            if (cleanConfig.trimStrings !== false) {
                const columns = table.columnNames();
                const trimExpr = {};
                
                columns.forEach(col => {
                    trimExpr[col] = aq.escape(d => {
                        const value = d[col];
                        return typeof value === 'string' ? value.trim() : value;
                    });
                });
                
                table = table.derive(trimExpr);
            }
            
            return table.objects();
            
        } catch (error) {
            throw new Error(`数据清洗失败: ${error.message}`);
        }
    }

    /**
     * 获取数据统计信息
     * @param {Array} data - 数据
     * @returns {Object} 统计信息
     */
    getDataStats(data) {
        try {
            if (!data || data.length === 0) {
                return {
                    rowCount: 0,
                    columnCount: 0,
                    columns: [],
                    summary: {}
                };
            }
            
            const table = aq.from(data);
            const columns = table.columnNames();
            const stats = {
                rowCount: table.numRows(),
                columnCount: table.numCols(),
                columns: columns,
                summary: {}
            };
            
            // 为每列生成统计信息
            columns.forEach(col => {
                const columnData = table.array(col);
                const nonNullData = columnData.filter(v => v !== null && v !== undefined && v !== '');
                
                stats.summary[col] = {
                    count: nonNullData.length,
                    nullCount: columnData.length - nonNullData.length,
                    nullRate: ((columnData.length - nonNullData.length) / columnData.length * 100).toFixed(2) + '%'
                };
                
                // 数值型统计
                const numericData = nonNullData.filter(v => typeof v === 'number' && !isNaN(v));
                if (numericData.length > 0) {
                    stats.summary[col].min = Math.min(...numericData);
                    stats.summary[col].max = Math.max(...numericData);
                    stats.summary[col].avg = (numericData.reduce((a, b) => a + b, 0) / numericData.length).toFixed(2);
                }
                
                // 唯一值统计
                const uniqueValues = [...new Set(nonNullData)];
                stats.summary[col].uniqueCount = uniqueValues.length;
                stats.summary[col].uniqueRate = ((uniqueValues.length / nonNullData.length) * 100).toFixed(2) + '%';
            });
            
            return stats;
            
        } catch (error) {
            this.logger.error('获取数据统计失败:', error);
            return {
                rowCount: data.length,
                columnCount: data.length > 0 ? Object.keys(data[0]).length : 0,
                columns: data.length > 0 ? Object.keys(data[0]) : [],
                summary: {},
                error: error.message
            };
        }
    }
} 