/**
 * 格式化工具
 * 提供各种数据格式化功能
 */

class Formatter {
    constructor() {
        this.DEFAULT_DATE_FORMAT = 'YYYY-MM-DD';
        this.DEFAULT_DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';
    }

    /**
     * 格式化文件大小
     * @param {number} bytes - 字节数
     * @param {number} decimals - 小数位数
     * @returns {string} 格式化后的文件大小
     */
    formatFileSize(bytes, decimals = 2) {
        if (bytes === 0) return '0 B';
        if (!bytes || isNaN(bytes)) return '-';

        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];

        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    /**
     * 格式化数字
     * @param {number} number - 要格式化的数字
     * @param {Object} options - 格式化选项
     * @returns {string} 格式化后的数字
     */
    formatNumber(number, options = {}) {
        const {
            decimals = 2,
            thousandsSeparator = ',',
            decimalSeparator = '.',
            prefix = '',
            suffix = ''
        } = options;

        if (number === null || number === undefined || isNaN(number)) {
            return '-';
        }

        const fixedNumber = Number(number).toFixed(decimals);
        const [integerPart, decimalPart] = fixedNumber.split('.');

        // 添加千位分隔符
        const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator);

        let result = formattedInteger;
        if (decimals > 0 && decimalPart) {
            result += decimalSeparator + decimalPart;
        }

        return prefix + result + suffix;
    }

    /**
     * 格式化百分比
     * @param {number} value - 要格式化的值（0-1之间）
     * @param {number} decimals - 小数位数
     * @returns {string} 格式化后的百分比
     */
    formatPercentage(value, decimals = 1) {
        if (value === null || value === undefined || isNaN(value)) {
            return '-';
        }

        return this.formatNumber(value * 100, { decimals, suffix: '%' });
    }

    /**
     * 格式化日期
     * @param {Date|string|number} date - 日期对象、字符串或时间戳
     * @param {string} format - 日期格式
     * @returns {string} 格式化后的日期
     */
    formatDate(date, format = this.DEFAULT_DATE_FORMAT) {
        try {
            let dateObj;
            
            if (date instanceof Date) {
                dateObj = date;
            } else if (typeof date === 'string' || typeof date === 'number') {
                dateObj = new Date(date);
            } else {
                return '-';
            }

            if (isNaN(dateObj.getTime())) {
                return '-';
            }

            // 简单的日期格式化
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            const hours = String(dateObj.getHours()).padStart(2, '0');
            const minutes = String(dateObj.getMinutes()).padStart(2, '0');
            const seconds = String(dateObj.getSeconds()).padStart(2, '0');

            return format
                .replace('YYYY', year)
                .replace('MM', month)
                .replace('DD', day)
                .replace('HH', hours)
                .replace('mm', minutes)
                .replace('ss', seconds);

        } catch (error) {
            console.error('日期格式化失败:', error);
            return '-';
        }
    }

    /**
     * 格式化时间差
     * @param {Date|number} startTime - 开始时间
     * @param {Date|number} endTime - 结束时间
     * @returns {string} 格式化后的时间差
     */
    formatDuration(startTime, endTime = new Date()) {
        try {
            const start = new Date(startTime);
            const end = new Date(endTime);
            const diff = end.getTime() - start.getTime();

            if (diff < 0) return '0秒';

            const seconds = Math.floor(diff / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);

            if (days > 0) {
                return `${days}天 ${hours % 24}小时`;
            } else if (hours > 0) {
                return `${hours}小时 ${minutes % 60}分钟`;
            } else if (minutes > 0) {
                return `${minutes}分钟 ${seconds % 60}秒`;
            } else {
                return `${seconds}秒`;
            }
        } catch (error) {
            console.error('时间差格式化失败:', error);
            return '-';
        }
    }

    /**
     * 格式化表格单元格数据
     * @param {any} value - 单元格值
     * @param {string} type - 数据类型
     * @returns {string} 格式化后的值
     */
    formatCellValue(value, type = 'auto') {
        if (value === null || value === undefined || value === '') {
            return '';
        }

        switch (type) {
            case 'number':
                return this.formatNumber(value);
            
            case 'currency':
                return this.formatNumber(value, { prefix: '¥' });
            
            case 'percentage':
                return this.formatPercentage(value);
            
            case 'date':
                return this.formatDate(value);
            
            case 'datetime':
                return this.formatDate(value, this.DEFAULT_DATETIME_FORMAT);
            
            case 'text':
                return String(value);
            
            case 'auto':
            default:
                // 自动检测数据类型
                if (typeof value === 'number') {
                    return this.formatNumber(value);
                } else if (value instanceof Date || this.isDateString(value)) {
                    return this.formatDate(value);
                } else {
                    return String(value);
                }
        }
    }

    /**
     * 检测字符串是否为日期格式
     * @param {string} str - 要检测的字符串
     * @returns {boolean} 是否为日期格式
     */
    isDateString(str) {
        if (typeof str !== 'string') return false;
        
        // 检测常见的日期格式
        const datePatterns = [
            /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
            /^\d{4}\/\d{2}\/\d{2}$/, // YYYY/MM/DD
            /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
            /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/ // YYYY-MM-DD HH:mm:ss
        ];

        return datePatterns.some(pattern => pattern.test(str)) && !isNaN(new Date(str).getTime());
    }

    /**
     * 格式化JSON数据为可读字符串
     * @param {any} data - 要格式化的数据
     * @param {number} indent - 缩进级别
     * @returns {string} 格式化后的JSON字符串
     */
    formatJSON(data, indent = 2) {
        try {
            return JSON.stringify(data, null, indent);
        } catch (error) {
            console.error('JSON格式化失败:', error);
            return String(data);
        }
    }

    /**
     * 格式化错误信息
     * @param {Error|string} error - 错误对象或错误信息
     * @returns {string} 格式化后的错误信息
     */
    formatError(error) {
        if (typeof error === 'string') {
            return error;
        }

        if (error instanceof Error) {
            return error.message || '未知错误';
        }

        return '发生了未知错误';
    }

    /**
     * 截断长文本
     * @param {string} text - 要截断的文本
     * @param {number} maxLength - 最大长度
     * @param {string} ellipsis - 省略号
     * @returns {string} 截断后的文本
     */
    truncateText(text, maxLength = 50, ellipsis = '...') {
        if (!text || typeof text !== 'string') {
            return '';
        }

        if (text.length <= maxLength) {
            return text;
        }

        return text.substring(0, maxLength - ellipsis.length) + ellipsis;
    }

    /**
     * 格式化列名（将下划线转为空格，首字母大写）
     * @param {string} columnName - 列名
     * @returns {string} 格式化后的列名
     */
    formatColumnName(columnName) {
        if (!columnName || typeof columnName !== 'string') {
            return '';
        }

        return columnName
            .replace(/_/g, ' ')
            .replace(/\b\w/g, letter => letter.toUpperCase());
    }

    /**
     * 格式化文件扩展名
     * @param {string} filename - 文件名
     * @returns {string} 扩展名
     */
    getFileExtension(filename) {
        if (!filename || typeof filename !== 'string') {
            return '';
        }

        const lastDotIndex = filename.lastIndexOf('.');
        if (lastDotIndex === -1) {
            return '';
        }

        return filename.substring(lastDotIndex + 1).toLowerCase();
    }

    /**
     * 格式化文件类型图标
     * @param {string} filename - 文件名
     * @returns {string} 图标类名或Unicode字符
     */
    getFileIcon(filename) {
        const extension = this.getFileExtension(filename);
        
        const iconMap = {
            'xlsx': '📊',
            'xls': '📊',
            'csv': '📄',
            'txt': '📄',
            'pdf': '📕',
            'doc': '📘',
            'docx': '📘'
        };

        return iconMap[extension] || '📄';
    }
}

// 导出单例实例
const formatter = new Formatter();
export default formatter; 