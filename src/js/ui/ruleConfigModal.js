// 规则配置弹窗组件
/**
 * RuleConfigModal - 规则配置弹窗组件
 * @author AI
 */
class RuleConfigModal {
  // 记录所有绑定事件，便于销毁时统一解绑
  constructor(columnMapper) {
    this.currentRule = null;
    this.columnMapper = columnMapper;
    this._eventUnbinders = [];
  }

  // 弹窗销毁时统一解绑所有事件
  destroyPanelEvents(panel) {
    if (this._eventUnbinders) {
      this._eventUnbinders.forEach(unbind => { try { unbind(); } catch(e){} });
      this._eventUnbinders = [];
    }
    if (panel) panel.innerHTML = '';
  }

  /**
   * 设置配置回调
   * @param {function} cb
   */
  setOnConfig(cb) {
    this.onConfig = cb;
  }

  // 通用节流函数
  throttle(fn, delay = 50) {
    let last = 0;
    return function(...args) {
      const now = Date.now();
      if (now - last > delay) {
        last = now;
        fn.apply(this, args);
      }
    };
  }
  // 通用防抖函数
  debounce(fn, delay = 200) {
    let timer = null;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // 虚拟化渲染下拉选项（只渲染前20条，滚动时动态加载，onwheel节流）
  renderVirtualizedSelect(selectEl, options, visibleCount = 20) {
    selectEl.innerHTML = '';
    let start = 0;
    let end = Math.min(visibleCount, options.length);
    const render = () => {
      selectEl.innerHTML = '';
      for (let i = start; i < end; i++) {
        const opt = document.createElement('option');
        opt.value = options[i];
        opt.textContent = options[i];
        selectEl.appendChild(opt);
      }
    };
    render();
    // 节流onwheel
    const throttledWheel = this.throttle((e) => {
      if (e.deltaY > 0 && end < options.length) {
        start = Math.min(start + 1, options.length - visibleCount);
        end = start + visibleCount;
        render();
      } else if (e.deltaY < 0 && start > 0) {
        start = Math.max(start - 1, 0);
        end = start + visibleCount;
        render();
      }
    }, 50);
    selectEl.onwheel = throttledWheel;
  }

  // 优化后的showFilterConfig，按钮加节流，输入加防抖
  showFilterConfig(columns = ['A', 'B', 'C'], hasPrevious = false) {
    console.time('showFilterConfig');
    const panel = document.getElementById('ruleConfigPanel');
    if (!panel) return;
    this.destroyPanelEvents(panel);
    panel.innerHTML = `
      <div class="rule-config-panel">
        <h3>筛选数据配置</h3>
        <form class="rule-config-form">
          <div class="form-control mb-2">
            <label>数据来源</label>
            <div class="flex gap-4 mt-1">
              <label class="cursor-pointer label">
                <input type="radio" name="data-source" value="original" checked class="radio radio-primary" />
                <span class="label-text ml-2">原始数据</span>
              </label>
              <label class="cursor-pointer label">
                <input type="radio" name="data-source" value="previous" class="radio radio-primary" ${hasPrevious ? '' : 'disabled'} />
                <span class="label-text ml-2">上一步结果${hasPrevious ? '' : '<span style=\'color:#bbb;font-size:12px;margin-left:4px\' title=\'当前无上一步结果可用\'>(不可用)</span>'}</span>
              </label>
            </div>
          </div>
          <div class="form-control">
            <label for="filter-col">选择列</label>
            <select id="filter-col" class="select select-bordered"></select>
          </div>
          <div class="form-control">
            <label for="filter-op">筛选条件</label>
            <select id="filter-op" class="select select-bordered">
              <option value="eq">等于</option>
              <option value="neq">不等于</option>
              <option value="gt">大于</option>
              <option value="lt">小于</option>
              <option value="contains">包含</option>
              <option value="notcontains">不包含</option>
              <option value="empty">为空</option>
              <option value="notempty">不为空</option>
            </select>
          </div>
          <div class="form-control">
            <label for="filter-value">筛选值</label>
            <input id="filter-value" type="text" class="input input-bordered" placeholder="请输入筛选值" />
            <div class="input-hint">如果条件为"为空"或"不为空"，此值可以留空</div>
          </div>
          <div class="btn-group">
            <button type="button" id="filter-apply" class="btn btn-primary">立即应用</button>
            <button type="button" id="filter-cancel" class="btn btn-secondary">取消</button>
          </div>
        </form>
      </div>
    `;
    // 虚拟化渲染列选项
    const colSel = panel.querySelector('#filter-col');
    this.renderVirtualizedSelect(colSel, columns);
    // 事件绑定
    const form = panel.querySelector('form');
    form.onsubmit = e => e.preventDefault();
    const applyBtn = panel.querySelector('#filter-apply');
    const cancelBtn = panel.querySelector('#filter-cancel');
    // 输入框防抖（如有复杂校验/联动）
    const valueInput = panel.querySelector('#filter-value');
    if (valueInput) {
      valueInput.oninput = this.debounce(function() {
        // 可在此处做实时校验、联动等
        // console.log('输入值:', valueInput.value);
      }, 200);
      this._eventUnbinders.push(() => { valueInput.oninput = null; });
    }
    // 按钮节流
    const throttledApply = this.throttle(() => {
      const col = panel.querySelector('#filter-col').value;
      const op = panel.querySelector('#filter-op').value;
      const value = panel.querySelector('#filter-value').value;
      const dataSource = panel.querySelector('input[name="data-source"]:checked').value;
      this.collectConfigData({type: 'filter', col, op, value, dataSource});
      this.destroyPanelEvents(panel);
      console.timeEnd('showFilterConfig');
    }, 300);
    applyBtn.onclick = throttledApply;
    const throttledCancel = this.throttle(() => {
      this.destroyPanelEvents(panel);
      console.timeEnd('showFilterConfig');
    }, 300);
    cancelBtn.onclick = throttledCancel;
    this._eventUnbinders.push(() => { applyBtn.onclick = null; });
    this._eventUnbinders.push(() => { cancelBtn.onclick = null; });
    this._eventUnbinders.push(() => { form.onsubmit = null; });
    this._eventUnbinders.push(() => { colSel.onwheel = null; });
    console.timeEnd('showFilterConfig');
  }

  // 优化后的showSortConfig，按钮加节流，输入加防抖
  showSortConfig(columns = ['A', 'B', 'C'], hasPrevious = false) {
    console.time('showSortConfig');
    const panel = document.getElementById('ruleConfigPanel');
    if (!panel) return;
    this.destroyPanelEvents(panel);
    panel.innerHTML = `
      <div class="rule-config-panel">
        <h3>排序数据配置</h3>
        <form class="rule-config-form">
          <div class="form-control mb-2">
            <label>数据来源</label>
            <div class="flex gap-4 mt-1">
              <label class="cursor-pointer label">
                <input type="radio" name="data-source" value="original" checked class="radio radio-primary" />
                <span class="label-text ml-2">原始数据</span>
              </label>
              <label class="cursor-pointer label">
                <input type="radio" name="data-source" value="previous" class="radio radio-primary" ${hasPrevious ? '' : 'disabled'} />
                <span class="label-text ml-2">上一步结果${hasPrevious ? '' : '<span style=\'color:#bbb;font-size:12px;margin-left:4px\' title=\'当前无上一步结果可用\'>(不可用)</span>'}</span>
              </label>
            </div>
          </div>
          <div class="form-control">
            <label for="sort-col">选择列</label>
            <select id="sort-col" class="select select-bordered"></select>
          </div>
          <div class="form-control">
            <label>排序方式</label>
            <div class="flex gap-4 mt-2">
              <label class="cursor-pointer label">
                <input type="radio" name="sort-order" value="asc" checked class="radio radio-primary" />
                <span class="label-text ml-2">升序</span>
              </label>
              <label class="cursor-pointer label">
                <input type="radio" name="sort-order" value="desc" class="radio radio-primary" />
                <span class="label-text ml-2">降序</span>
              </label>
            </div>
            <div class="input-hint">升序：从小到大排列；降序：从大到小排列</div>
          </div>
          <div class="btn-group">
            <button type="button" id="sort-apply" class="btn btn-primary">立即应用</button>
            <button type="button" id="sort-cancel" class="btn btn-secondary">取消</button>
          </div>
        </form>
      </div>
    `;
    // 虚拟化渲染列选项
    const colSel = panel.querySelector('#sort-col');
    this.renderVirtualizedSelect(colSel, columns);
    const form = panel.querySelector('form');
    form.onsubmit = e => e.preventDefault();
    const applyBtn = panel.querySelector('#sort-apply');
    const cancelBtn = panel.querySelector('#sort-cancel');
    // 输入框防抖（如有）
    const valueInput = panel.querySelector('#sort-value');
    if (valueInput) {
      valueInput.oninput = this.debounce(function() {
        // 实时校验、联动等
      }, 200);
      this._eventUnbinders.push(() => { valueInput.oninput = null; });
    }
    // 按钮节流
    const throttledApply = this.throttle(() => {
      const col = panel.querySelector('#sort-col').value;
      const order = panel.querySelector('input[name="sort-order"]:checked').value;
      const dataSource = panel.querySelector('input[name="data-source"]:checked').value;
      this.collectConfigData({type: 'sort', col, order, dataSource});
      this.destroyPanelEvents(panel);
      console.timeEnd('showSortConfig');
    }, 300);
    applyBtn.onclick = throttledApply;
    const throttledCancel = this.throttle(() => {
      this.destroyPanelEvents(panel);
      console.timeEnd('showSortConfig');
    }, 300);
    cancelBtn.onclick = throttledCancel;
    this._eventUnbinders.push(() => { applyBtn.onclick = null; });
    this._eventUnbinders.push(() => { cancelBtn.onclick = null; });
    this._eventUnbinders.push(() => { form.onsubmit = null; });
    this._eventUnbinders.push(() => { colSel.onwheel = null; });
    console.timeEnd('showSortConfig');
  }

  // 优化后的showProcessConfig，按钮加节流，输入加防抖
  showProcessConfig(columns = ['A', 'B', 'C'], hasPrevious = false) {
    console.time('showProcessConfig');
    const panel = document.getElementById('ruleConfigPanel');
    if (!panel) return;
    this.destroyPanelEvents(panel);
    panel.innerHTML = `
      <div class="rule-config-panel">
        <h3>处理列配置</h3>
        <form class="rule-config-form">
          <div class="form-control mb-2">
            <label>数据来源</label>
            <div class="flex gap-4 mt-1">
              <label class="cursor-pointer label">
                <input type="radio" name="data-source" value="original" checked class="radio radio-primary" />
                <span class="label-text ml-2">原始数据</span>
              </label>
              <label class="cursor-pointer label">
                <input type="radio" name="data-source" value="previous" class="radio radio-primary" ${hasPrevious ? '' : 'disabled'} />
                <span class="label-text ml-2">上一步结果${hasPrevious ? '' : '<span style=\'color:#bbb;font-size:12px;margin-left:4px\' title=\'当前无上一步结果可用\'>(不可用)</span>'}</span>
              </label>
            </div>
          </div>
          <div class="form-control">
            <label>处理操作</label>
            <div class="flex gap-4 mt-2">
              <label class="cursor-pointer label">
                <input type="radio" name="process-op" value="add" checked class="radio radio-primary" />
                <span class="label-text ml-2">加法</span>
              </label>
              <label class="cursor-pointer label">
                <input type="radio" name="process-op" value="cmp" class="radio radio-primary" />
                <span class="label-text ml-2">比对</span>
              </label>
            </div>
            <div class="input-hint">加法：对单列加数；比对：两列逐行比较</div>
          </div>
          <div class="form-control" id="process-col-area"></div>
          <div class="btn-group">
            <button type="button" id="process-apply" class="btn btn-primary">立即应用</button>
            <button type="button" id="process-cancel" class="btn btn-secondary">取消</button>
          </div>
        </form>
      </div>
    `;
    // 虚拟化渲染列选择区
    const area = panel.querySelector('#process-col-area');
    const renderColAreaAsync = (op) => {
      area.innerHTML = '';
      if (op === 'add') {
        const label = document.createElement('label');
        label.textContent = '选择列';
        const sel = document.createElement('select');
        sel.id = 'process-col';
        sel.className = 'select select-bordered';
        area.appendChild(label);
        area.appendChild(sel);
        this.renderVirtualizedSelect(sel, columns);
        this._eventUnbinders.push(() => { sel.onwheel = null; });
      } else {
        // 比对模式，两个下拉
        const label1 = document.createElement('label');
        label1.textContent = '比对列1';
        const sel1 = document.createElement('select');
        sel1.id = 'process-col1';
        sel1.className = 'select select-bordered';
        area.appendChild(label1);
        area.appendChild(sel1);
        this.renderVirtualizedSelect(sel1, columns);
        this._eventUnbinders.push(() => { sel1.onwheel = null; });
        const label2 = document.createElement('label');
        label2.textContent = '比对列2';
        const sel2 = document.createElement('select');
        sel2.id = 'process-col2';
        sel2.className = 'select select-bordered';
        area.appendChild(label2);
        area.appendChild(sel2);
        this.renderVirtualizedSelect(sel2, columns);
        this._eventUnbinders.push(() => { sel2.onwheel = null; });
        const cmpTypeLabel = document.createElement('label');
        cmpTypeLabel.textContent = '比对方式';
        const cmpTypeSel = document.createElement('select');
        cmpTypeSel.id = 'cmp-type';
        cmpTypeSel.className = 'select select-bordered';
        area.appendChild(cmpTypeLabel);
        area.appendChild(cmpTypeSel);
        this.renderVirtualizedSelect(cmpTypeSel, ['gt', 'eq', 'lt']);
        this._eventUnbinders.push(() => { cmpTypeSel.onwheel = null; });
      }
    };
    renderColAreaAsync('add');
    panel.querySelectorAll('input[name="process-op"]').forEach(radio => {
      radio.onchange = e => {
        renderColAreaAsync(e.target.value);
      };
      this._eventUnbinders.push(() => { radio.onchange = null; });
    });
    const form = panel.querySelector('form');
    form.onsubmit = e => e.preventDefault();
    const applyBtn = panel.querySelector('#process-apply');
    const cancelBtn = panel.querySelector('#process-cancel');
    // 输入框防抖（如有）
    const valueInput = panel.querySelector('#process-value');
    if (valueInput) {
      valueInput.oninput = this.debounce(function() {
        // 实时校验、联动等
      }, 200);
      this._eventUnbinders.push(() => { valueInput.oninput = null; });
    }
    // 按钮节流
    const throttledApply = this.throttle(() => {
      const op = panel.querySelector('input[name="process-op"]:checked').value;
      const dataSource = panel.querySelector('input[name="data-source"]:checked').value;
      if (op === 'add') {
        const col = panel.querySelector('#process-col').value;
        this.collectConfigData({type: 'process', op: 'add', col, dataSource});
      } else {
        const col1 = panel.querySelector('#process-col1').value;
        const col2 = panel.querySelector('#process-col2').value;
        const cmpType = panel.querySelector('#cmp-type').value;
        if (col1 === col2) {
          alert('比对列1和比对列2不能相同！');
          return;
        }
        this.collectConfigData({type: 'process', op: 'cmp', col1, col2, cmpType, dataSource});
      }
      this.destroyPanelEvents(panel);
      console.timeEnd('showProcessConfig');
    }, 300);
    applyBtn.onclick = throttledApply;
    const throttledCancel = this.throttle(() => {
      this.destroyPanelEvents(panel);
      console.timeEnd('showProcessConfig');
    }, 300);
    cancelBtn.onclick = throttledCancel;
    this._eventUnbinders.push(() => { applyBtn.onclick = null; });
    this._eventUnbinders.push(() => { cancelBtn.onclick = null; });
    this._eventUnbinders.push(() => { form.onsubmit = null; });
    this._eventUnbinders.push(() => { colSel.onwheel = null; });
    console.timeEnd('showProcessConfig');
  }

  /**
   * 显示合并表格配置（内嵌模块重构）
   */
  showMergeConfig(uploadedFiles = [], hasPrevious = false) {
    const panel = document.getElementById('ruleConfigPanel');
    if (!panel) return;
    this.destroyPanelEvents(panel);
    panel.innerHTML = `
      <div class="rule-config-panel">
        <h3>合并表格配置</h3>
        <form class="rule-config-form">
          <div class="form-control mb-2">
            <label>数据来源</label>
            <div class="flex gap-4 mt-1">
              <label class="cursor-pointer label">
                <input type="radio" name="data-source" value="original" checked class="radio radio-primary" />
                <span class="label-text ml-2">原始数据</span>
              </label>
              <label class="cursor-pointer label">
                <input type="radio" name="data-source" value="previous" class="radio radio-primary" ${hasPrevious ? '' : 'disabled'} />
                <span class="label-text ml-2">上一步结果${hasPrevious ? '' : '<span style=\'color:#bbb;font-size:12px;margin-left:4px\' title=\'当前无上一步结果可用\'>(不可用)</span>'}</span>
              </label>
            </div>
          </div>
          <div class="form-control">
            <label>合并类型</label>
            <div class="flex gap-4 mt-2">
              <label class="cursor-pointer label">
                <input type="radio" name="merge-type" value="files" checked class="radio radio-primary" />
                <span class="label-text ml-2">多文件合并</span>
              </label>
              <label class="cursor-pointer label">
                <input type="radio" name="merge-type" value="sheets" class="radio radio-primary" />
                <span class="label-text ml-2">多Sheet合并</span>
              </label>
            </div>
            <div class="input-hint">多文件合并：合并多个Excel/CSV文件；多Sheet合并：合并同一文件的多个工作表</div>
          </div>
          <div class="form-control mt-4">
            <label>当前已上传文件</label>
            <ul class="uploaded-file-list">
              ${uploadedFiles.length === 0 ? '<li class="text-gray-400">暂无已上传文件</li>' : uploadedFiles.map(f => `<li>${f.fileName || f.name}</li>`).join('')}
            </ul>
            <div class="input-hint text-xs text-gray-500 mt-1">如需更换文件，请到主上传区操作</div>
          </div>
          <div class="btn-group mt-6">
            <button type="button" id="merge-apply" class="btn btn-primary">立即应用</button>
            <button type="button" id="merge-cancel" class="btn btn-secondary">取消</button>
          </div>
        </form>
      </div>
    `;
    const form = panel.querySelector('form');
    form.onsubmit = e => e.preventDefault();
    const applyBtn = panel.querySelector('#merge-apply');
    const cancelBtn = panel.querySelector('#merge-cancel');
    applyBtn.onclick = () => {
      const type = panel.querySelector('input[name="merge-type"]:checked').value;
      const dataSource = panel.querySelector('input[name="data-source"]:checked').value;
      // 只收集合并类型参数
      this.collectConfigData({ type: 'merge', mergeType: type, dataSource });
      this.destroyPanelEvents(panel);
    };
    cancelBtn.onclick = () => {
      this.destroyPanelEvents(panel);
    };
    this._eventUnbinders.push(() => { applyBtn.onclick = null; });
    this._eventUnbinders.push(() => { cancelBtn.onclick = null; });
    this._eventUnbinders.push(() => { form.onsubmit = null; });
  }

  // 收集配置数据
  collectConfigData(config) {
    console.time('collectConfigData');
    if (typeof this.onConfig === 'function') {
      this.onConfig(config);
    }
    console.timeEnd('collectConfigData');
  }
}

export default RuleConfigModal; 