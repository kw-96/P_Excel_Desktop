// RuleXcel Web Worker: 分批处理所有规则，主线程通过postMessage通信
// 支持规则类型：filter/sort/process/merge
// 消息格式：{ type: 'run', ruleConfig, data, batchSize }
// 进度消息：{ type: 'progress', percent, partialResult }
// 结果消息：{ type: 'result', data }
// 异常消息：{ type: 'error', message }

self.onmessage = function(e) {
  const { type, ruleConfig, data, batchSize = 500 } = e.data;
  if (type !== 'run') return;
  try {
    switch (ruleConfig.type) {
      case 'filter':
        filterAsync(data, ruleConfig, batchSize);
        break;
      case 'sort':
        sortAsync(data, ruleConfig, batchSize);
        break;
      case 'process':
        processAsync(data, ruleConfig, batchSize);
        break;
      case 'merge':
        mergeAsync(data, ruleConfig, batchSize);
        break;
      default:
        throw new Error('未知规则类型: ' + ruleConfig.type);
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message });
  }
};

function filterAsync(data, config, batchSize) {
  const colName = config.col;
  const total = data.length;
  let i = 0;
  let result = [];
  let lastPercent = 0;
  function processBatch() {
    const end = Math.min(i + batchSize, total);
    for (; i < end; i++) {
      const row = data[i];
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
    const percent = Math.round((i / total) * 100);
    if (percent - lastPercent >= 2 || percent === 100) {
      self.postMessage({ type: 'progress', percent, partialResult: percent === 100 ? result : undefined });
      lastPercent = percent;
    }
    if (i < total) {
      requestAnimationFrame(processBatch);
    } else {
      self.postMessage({ type: 'result', data: result });
    }
  }
  processBatch();
}

function sortAsync(data, config, batchSize) {
  const colName = config.col;
  const total = data.length;
  let sorted = [...data];
  sorted.sort((a, b) => {
    const va = a[colName];
    const vb = b[colName];
    if (config.order === 'asc') {
      return va > vb ? 1 : va < vb ? -1 : 0;
    } else {
      return va < vb ? 1 : va > vb ? -1 : 0;
    }
  });
  let i = 0;
  let result = [];
  let lastPercent = 0;
  function processBatch() {
    const end = Math.min(i + batchSize, total);
    for (; i < end; i++) {
      result.push(sorted[i]);
    }
    const percent = Math.round((i / total) * 100);
    if (percent - lastPercent >= 2 || percent === 100) {
      self.postMessage({ type: 'progress', percent, partialResult: percent === 100 ? result : undefined });
      lastPercent = percent;
    }
    if (i < total) {
      requestAnimationFrame(processBatch);
    } else {
      self.postMessage({ type: 'result', data: result });
    }
  }
  processBatch();
}

function processAsync(data, config, batchSize) {
  if (config.op === 'add') {
    const colName = config.col;
    let sum = 0;
    let i = 0;
    let result = [];
    let lastPercent = 0;
    function processBatch() {
      const end = Math.min(i + batchSize, data.length);
      for (; i < end; i++) {
        const row = data[i];
        const v = parseFloat(row[colName]);
        if (!isNaN(v)) sum += v;
        result.push({ ...row });
      }
      const percent = Math.round((i / data.length) * 100);
      if (percent - lastPercent >= 2 || percent === 100) {
        self.postMessage({ type: 'progress', percent, partialResult: percent === 100 ? result : undefined });
        lastPercent = percent;
      }
      if (i < data.length) {
        requestAnimationFrame(processBatch);
      } else {
        // 末尾加总和行
        const newRow = {};
        Object.keys(data[0] || {}).forEach(k => { newRow[k] = ''; });
        newRow[colName] = sum;
        result.push(newRow);
        self.postMessage({ type: 'result', data: result });
      }
    }
    processBatch();
  } else if (config.op === 'cmp') {
    const col1 = config.col1;
    const col2 = config.col2;
    const cmpType = config.cmpType;
    const resultCol = '比对结果';
    let i = 0;
    let temp = [];
    let lastPercent = 0;
    function processBatch() {
      const end = Math.min(i + batchSize, data.length);
      for (; i < end; i++) {
        const row = data[i];
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
      const percent = Math.round((i / data.length) * 100);
      if (percent - lastPercent >= 2 || percent === 100) {
        self.postMessage({ type: 'progress', percent, partialResult: percent === 100 ? temp : undefined });
        lastPercent = percent;
      }
      if (i < data.length) {
        requestAnimationFrame(processBatch);
      } else {
        // 过滤和剔除比对结果字段
        const result = temp.filter(row => row[resultCol] === '是').map(row => {
          const { [resultCol]: _, ...rest } = row;
          return rest;
        });
        self.postMessage({ type: 'result', data: result });
      }
    }
    processBatch();
  } else {
    self.postMessage({ type: 'result', data });
  }
}

function mergeAsync(data, config, batchSize) {
  // data为主上传区合并后的数据，config.files为多文件/多sheet数组
  if (!config.files || !config.files.length) {
    self.postMessage({ type: 'result', data });
    return;
  }
  let merged = [];
  let total = 0;
  config.files.forEach(arr => { total += arr.length; });
  let i = 0;
  let fileIdx = 0, rowIdx = 0;
  let lastPercent = 0;
  function processBatch() {
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
    const percent = Math.round((i / total) * 100);
    if (percent - lastPercent >= 2 || percent === 100) {
      self.postMessage({ type: 'progress', percent, partialResult: percent === 100 ? merged : undefined });
      lastPercent = percent;
    }
    if (i < total) {
      requestAnimationFrame(processBatch);
    } else {
      self.postMessage({ type: 'result', data: merged });
    }
  }
  processBatch();
} 