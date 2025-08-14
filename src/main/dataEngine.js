/**
 * 数据处理引擎 - 集成Apache Arrow和DuckDB
 */

const arrow = require('apache-arrow');
const Database = require('duckdb').Database;
const fs = require('fs').promises;
const path = require('path');

class DataEngine {
    constructor() {
        this.db = null;
        this.connection = null;
        this.arrowTables = new Map();
        this.schemas = new Map();
    }

    /**
     * 初始化数据引擎
     */
    async initialize() {
        try {
            // 初始化DuckDB
            this.db = new Database(':memory:');
            this.connection = this.db.connect();
            
            // 启用Arrow扩展
            await this.enableArrowExtension();
            
            console.log('数据处理引擎初始化完成');
        } catch (error) {
            console.error('数据处理引擎初始化失败:', error);
            throw error;
        }
    }

    /**
     * 启用Arrow扩展
     */
    async enableArrowExtension() {
        return new Promise((resolve, reject) => {
            this.connection.exec("INSTALL arrow; LOAD arrow;", (err) => {
                if (err) {
                    console.warn('Arrow扩展加载失败，将使用基础功能:', err.message);
                    resolve(); // 不阻塞初始化
                } else {
                    console.log('Arrow扩展加载成功');
                    resolve();
                }
            });
        });
    }

    /**
     * 将数据转换为Arrow格式
     */
    convertToArrow(data, schema = null) {
        try {
            if (!data || !Array.isArray(data) || data.length === 0) {
                throw new Error('数据为空或格式无效');
            }

            // 如果没有提供schema，自动推断
            if (!schema) {
                schema = this.inferSchema(data);
            }

            // 创建Arrow字段
            const fields = schema.map(col => 
                arrow.Field.new(col.name, this.getArrowType(col.type))
            );

            // 创建Arrow Schema
            const arrowSchema = new arrow.Schema(fields);

            // 准备数据
            const columns = {};
            schema.forEach(col => {
                columns[col.name] = data.map(row => row[col.name]);
            });

            // 创建Arrow Table
            const table = arrow.Table.new(columns, arrowSchema);
            
            console.log(`Arrow表创建成功: ${table.numRows} 行, ${table.numCols} 列`);
            return table;

        } catch (error) {
            console.error('转换为Arrow格式失败:', error);
            throw error;
        }
    }

    /**
     * 推断数据schema
     */
    inferSchema(data) {
        if (!data || data.length === 0) {
            return [];
        }

        const firstRow = data[0];
        const schema = [];

        for (const [key, value] of Object.entries(firstRow)) {
            const type = this.inferDataType(value, data, key);
            schema.push({
                name: key,
                type: type,
                nullable: true
            });
        }

        return schema;
    }

    /**
     * 推断数据类型
     */
    inferDataType(value, data, columnName) {
        // 检查列中的所有值来确定类型
        const sampleSize = Math.min(100, data.length);
        const samples = data.slice(0, sampleSize).map(row => row[columnName]);
        
        let hasNumber = false;
        let hasString = false;
        let hasDate = false;
        let hasBoolean = false;
        let hasNull = false;

        for (const sample of samples) {
            if (sample === null || sample === undefined || sample === '') {
                hasNull = true;
                continue;
            }

            if (typeof sample === 'boolean') {
                hasBoolean = true;
            } else if (typeof sample === 'number') {
                hasNumber = true;
            } else if (typeof sample === 'string') {
                // 检查是否是日期字符串
                if (this.isDateString(sample)) {
                    hasDate = true;
                } else {
                    hasString = true;
                }
            }
        }

        // 根据检测结果确定类型
        if (hasDate && !hasString) {
            return 'timestamp';
        } else if (hasNumber && !hasString && !hasDate) {
            return this.isIntegerColumn(samples) ? 'int64' : 'float64';
        } else if (hasBoolean && !hasString && !hasNumber && !hasDate) {
            return 'bool';
        } else {
            return 'utf8';
        }
    }

    /**
     * 检查是否是日期字符串
     */
    isDateString(str) {
        if (typeof str !== 'string') return false;
        
        // 常见日期格式的正则表达式
        const datePatterns = [
            /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
            /^\d{4}\/\d{2}\/\d{2}$/, // YYYY/MM/DD
            /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
            /^\d{2}-\d{2}-\d{4}$/, // MM-DD-YYYY
            /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, // YYYY-MM-DD HH:MM:SS
        ];

        return datePatterns.some(pattern => pattern.test(str)) && !isNaN(Date.parse(str));
    }

    /**
     * 检查是否是整数列
     */
    isIntegerColumn(samples) {
        return samples.every(sample => 
            sample === null || sample === undefined || Number.isInteger(sample)
        );
    }

    /**
     * 获取Arrow数据类型
     */
    getArrowType(type) {
        switch (type) {
            case 'int64':
                return new arrow.Int64();
            case 'float64':
                return new arrow.Float64();
            case 'bool':
                return new arrow.Bool();
            case 'timestamp':
                return new arrow.TimestampMillisecond();
            case 'utf8':
            default:
                return new arrow.Utf8();
        }
    }

    /**
     * 从Arrow表读取数据
     */
    readArrowTable(table, options = {}) {
        const {
            offset = 0,
            limit = null,
            columns = null
        } = options;

        try {
            let resultTable = table;

            // 选择列
            if (columns && Array.isArray(columns)) {
                resultTable = resultTable.select(columns);
            }

            // 分页
            if (offset > 0 || limit !== null) {
                const endIndex = limit ? offset + limit : table.numRows;
                resultTable = resultTable.slice(offset, endIndex);
            }

            // 转换为JavaScript对象数组
            const result = [];
            for (let i = 0; i < resultTable.numRows; i++) {
                const row = {};
                for (let j = 0; j < resultTable.numCols; j++) {
                    const column = resultTable.getColumnAt(j);
                    const fieldName = resultTable.schema.fields[j].name;
                    row[fieldName] = column.get(i);
                }
                result.push(row);
            }

            return {
                data: result,
                totalRows: table.numRows,
                columns: resultTable.schema.fields.map(field => ({
                    name: field.name,
                    type: field.type.toString()
                }))
            };

        } catch (error) {
            console.error('读取Arrow表失败:', error);
            throw error;
        }
    }

    /**
     * 执行SQL查询
     */
    async executeSQL(sql, tableName = 'data') {
        return new Promise((resolve, reject) => {
            this.connection.all(sql, (err, result) => {
                if (err) {
                    console.error('SQL查询失败:', err);
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }

    /**
     * 注册Arrow表到DuckDB
     */
    async registerArrowTable(tableName, arrowTable) {
        try {
            // 将Arrow表注册到DuckDB
            this.arrowTables.set(tableName, arrowTable);
            this.schemas.set(tableName, arrowTable.schema);

            // 创建临时表
            const createTableSQL = this.generateCreateTableSQL(tableName, arrowTable.schema);
            await this.executeSQL(createTableSQL);

            // 插入数据
            await this.insertArrowData(tableName, arrowTable);

            console.log(`Arrow表 ${tableName} 注册成功`);
            return tableName;

        } catch (error) {
            console.error('注册Arrow表失败:', error);
            throw error;
        }
    }

    /**
     * 生成创建表的SQL
     */
    generateCreateTableSQL(tableName, schema) {
        const columns = schema.fields.map(field => {
            const sqlType = this.arrowTypeToSQL(field.type);
            return `"${field.name}" ${sqlType}`;
        }).join(', ');

        return `CREATE OR REPLACE TABLE "${tableName}" (${columns})`;
    }

    /**
     * Arrow类型转换为SQL类型
     */
    arrowTypeToSQL(arrowType) {
        const typeString = arrowType.toString();
        
        if (typeString.includes('Int')) {
            return 'BIGINT';
        } else if (typeString.includes('Float')) {
            return 'DOUBLE';
        } else if (typeString.includes('Bool')) {
            return 'BOOLEAN';
        } else if (typeString.includes('Timestamp')) {
            return 'TIMESTAMP';
        } else {
            return 'VARCHAR';
        }
    }

    /**
     * 插入Arrow数据到DuckDB
     */
    async insertArrowData(tableName, arrowTable) {
        const batchSize = 1000;
        const totalRows = arrowTable.numRows;
        
        for (let offset = 0; offset < totalRows; offset += batchSize) {
            const endOffset = Math.min(offset + batchSize, totalRows);
            const batch = arrowTable.slice(offset, endOffset);
            
            const values = [];
            for (let i = 0; i < batch.numRows; i++) {
                const row = [];
                for (let j = 0; j < batch.numCols; j++) {
                    const column = batch.getColumnAt(j);
                    const value = column.get(i);
                    row.push(this.formatSQLValue(value));
                }
                values.push(`(${row.join(', ')})`);
            }

            if (values.length > 0) {
                const insertSQL = `INSERT INTO "${tableName}" VALUES ${values.join(', ')}`;
                await this.executeSQL(insertSQL);
            }
        }
    }

    /**
     * 格式化SQL值
     */
    formatSQLValue(value) {
        if (value === null || value === undefined) {
            return 'NULL';
        } else if (typeof value === 'string') {
            return `'${value.replace(/'/g, "''")}'`;
        } else if (typeof value === 'boolean') {
            return value ? 'TRUE' : 'FALSE';
        } else if (value instanceof Date) {
            return `'${value.toISOString()}'`;
        } else {
            return value.toString();
        }
    }

    /**
     * 筛选数据
     */
    async filterData(tableName, conditions) {
        try {
            const whereClause = this.buildWhereClause(conditions);
            const sql = `SELECT * FROM "${tableName}" ${whereClause}`;
            
            const result = await this.executeSQL(sql);
            return result;

        } catch (error) {
            console.error('数据筛选失败:', error);
            throw error;
        }
    }

    /**
     * 构建WHERE子句
     */
    buildWhereClause(conditions) {
        if (!conditions || conditions.length === 0) {
            return '';
        }

        const clauses = conditions.map(condition => {
            const { column, operator, value } = condition;
            const formattedValue = this.formatSQLValue(value);
            
            switch (operator) {
                case 'equals':
                    return `"${column}" = ${formattedValue}`;
                case 'not_equals':
                    return `"${column}" != ${formattedValue}`;
                case 'greater_than':
                    return `"${column}" > ${formattedValue}`;
                case 'less_than':
                    return `"${column}" < ${formattedValue}`;
                case 'contains':
                    return `"${column}" LIKE '%${value}%'`;
                case 'starts_with':
                    return `"${column}" LIKE '${value}%'`;
                case 'ends_with':
                    return `"${column}" LIKE '%${value}'`;
                default:
                    return `"${column}" = ${formattedValue}`;
            }
        });

        return `WHERE ${clauses.join(' AND ')}`;
    }

    /**
     * 排序数据
     */
    async sortData(tableName, sortColumns) {
        try {
            const orderClause = this.buildOrderClause(sortColumns);
            const sql = `SELECT * FROM "${tableName}" ${orderClause}`;
            
            const result = await this.executeSQL(sql);
            return result;

        } catch (error) {
            console.error('数据排序失败:', error);
            throw error;
        }
    }

    /**
     * 构建ORDER BY子句
     */
    buildOrderClause(sortColumns) {
        if (!sortColumns || sortColumns.length === 0) {
            return '';
        }

        const clauses = sortColumns.map(sort => {
            const { column, direction = 'asc' } = sort;
            return `"${column}" ${direction.toUpperCase()}`;
        });

        return `ORDER BY ${clauses.join(', ')}`;
    }

    /**
     * 聚合数据
     */
    async aggregateData(tableName, aggregations, groupBy = []) {
        try {
            const selectClause = this.buildAggregateSelect(aggregations, groupBy);
            const groupClause = groupBy.length > 0 ? 
                `GROUP BY ${groupBy.map(col => `"${col}"`).join(', ')}` : '';
            
            const sql = `SELECT ${selectClause} FROM "${tableName}" ${groupClause}`;
            
            const result = await this.executeSQL(sql);
            return result;

        } catch (error) {
            console.error('数据聚合失败:', error);
            throw error;
        }
    }

    /**
     * 构建聚合SELECT子句
     */
    buildAggregateSelect(aggregations, groupBy) {
        const selectParts = [];

        // 添加分组列
        groupBy.forEach(col => {
            selectParts.push(`"${col}"`);
        });

        // 添加聚合函数
        aggregations.forEach(agg => {
            const { column, function: func, alias } = agg;
            const aggClause = `${func.toUpperCase()}("${column}")`;
            selectParts.push(alias ? `${aggClause} AS "${alias}"` : aggClause);
        });

        return selectParts.join(', ');
    }

    /**
     * 获取表信息
     */
    async getTableInfo(tableName) {
        try {
            const schema = this.schemas.get(tableName);
            const arrowTable = this.arrowTables.get(tableName);

            if (!schema || !arrowTable) {
                throw new Error(`表 ${tableName} 不存在`);
            }

            return {
                name: tableName,
                rows: arrowTable.numRows,
                columns: arrowTable.numCols,
                schema: schema.fields.map(field => ({
                    name: field.name,
                    type: field.type.toString(),
                    nullable: field.nullable
                }))
            };

        } catch (error) {
            console.error('获取表信息失败:', error);
            throw error;
        }
    }

    /**
     * 导出Arrow表
     */
    async exportArrowTable(tableName, filePath, format = 'parquet') {
        try {
            const arrowTable = this.arrowTables.get(tableName);
            if (!arrowTable) {
                throw new Error(`表 ${tableName} 不存在`);
            }

            if (format === 'parquet') {
                // 导出为Parquet格式
                const parquetWriter = arrow.RecordBatchFileWriter.writeAll(arrowTable);
                await fs.writeFile(filePath, parquetWriter);
            } else if (format === 'arrow') {
                // 导出为Arrow格式
                const arrowWriter = arrow.RecordBatchFileWriter.writeAll(arrowTable);
                await fs.writeFile(filePath, arrowWriter);
            } else {
                throw new Error(`不支持的导出格式: ${format}`);
            }

            console.log(`表 ${tableName} 导出成功: ${filePath}`);
            return filePath;

        } catch (error) {
            console.error('导出Arrow表失败:', error);
            throw error;
        }
    }

    /**
     * 清理资源
     */
    async cleanup() {
        try {
            if (this.connection) {
                this.connection.close();
            }
            if (this.db) {
                this.db.close();
            }
            
            this.arrowTables.clear();
            this.schemas.clear();
            
            console.log('数据处理引擎清理完成');

        } catch (error) {
            console.error('数据处理引擎清理失败:', error);
        }
    }
}

module.exports = DataEngine;