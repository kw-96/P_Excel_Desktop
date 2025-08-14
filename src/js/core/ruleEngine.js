/**
 * 可视化规则引擎
 * 提供无代码的数据处理规则构建功能
 */

/**
 * 规则类型枚举
 */
const RULE_TYPES = {
    FILTER: 'filter',
    SORT: 'sort',
    MERGE: 'merge'
};

/**
 * 比较操作符枚举
 */
const OPERATORS = {
    EQUAL: '==',
    NOT_EQUAL: '!=',
    GREATER: '>',
    GREATER_EQUAL: '>=',
    LESS: '<',
    LESS_EQUAL: '<=',
    CONTAINS: 'contains',
    NOT_CONTAINS: 'not_contains',
    STARTS_WITH: 'starts_with',
    ENDS_WITH: 'ends_with',
    IS_EMPTY: 'is_empty',
    IS_NOT_EMPTY: 'is_not_empty'
};

/**
 * 逻辑连接符枚举
 */
const LOGICAL_OPERATORS = {
    AND: 'and',
    OR: 'or'
};

/**
 * 可视化规则引擎类
 */
class VisualRuleEngine {
    constructor() {
        this.filterConditions = [];
        this.sortConditions = [];
        this.mergeConfig = null;
        this.availableColumns = [];
        this.conditionCounter = 0;
        
        this.init();
    }

    /**
     * 初始化规则引擎
     */
    init() {
        this.bindEvents();
        this.initializeTabs();
    }

    /**
     * 绑定界面事件
     */
    bindEvents() {
        // 筛选条件相关事件
        document.getElementById('add-filter-condition')?.addEventListener('click', () => this.addFilterCondition());
        
        // 排序条件相关事件
        document.getElementById('add-sort-condition')?.addEventListener('click', () => this.addSortCondition());
        
        // 合并规则相关事件
        document.getElementById('merge-type')?.addEventListener('change', (e) => this.handleMergeTypeChange(e.target.value));
        
        // 标签页切换
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
        
        // 规则操作按钮
        document.getElementById('clear-rules')?.addEventListener('click', () => this.clearAllRules());
    }

    /**
     * 初始化标签页
     */
    initializeTabs() {
        this.switchTab('filter');
    }

    /**
     * 切换标签页
     * @param {string} tabName - 标签页名称
     */
    switchTab(tabName) {
        // 隐藏所有标签内容
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
        });
        
        // 移除所有标签的激活状态
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('tab-active');
        });
        
        // 显示选中的标签内容
        document.getElementById(`${tabName}-rules`)?.classList.remove('hidden');
        
        // 激活选中的标签
        document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('tab-active');
    }

    /**
     * 设置可用列名
     * @param {Array} columns - 列名数组
     */
    setAvailableColumns(columns) {
        this.availableColumns = columns;
        this.updateColumnSelectors();
    }

    /**
     * 更新所有列选择器
     */
    updateColumnSelectors() {
        // 更新筛选条件中的列选择器
        document.querySelectorAll('.filter-column-select').forEach(select => {
            this.updateColumnSelect(select);
        });
        
        // 更新排序条件中的列选择器
        document.querySelectorAll('.sort-column-select').forEach(select => {
            this.updateColumnSelect(select);
        });
    }

    /**
     * 更新单个列选择器
     * @param {HTMLSelectElement} select - 选择框元素
     */
    updateColumnSelect(select) {
        const currentValue = select.value;
        select.innerHTML = '<option value="">请选择列</option>';
        
        this.availableColumns.forEach(column => {
            const option = document.createElement('option');
            option.value = column;
            option.textContent = column;
            if (column === currentValue) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    }

    /**
     * 添加筛选条件
     */
    addFilterCondition() {
        const conditionId = `filter-condition-${++this.conditionCounter}`;
        const container = document.getElementById('filter-conditions');
        
        const conditionHtml = this.createFilterConditionHtml(conditionId);
        container.insertAdjacentHTML('beforeend', conditionHtml);
        
        // 绑定事件
        this.bindFilterConditionEvents(conditionId);
        
        // 更新列选择器
        this.updateColumnSelect(document.querySelector(`#${conditionId} .filter-column-select`));
        
        // 更新预览
        this.updateFilterPreview();
    }

    /**
     * 创建筛选条件HTML
     * @param {string} conditionId - 条件ID
     * @returns {string} HTML字符串
     */
    createFilterConditionHtml(conditionId) {
        return `
            <div id="${conditionId}" class="filter-condition p-4 bg-base-100 rounded-lg border">
                <div class="grid grid-cols-1 md:grid-cols-6 gap-2 items-center">
                    <!-- 逻辑连接符 -->
                    <div class="logical-operator">
                        ${this.conditionCounter > 1 ? `
                            <select class="select select-sm select-bordered logical-select" title="逻辑连接符">
                                <option value="and">并且</option>
                                <option value="or">或者</option>
                            </select>
                        ` : '<span class="text-sm text-base-content/50">条件</span>'}
                    </div>
                    
                    <!-- 列选择 -->
                    <div>
                        <select class="select select-sm select-bordered filter-column-select" title="选择列">
                            <option value="">请选择列</option>
                        </select>
                    </div>
                    
                    <!-- 操作符选择 -->
                    <div>
                        <select class="select select-sm select-bordered operator-select" title="比较操作符">
                            <option value="">操作符</option>
                            <option value="==">=等于</option>
                            <option value="!=">≠不等于</option>
                            <option value=">">＞大于</option>
                            <option value=">="≥大于等于</option>
                            <option value="<">＜小于</option>
                            <option value="<="≤小于等于</option>
                            <option value="contains">包含</option>
                            <option value="not_contains">不包含</option>
                            <option value="starts_with">开头是</option>
                            <option value="ends_with">结尾是</option>
                            <option value="is_empty">为空</option>
                            <option value="is_not_empty">不为空</option>
                        </select>
                    </div>
                    
                    <!-- 值类型选择 -->
                    <div>
                        <select class="select select-sm select-bordered value-type-select" title="值类型">
                            <option value="fixed">固定值</option>
                            <option value="column">列值</option>
                        </select>
                    </div>
                    
                    <!-- 值输入 -->
                    <div class="value-input-container">
                        <input type="text" class="input input-sm input-bordered value-input" placeholder="输入值" title="筛选值">
                    </div>
                    
                    <!-- 删除按钮 -->
                    <div>
                        <button class="btn btn-sm btn-error btn-outline delete-condition" title="删除条件">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1H8a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 绑定筛选条件事件
     * @param {string} conditionId - 条件ID
     */
    bindFilterConditionEvents(conditionId) {
        const container = document.getElementById(conditionId);
        
        // 删除条件事件
        container.querySelector('.delete-condition').addEventListener('click', () => {
            this.deleteFilterCondition(conditionId);
        });
        
        // 值类型变化事件
        container.querySelector('.value-type-select').addEventListener('change', (e) => {
            this.handleValueTypeChange(conditionId, e.target.value);
        });
        
        // 操作符变化事件
        container.querySelector('.operator-select').addEventListener('change', (e) => {
            this.handleOperatorChange(conditionId, e.target.value);
        });
        
        // 条件变化事件
        container.addEventListener('change', () => {
            this.updateFilterPreview();
        });
    }

    /**
     * 处理值类型变化
     * @param {string} conditionId - 条件ID
     * @param {string} valueType - 值类型
     */
    handleValueTypeChange(conditionId, valueType) {
        const container = document.getElementById(conditionId);
        const valueContainer = container.querySelector('.value-input-container');
        
        if (valueType === 'column') {
            // 显示列选择器
            valueContainer.innerHTML = `
                <select class="select select-sm select-bordered column-value-select" title="选择比较列">
                    <option value="">请选择列</option>
                </select>
            `;
            this.updateColumnSelect(valueContainer.querySelector('.column-value-select'));
        } else {
            // 显示文本输入框
            valueContainer.innerHTML = `
                <input type="text" class="input input-sm input-bordered value-input" placeholder="输入值" title="筛选值">
            `;
        }
        
        this.updateFilterPreview();
    }

    /**
     * 处理操作符变化
     * @param {string} conditionId - 条件ID
     * @param {string} operator - 操作符
     */
    handleOperatorChange(conditionId, operator) {
        const container = document.getElementById(conditionId);
        const valueContainer = container.querySelector('.value-input-container');
        
        // 如果是is_empty或is_not_empty，隐藏值输入
        if (operator === 'is_empty' || operator === 'is_not_empty') {
            valueContainer.style.display = 'none';
        } else {
            valueContainer.style.display = 'block';
        }
        
        this.updateFilterPreview();
    }

    /**
     * 删除筛选条件
     * @param {string} conditionId - 条件ID
     */
    deleteFilterCondition(conditionId) {
        document.getElementById(conditionId)?.remove();
        this.updateFilterPreview();
        
        // 如果删除后只剩一个条件，隐藏第一个条件的逻辑连接符
        const conditions = document.querySelectorAll('.filter-condition');
        if (conditions.length === 1) {
            const firstCondition = conditions[0];
            const logicalOperator = firstCondition.querySelector('.logical-select');
            logicalOperator.innerHTML = '<span class="text-sm text-base-content/50">条件</span>';
        }
    }

    /**
     * 添加排序条件
     */
    addSortCondition() {
        const conditionId = `sort-condition-${++this.conditionCounter}`;
        const container = document.getElementById('sort-conditions');
        
        const conditionHtml = this.createSortConditionHtml(conditionId);
        container.insertAdjacentHTML('beforeend', conditionHtml);
        
        // 绑定事件
        this.bindSortConditionEvents(conditionId);
        
        // 更新列选择器
        this.updateColumnSelect(document.querySelector(`#${conditionId} .sort-column-select`));
        
        // 更新预览
        this.updateSortPreview();
    }

    /**
     * 创建排序条件HTML
     * @param {string} conditionId - 条件ID
     * @returns {string} HTML字符串
     */
    createSortConditionHtml(conditionId) {
        const conditions = document.querySelectorAll('.sort-condition').length;
        return `
            <div id="${conditionId}" class="sort-condition p-3 bg-base-100 rounded-lg border">
                <div class="flex items-center gap-3">
                    <!-- 优先级 -->
                    <div class="flex items-center gap-1">
                        <span class="text-sm text-base-content/70">优先级:</span>
                        <span class="badge badge-outline">${conditions + 1}</span>
                    </div>
                    
                    <!-- 列选择 -->
                    <div class="flex-1">
                        <select class="select select-sm select-bordered sort-column-select w-full" title="选择排序列">
                            <option value="">请选择列</option>
                        </select>
                    </div>
                    
                    <!-- 排序方向 -->
                    <div>
                        <select class="select select-sm select-bordered sort-direction-select" title="排序方向">
                            <option value="asc">升序 ↑</option>
                            <option value="desc">降序 ↓</option>
                        </select>
                    </div>
                    
                    <!-- 控制按钮 -->
                    <div class="flex gap-1">
                        <button class="btn btn-xs btn-outline move-up" title="上移" ${conditions === 0 ? 'disabled' : ''}>
                            ↑
                        </button>
                        <button class="btn btn-xs btn-outline move-down" title="下移">
                            ↓
                        </button>
                        <button class="btn btn-xs btn-error btn-outline delete-sort-condition" title="删除">
                            ×
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 绑定排序条件事件
     * @param {string} conditionId - 条件ID
     */
    bindSortConditionEvents(conditionId) {
        const container = document.getElementById(conditionId);
        
        // 删除条件事件
        container.querySelector('.delete-sort-condition').addEventListener('click', () => {
            this.deleteSortCondition(conditionId);
        });
        
        // 上移事件
        container.querySelector('.move-up').addEventListener('click', () => {
            this.moveSortCondition(conditionId, 'up');
        });
        
        // 下移事件
        container.querySelector('.move-down').addEventListener('click', () => {
            this.moveSortCondition(conditionId, 'down');
        });
        
        // 条件变化事件
        container.addEventListener('change', () => {
            this.updateSortPreview();
        });
    }

    /**
     * 删除排序条件
     * @param {string} conditionId - 条件ID
     */
    deleteSortCondition(conditionId) {
        document.getElementById(conditionId)?.remove();
        this.updateSortConditionNumbers();
        this.updateSortPreview();
    }

    /**
     * 移动排序条件
     * @param {string} conditionId - 条件ID
     * @param {string} direction - 移动方向 ('up' | 'down')
     */
    moveSortCondition(conditionId, direction) {
        const condition = document.getElementById(conditionId);
        const sibling = direction === 'up' ? condition.previousElementSibling : condition.nextElementSibling;
        
        if (sibling) {
            const parent = condition.parentNode;
            if (direction === 'up') {
                parent.insertBefore(condition, sibling);
            } else {
                parent.insertBefore(sibling, condition);
            }
            this.updateSortConditionNumbers();
            this.updateSortPreview();
        }
    }

    /**
     * 更新排序条件编号
     */
    updateSortConditionNumbers() {
        const conditions = document.querySelectorAll('.sort-condition');
        conditions.forEach((condition, index) => {
            const badge = condition.querySelector('.badge');
            badge.textContent = index + 1;
            
            // 更新上移按钮状态
            const moveUpBtn = condition.querySelector('.move-up');
            moveUpBtn.disabled = index === 0;
            
            // 更新下移按钮状态
            const moveDownBtn = condition.querySelector('.move-down');
            moveDownBtn.disabled = index === conditions.length - 1;
        });
    }

    /**
     * 处理合并类型变化
     * @param {string} mergeType - 合并类型
     */
    handleMergeTypeChange(mergeType) {
        const optionsContainer = document.getElementById('merge-options');
        const description = document.getElementById('merge-description');
        
        optionsContainer.classList.remove('hidden');
        
        switch (mergeType) {
            case 'files':
                optionsContainer.innerHTML = this.createFileMergeOptions();
                description.textContent = '将多个文件的数据合并为一个表格，可以选择合并方式。';
                break;
            case 'sheets':
                optionsContainer.innerHTML = this.createSheetMergeOptions();
                description.textContent = '将单个文件中的多个工作表合并为一个表格。';
                break;
            case 'columns':
                optionsContainer.innerHTML = this.createColumnMergeOptions();
                description.textContent = '按照指定列的值将数据行进行合并连接。';
                break;
            default:
                optionsContainer.classList.add('hidden');
                description.textContent = '请先选择合并类型';
        }
    }

    /**
     * 创建文件合并选项HTML
     * @returns {string} HTML字符串
     */
    createFileMergeOptions() {
        return `
            <div class="form-control">
                <label class="label">
                    <span class="label-text">合并方式</span>
                </label>
                <select id="file-merge-method" class="select select-bordered" title="选择文件合并方式">
                    <option value="append">追加合并（简单拼接）</option>
                    <option value="union">联合合并（去重拼接）</option>
                    <option value="join">关联合并（按列关联）</option>
                </select>
            </div>
            <div id="join-options" class="mt-3 hidden">
                <div class="form-control">
                    <label class="label">
                        <span class="label-text">关联列</span>
                    </label>
                    <select id="join-column" class="select select-bordered" title="选择关联列">
                        <option value="">请选择关联列</option>
                    </select>
                </div>
            </div>
        `;
    }

    /**
     * 创建工作表合并选项HTML
     * @returns {string} HTML字符串
     */
    createSheetMergeOptions() {
        return `
            <div class="form-control">
                <label class="label">
                    <span class="label-text">工作表选择</span>
                </label>
                <div id="sheet-selection" class="space-y-2">
                    <!-- 工作表列表将通过JavaScript动态填充 -->
                </div>
            </div>
            <div class="form-control mt-3">
                <label class="label">
                    <span class="label-text">合并方式</span>
                </label>
                <select id="sheet-merge-method" class="select select-bordered" title="选择工作表合并方式">
                    <option value="append">按顺序追加</option>
                    <option value="union">去重合并</option>
                </select>
            </div>
        `;
    }

    /**
     * 创建列合并选项HTML
     * @returns {string} HTML字符串
     */
    createColumnMergeOptions() {
        return `
            <div class="form-control">
                <label class="label">
                    <span class="label-text">连接类型</span>
                </label>
                <select id="join-type" class="select select-bordered" title="选择连接类型">
                    <option value="inner">内连接（取交集）</option>
                    <option value="left">左连接（保留左表）</option>
                    <option value="right">右连接（保留右表）</option>
                    <option value="outer">外连接（取并集）</option>
                </select>
            </div>
            <div class="form-control mt-3">
                <label class="label">
                    <span class="label-text">连接列</span>
                </label>
                <select id="join-key-column" class="select select-bordered" title="选择连接列">
                    <option value="">请选择连接列</option>
                </select>
            </div>
        `;
    }

    /**
     * 更新筛选规则预览
     */
    updateFilterPreview() {
        const conditions = this.getFilterConditions();
        const preview = document.getElementById('filter-preview');
        
        if (conditions.length === 0) {
            preview.textContent = '暂无筛选条件';
            return;
        }
        
        const ruleText = this.generateFilterRuleText(conditions);
        preview.textContent = ruleText;
    }

    /**
     * 更新排序规则预览
     */
    updateSortPreview() {
        const conditions = this.getSortConditions();
        const preview = document.getElementById('sort-preview');
        
        if (conditions.length === 0) {
            preview.textContent = '暂无排序设置';
            return;
        }
        
        const ruleText = this.generateSortRuleText(conditions);
        preview.textContent = ruleText;
    }

    /**
     * 获取筛选条件数据
     * @returns {Array} 筛选条件数组
     */
    getFilterConditions() {
        const conditions = [];
        document.querySelectorAll('.filter-condition').forEach((condition, index) => {
            const column = condition.querySelector('.filter-column-select').value;
            const operator = condition.querySelector('.operator-select').value;
            const valueType = condition.querySelector('.value-type-select').value;
            const logical = index > 0 ? condition.querySelector('.logical-select')?.value : null;
            
            let value = '';
            if (valueType === 'column') {
                value = condition.querySelector('.column-value-select')?.value || '';
            } else {
                value = condition.querySelector('.value-input')?.value || '';
            }
            
            if (column && operator) {
                conditions.push({
                    column,
                    operator,
                    value,
                    valueType,
                    logical
                });
            }
        });
        
        return conditions;
    }

    /**
     * 获取排序条件数据
     * @returns {Array} 排序条件数组
     */
    getSortConditions() {
        const conditions = [];
        document.querySelectorAll('.sort-condition').forEach(condition => {
            const column = condition.querySelector('.sort-column-select').value;
            const direction = condition.querySelector('.sort-direction-select').value;
            
            if (column) {
                conditions.push({
                    column,
                    direction
                });
            }
        });
        
        return conditions;
    }

    /**
     * 生成筛选规则文本
     * @param {Array} conditions - 筛选条件
     * @returns {string} 规则文本
     */
    generateFilterRuleText(conditions) {
        return conditions.map((condition, index) => {
            let text = '';
            
            if (index > 0 && condition.logical) {
                text += condition.logical === 'and' ? ' 并且 ' : ' 或者 ';
            }
            
            text += `${condition.column} ${this.getOperatorText(condition.operator)}`;
            
            if (condition.operator !== 'is_empty' && condition.operator !== 'is_not_empty') {
                if (condition.valueType === 'column') {
                    text += ` ${condition.value}列`;
                } else {
                    text += ` "${condition.value}"`;
                }
            }
            
            return text;
        }).join('');
    }

    /**
     * 生成排序规则文本
     * @param {Array} conditions - 排序条件
     * @returns {string} 规则文本
     */
    generateSortRuleText(conditions) {
        return conditions.map(condition => {
            const directionText = condition.direction === 'asc' ? '升序' : '降序';
            return `${condition.column} ${directionText}`;
        }).join(', ');
    }

    /**
     * 获取操作符显示文本
     * @param {string} operator - 操作符
     * @returns {string} 显示文本
     */
    getOperatorText(operator) {
        const operatorMap = {
            '==': '等于',
            '!=': '不等于',
            '>': '大于',
            '>=': '大于等于',
            '<': '小于',
            '<=': '小于等于',
            'contains': '包含',
            'not_contains': '不包含',
            'starts_with': '开头是',
            'ends_with': '结尾是',
            'is_empty': '为空',
            'is_not_empty': '不为空'
        };
        
        return operatorMap[operator] || operator;
    }

    /**
     * 清空所有规则
     */
    clearAllRules() {
        document.getElementById('filter-conditions').innerHTML = '';
        document.getElementById('sort-conditions').innerHTML = '';
        document.getElementById('merge-type').value = '';
        document.getElementById('merge-options').classList.add('hidden');
        document.getElementById('merge-description').textContent = '请先选择合并类型';
        
        this.updateFilterPreview();
        this.updateSortPreview();
        
        this.conditionCounter = 0;
    }
}

// 导出类
export default VisualRuleEngine; 