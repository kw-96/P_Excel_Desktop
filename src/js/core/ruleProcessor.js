// 规则处理器
/**
 * RuleProcessor - 规则处理器，支持筛选、排序、处理列、合并表格
 * @author AI
 */
class RuleProcessor {
  /**
   * @param {Array<Object>} data - 当前表格数据
   * @param {ColumnMapper} columnMapper - 列名映射工具
   */
  constructor(data, columnMapper) {
    this.data = data;
    this.columnMapper = columnMapper;
  }

  /**
   * 更新数据并重新生成列映射
   * @param {Array<Object>} newData - 新的数据
   */
  updateData(newData) {
    this.data = newData;
    // 更新ColumnMapper的数据
    if (this.columnMapper && newData && newData.length > 0) {
      this.columnMapper.detectValidColumns(newData);
      this.columnMapper.generateMapping();
    }
  }

  /**
   * 更新列映射器
   * @param {ColumnMapper} columnMapper - 新的列映射器
   */
  updateColumnMapper(columnMapper) {
    this.columnMapper = columnMapper;
  }

  /**
   * 筛选数据
   * @param {Object} config {type: 'filter', col, op, value}
   * @returns {Array<Object>}
   */
  filter(config) {
    if (!Array.isArray(this.data)) {
      throw new Error('待筛选数据无效，无法执行filter操作');
    }
    const colName = this.columnMapper.getOriginalColumn(config.col);
    return this.data.filter(row => {
      const v = row[colName];
      switch (config.op) {
        case 'eq': return v == config.value;
        case 'neq': return v != config.value;
        case 'gt': return parseFloat(v) > parseFloat(config.value);
        case 'lt': return parseFloat(v) < parseFloat(config.value);
        case 'contains': return String(v).includes(config.value);
        case 'notcontains': return !String(v).includes(config.value);
        case 'empty': return v === '' || v === null || v === undefined;
        case 'notempty': return v !== '' && v !== null && v !== undefined;
        default: return true;
      }
    });
  }

  /**
   * 排序数据
   * @param {Object} config {type: 'sort', col, order}
   * @returns {Array<Object>}
   */
  sort(config) {
    const colName = this.columnMapper.getOriginalColumn(config.col);
    const sorted = [...this.data];
    sorted.sort((a, b) => {
      const va = a[colName];
      const vb = b[colName];
      if (config.order === 'asc') {
        return va > vb ? 1 : va < vb ? -1 : 0;
      } else {
        return va < vb ? 1 : va > vb ? -1 : 0;
      }
    });
    return sorted;
  }

  /**
   * 处理列（加法/比对）
   * @param {Object} config {type: 'process', op, col, value} 或 {type: 'process', op: 'cmp', col1, col2, cmpType}
   * @returns {Array<Object>}
   */
  process(config) {
    if (config.op === 'add') {
      // 单列自动求和，结果显示在最后一行
      const colName = this.columnMapper.getOriginalColumn(config.col);
      let sum = 0;
      this.data.forEach(row => {
        const v = parseFloat(row[colName]);
        if (!isNaN(v)) sum += v;
      });
      const newRow = {};
      Object.keys(this.data[0] || {}).forEach(k => { newRow[k] = ''; });
      newRow[colName] = sum;
      return [...this.data, newRow];
    } else if (config.op === 'cmp') {
      // 两列比对，优先数值比对，若为NaN则字符串比对，空值输出“否”，只保留比对结果为“是”的行，剔除“比对结果”字段
      const col1 = this.columnMapper.getOriginalColumn(config.col1);
      const col2 = this.columnMapper.getOriginalColumn(config.col2);
      const cmpType = config.cmpType; // gt/eq/lt
      const resultCol = '比对结果';
      return this.data.map(row => {
        let v1 = row[col1];
        let v2 = row[col2];
        let cmpResult = false;
        const n1 = parseFloat(v1), n2 = parseFloat(v2);
        if (v1 === undefined || v2 === undefined || v1 === '' || v2 === '') {
          cmpResult = false;
        } else if (!isNaN(n1) && !isNaN(n2)) {
          if (cmpType === 'gt') cmpResult = n1 > n2;
          else if (cmpType === 'eq') cmpResult = n1 === n2;
          else if (cmpType === 'lt') cmpResult = n1 < n2;
        } else {
          if (cmpType === 'gt') cmpResult = String(v1) > String(v2);
          else if (cmpType === 'eq') cmpResult = String(v1) === String(v2);
          else if (cmpType === 'lt') cmpResult = String(v1) < String(v2);
        }
        return { ...row, [resultCol]: cmpResult ? '是' : '否' };
      }).filter(row => row[resultCol] === '是').map(row => {
        const { [resultCol]: _, ...rest } = row;
        return rest;
      });
    }
    return this.data;
  }

  /**
   * 异步分批处理列（加法/比对），每批处理batchSize行，处理完成后回调
   * @param {Object} config
   * @param {function} onProgress (percent, partialResult) 进度回调
   * @param {number} batchSize 每批处理行数，默认1000
   * @returns {Promise<Array<Object>>}
   */
  async processAsync(config, onProgress, batchSize = 1000) {
    const total = this.data.length;
    let result = [];
    let i = 0;
    if (config.op === 'add') {
      // 单列自动求和，最后一行显示总和
      const colName = this.columnMapper.getOriginalColumn(config.col);
      let sum = 0;
      const processBatch = () => {
        const end = Math.min(i + batchSize, total);
        for (; i < end; i++) {
          const row = this.data[i];
          const v = parseFloat(row[colName]);
          if (!isNaN(v)) sum += v;
          result.push({ ...row });
        }
        if (i < total) {
          onProgress && onProgress(Math.round((i / total) * 100), result);
          setTimeout(processBatch, 0);
        } else {
          // 末尾加总和行
          const newRow = {};
          Object.keys(this.data[0] || {}).forEach(k => { newRow[k] = ''; });
          newRow[colName] = sum;
          result.push(newRow);
          onProgress && onProgress(100, result);
        }
      };
      await new Promise(resolve => {
        processBatch();
        const check = () => { if (i >= total) resolve(); else setTimeout(check, 10); };
        check();
      });
      return result;
    } else if (config.op === 'cmp') {
      // 两列比对，分批处理
      const col1 = this.columnMapper.getOriginalColumn(config.col1);
      const col2 = this.columnMapper.getOriginalColumn(config.col2);
      const cmpType = config.cmpType;
      const resultCol = '比对结果';
      const temp = [];
      const processBatch = () => {
        const end = Math.min(i + batchSize, total);
        for (; i < end; i++) {
          const row = this.data[i];
          let v1 = row[col1];
          let v2 = row[col2];
          let cmpResult = false;
          const n1 = parseFloat(v1), n2 = parseFloat(v2);
          if (v1 === undefined || v2 === undefined || v1 === '' || v2 === '') {
            cmpResult = false;
          } else if (!isNaN(n1) && !isNaN(n2)) {
            if (cmpType === 'gt') cmpResult = n1 > n2;
            else if (cmpType === 'eq') cmpResult = n1 === n2;
            else if (cmpType === 'lt') cmpResult = n1 < n2;
          } else {
            if (cmpType === 'gt') cmpResult = String(v1) > String(v2);
            else if (cmpType === 'eq') cmpResult = String(v1) === String(v2);
            else if (cmpType === 'lt') cmpResult = String(v1) < String(v2);
          }
          temp.push({ ...row, [resultCol]: cmpResult ? '是' : '否' });
        }
        if (i < total) {
          onProgress && onProgress(Math.round((i / total) * 100), temp);
          setTimeout(processBatch, 0);
        } else {
          // 过滤和剔除比对结果字段
          result = temp.filter(row => row[resultCol] === '是').map(row => {
            const { [resultCol]: _, ...rest } = row;
            return rest;
          });
          onProgress && onProgress(100, result);
        }
      };
      await new Promise(resolve => {
        processBatch();
        const check = () => { if (i >= total) resolve(); else setTimeout(check, 10); };
        check();
      });
      return result;
    }
    // 其它操作暂不同步
    return this.data;
  }

  /**
   * 异步分批筛选数据
   * @param {Object} config
   * @param {function} onProgress (percent, partialResult)
   * @param {number} batchSize
   * @returns {Promise<Array<Object>>}
   */
  async filterAsync(config, onProgress, batchSize = 500) {
    if (!Array.isArray(this.data)) throw new Error('待筛选数据无效，无法执行filter操作');
    const colName = this.columnMapper.getOriginalColumn(config.col);
    const total = this.data.length;
    let i = 0;
    let result = [];
    const processBatch = () => {
      const end = Math.min(i + batchSize, total);
      for (; i < end; i++) {
        const row = this.data[i];
        const v = row[colName];
        let keep = true;
        switch (config.op) {
          case 'eq': keep = v == config.value; break;
          case 'neq': keep = v != config.value; break;
          case 'gt': keep = parseFloat(v) > parseFloat(config.value); break;
          case 'lt': keep = parseFloat(v) < parseFloat(config.value); break;
          case 'contains': keep = String(v).includes(config.value); break;
          case 'notcontains': keep = !String(v).includes(config.value); break;
          case 'empty': keep = v === '' || v === null || v === undefined; break;
          case 'notempty': keep = v !== '' && v !== null && v !== undefined; break;
          default: keep = true;
        }
        if (keep) result.push(row);
      }
      if (i < total) {
        onProgress && onProgress(Math.round((i / total) * 100), result);
        setTimeout(processBatch, 0);
      } else {
        onProgress && onProgress(100, result);
      }
    };
    await new Promise(resolve => {
      processBatch();
      const check = () => { if (i >= total) resolve(); else setTimeout(check, 10); };
      check();
    });
    return result;
  }

  /**
   * 异步分批排序数据
   * @param {Object} config
   * @param {function} onProgress (percent, partialResult)
   * @param {number} batchSize
   * @returns {Promise<Array<Object>>}
   */
  async sortAsync(config, onProgress, batchSize = 500) {
    const colName = this.columnMapper.getOriginalColumn(config.col);
    const total = this.data.length;
    let sorted = [...this.data];
    // 先整体排序
    sorted.sort((a, b) => {
      const va = a[colName];
      const vb = b[colName];
      if (config.order === 'asc') {
        return va > vb ? 1 : va < vb ? -1 : 0;
      } else {
        return va < vb ? 1 : va > vb ? -1 : 0;
      }
    });
    // 分批回调
    let i = 0;
    let result = [];
    const processBatch = () => {
      const end = Math.min(i + batchSize, total);
      for (; i < end; i++) {
        result.push(sorted[i]);
      }
      if (i < total) {
        onProgress && onProgress(Math.round((i / total) * 100), result);
        setTimeout(processBatch, 0);
      } else {
        onProgress && onProgress(100, result);
      }
    };
    await new Promise(resolve => {
      processBatch();
      const check = () => { if (i >= total) resolve(); else setTimeout(check, 10); };
      check();
    });
    return result;
  }

  /**
   * 异步分批合并表格
   * @param {Object} config {type: 'merge', mergeType, files}
   * @param {function} onProgress (percent, partialResult)
   * @param {number} batchSize
   * @returns {Promise<Array<Object>>}
   */
  async mergeAsync(config, onProgress, batchSize = 500) {
    if (!config.files || !config.files.length) return this.data;
    let merged = [];
    let total = 0;
    config.files.forEach(arr => { total += arr.length; });
    let i = 0;
    let fileIdx = 0, rowIdx = 0;
    const processBatch = () => {
      let count = 0;
      while (fileIdx < config.files.length && count < batchSize) {
        const fileArr = config.files[fileIdx];
        while (rowIdx < fileArr.length && count < batchSize) {
          merged.push(fileArr[rowIdx]);
          rowIdx++;
          i++;
          count++;
        }
        if (rowIdx >= fileArr.length) {
          fileIdx++;
          rowIdx = 0;
        }
      }
      if (i < total) {
        onProgress && onProgress(Math.round((i / total) * 100), merged);
        setTimeout(processBatch, 0);
      } else {
        onProgress && onProgress(100, merged);
      }
    };
    await new Promise(resolve => {
      processBatch();
      const check = () => { if (i >= total) resolve(); else setTimeout(check, 10); };
      check();
    });
    return merged;
  }

  /**
   * 合并表格（多文件/多sheet）
   * @param {Object} config {type: 'merge', mergeType, files}
   *   mergeType: 'files' | 'sheets'
   *   files: Array<Array<Object>>  // 已解析数据数组，来源为主上传区
   * @returns {Array<Object>}
   */
  merge(config) {
    // 这里只实现同步接口，实际多文件/多sheet需异步读取文件内容
    // 假设files为已解析的表格数据数组（每个元素为Array<Object>）
    if (!config.files || !config.files.length) return this.data;
    let merged = [];
    for (let i = 0; i < config.files.length; i++) {
      // files[i] 应为 Array<Object>
      merged = merged.concat(Array.from(config.files[i]));
    }
    return merged;
    // 实际项目中，需在主流程先用SheetJS解析文件/Sheet为数据数组后传入此方法
  }
}

export default RuleProcessor; 