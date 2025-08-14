// 列名映射工具
/**
 * ColumnMapper - 将原始列名映射为A、B、C等字母索引
 * @author AI
 */
class ColumnMapper {
  /**
   * @param {Array<Object>} data - 表格数据（每行为对象）
   */
  constructor(data) {
    this.originalColumns = [];
    this.mappedColumns = {};
    this.reverseMapping = {};
    if (data && data.length > 0) {
      this.detectValidColumns(data);
      this.generateMapping();
    }
  }

  /**
   * 检测有内容的列
   * @param {Array<Object>} data
   */
  detectValidColumns(data) {
    const firstRow = data[0];
    this.originalColumns = Object.keys(firstRow);
  }

  /**
   * 生成A、B、C等映射
   */
  generateMapping() {
    this.originalColumns.forEach((col, idx) => {
      const letter = String.fromCharCode(65 + idx); // 65 = 'A'
      this.mappedColumns[letter] = col;
      this.reverseMapping[col] = letter;
    });
  }

  /**
   * 获取原始列名
   * @param {string} mappedName - A/B/C等
   * @returns {string}
   */
  getOriginalColumn(mappedName) {
    return this.mappedColumns[mappedName];
  }

  /**
   * 获取映射后的列名
   * @param {string} originalName
   * @returns {string}
   */
  getMappedColumn(originalName) {
    return this.reverseMapping[originalName];
  }

  /**
   * 更新数据并重新生成映射
   * @param {Array<Object>} data - 新的数据
   */
  updateData(data) {
    if (data && data.length > 0) {
      this.detectValidColumns(data);
      this.generateMapping();
    }
  }

  /**
   * 获取所有可用的映射列名（A、B、C等）
   * @returns {Array<string>}
   */
  getAvailableColumns() {
    return Object.keys(this.mappedColumns);
  }

  /**
   * 获取所有原始列名
   * @returns {Array<string>}
   */
  getOriginalColumns() {
    return this.originalColumns;
  }

  /**
   * 获取列映射信息
   * @returns {Object}
   */
  getMappingInfo() {
    return {
      mapped: this.mappedColumns,
      reverse: this.reverseMapping,
      original: this.originalColumns
    };
  }
}

export default ColumnMapper; 