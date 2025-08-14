// columnWorker.js - 弹窗参数/列选项Web Worker
// 消息格式：{ type: 'columns', data }  // data为原始数据数组
// 返回：{ type: 'columns', columns: [...], extra: {...} }

self.onmessage = function(e) {
  const { type, data } = e.data;
  if (type === 'columns') {
    try {
      // 1. 获取所有列名
      let columns = [];
      if (Array.isArray(data) && data.length > 0) {
        const colSet = new Set();
        data.forEach(row => {
          Object.keys(row).forEach(k => colSet.add(k));
        });
        columns = Array.from(colSet);
      }
      // 2. 排序（可按字母或自定义）
      columns.sort();
      // 3. 可扩展类型推断、分组等
      self.postMessage({ type: 'columns', columns });
    } catch (err) {
      self.postMessage({ type: 'error', message: err.message });
    }
  }
}; 