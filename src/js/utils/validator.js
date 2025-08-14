/**
 * 数据验证工具
 * 提供文件、数据格式等验证功能
 */

class Validator {
    constructor() {
        this.MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
        this.ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];
        this.ALLOWED_MIME_TYPES = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'text/csv',
            'application/csv'
        ];
    }

    /**
     * 验证文件是否符合要求
     * @param {File} file - 要验证的文件
     * @returns {Object} 验证结果 {isValid: boolean, error: string}
     */
    validateFile(file) {
        try {
            // 检查文件是否存在
            if (!file) {
                return { isValid: false, error: '文件不存在' };
            }

            // 检查文件大小
            if (file.size > this.MAX_FILE_SIZE) {
                const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
                return { 
                    isValid: false, 
                    error: `文件大小超出限制（${sizeMB}MB > 10MB）` 
                };
            }

            // 检查文件扩展名
            const fileName = file.name.toLowerCase();
            const hasValidExtension = this.ALLOWED_EXTENSIONS.some(ext => 
                fileName.endsWith(ext)
            );

            if (!hasValidExtension) {
                return { 
                    isValid: false, 
                    error: `不支持的文件格式，支持：${this.ALLOWED_EXTENSIONS.join(', ')}` 
                };
            }

            // 检查MIME类型（可选，某些情况下可能不准确）
            if (file.type && !this.ALLOWED_MIME_TYPES.includes(file.type)) {
                console.warn('MIME类型检查失败，但扩展名有效，继续处理');
            }

            return { isValid: true, error: null };
        } catch (error) {
            return { 
                isValid: false, 
                error: `文件验证失败: ${error.message}` 
            };
        }
    }

    /**
     * 批量验证文件
     * @param {FileList|Array} files - 文件列表
     * @returns {Object} 验证结果 {validFiles: Array, invalidFiles: Array}
     */
    validateFiles(files) {
        const validFiles = [];
        const invalidFiles = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const validation = this.validateFile(file);
            
            if (validation.isValid) {
                validFiles.push(file);
            } else {
                invalidFiles.push({
                    file: file,
                    error: validation.error
                });
            }
        }

        return { validFiles, invalidFiles };
    }

    /**
     * 验证数据是否为有效的表格数据
     * @param {Array} data - 要验证的数据
     * @returns {Object} 验证结果
     */
    validateTableData(data) {
        try {
            if (!Array.isArray(data)) {
                return { 
                    isValid: false, 
                    error: '数据必须是数组格式' 
                };
            }

            if (data.length === 0) {
                return { 
                    isValid: false, 
                    error: '数据不能为空' 
                };
            }

            // 检查是否有列名（第一行应该是对象）
            if (typeof data[0] !== 'object' || data[0] === null) {
                return { 
                    isValid: false, 
                    error: '数据格式不正确，应为对象数组' 
                };
            }

            // 检查列数一致性
            const firstRowKeys = Object.keys(data[0]);
            if (firstRowKeys.length === 0) {
                return { 
                    isValid: false, 
                    error: '数据行不能为空对象' 
                };
            }

            // 检查数据量是否过大
            if (data.length > 100000) {
                return { 
                    isValid: false, 
                    error: `数据行数过多（${data.length} > 100,000）` 
                };
            }

            return { 
                isValid: true, 
                error: null,
                stats: {
                    rows: data.length,
                    columns: firstRowKeys.length,
                    columnNames: firstRowKeys
                }
            };
        } catch (error) {
            return { 
                isValid: false, 
                error: `数据验证失败: ${error.message}` 
            };
        }
    }

    /**
     * 验证规则DSL语法
     * @param {string} ruleDSL - 规则DSL字符串
     * @returns {Object} 验证结果
     */
    validateRuleDSL(ruleDSL) {
        try {
            if (!ruleDSL || typeof ruleDSL !== 'string') {
                return { 
                    isValid: false, 
                    error: '规则不能为空' 
                };
            }

            // 基本语法检查
            const trimmedRule = ruleDSL.trim();
            if (trimmedRule.length === 0) {
                return { 
                    isValid: false, 
                    error: '规则内容不能为空' 
                };
            }

            // 检查是否包含基本的操作关键字
            const keywords = ['filter', 'sort', 'merge', 'select'];
            const hasKeyword = keywords.some(keyword => 
                trimmedRule.toLowerCase().includes(keyword)
            );

            if (!hasKeyword) {
                return { 
                    isValid: false, 
                    error: `规则必须包含至少一个操作关键字: ${keywords.join(', ')}` 
                };
            }

            return { isValid: true, error: null };
        } catch (error) {
            return { 
                isValid: false, 
                error: `规则验证失败: ${error.message}` 
            };
        }
    }

    /**
     * 验证列名是否存在于数据中
     * @param {Array} columnNames - 要检查的列名
     * @param {Array} data - 数据数组
     * @returns {Object} 验证结果
     */
    validateColumnNames(columnNames, data) {
        try {
            if (!Array.isArray(columnNames) || columnNames.length === 0) {
                return { 
                    isValid: false, 
                    error: '列名列表不能为空' 
                };
            }

            if (!Array.isArray(data) || data.length === 0) {
                return { 
                    isValid: false, 
                    error: '数据不能为空' 
                };
            }

            const availableColumns = Object.keys(data[0] || {});
            const missingColumns = columnNames.filter(col => 
                !availableColumns.includes(col)
            );

            if (missingColumns.length > 0) {
                return { 
                    isValid: false, 
                    error: `以下列名不存在: ${missingColumns.join(', ')}` 
                };
            }

            return { isValid: true, error: null };
        } catch (error) {
            return { 
                isValid: false, 
                error: `列名验证失败: ${error.message}` 
            };
        }
    }

    /**
     * 验证数值范围
     * @param {number} value - 要验证的数值
     * @param {number} min - 最小值
     * @param {number} max - 最大值
     * @returns {Object} 验证结果
     */
    validateNumericRange(value, min, max) {
        try {
            const num = Number(value);
            
            if (isNaN(num)) {
                return { 
                    isValid: false, 
                    error: '值必须是数字' 
                };
            }

            if (num < min || num > max) {
                return { 
                    isValid: false, 
                    error: `值必须在 ${min} 到 ${max} 之间` 
                };
            }

            return { isValid: true, error: null };
        } catch (error) {
            return { 
                isValid: false, 
                error: `数值验证失败: ${error.message}` 
            };
        }
    }

    /**
     * 验证日期格式
     * @param {string} dateString - 日期字符串
     * @returns {Object} 验证结果
     */
    validateDate(dateString) {
        try {
            if (!dateString) {
                return { 
                    isValid: false, 
                    error: '日期不能为空' 
                };
            }

            const date = new Date(dateString);
            
            if (isNaN(date.getTime())) {
                return { 
                    isValid: false, 
                    error: '无效的日期格式' 
                };
            }

            return { 
                isValid: true, 
                error: null,
                parsedDate: date
            };
        } catch (error) {
            return { 
                isValid: false, 
                error: `日期验证失败: ${error.message}` 
            };
        }
    }
}

// 导出单例实例
const validator = new Validator();
export default validator; 