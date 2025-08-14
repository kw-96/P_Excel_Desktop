/**
 * 设置面板组件 - 用户偏好设置界面
 */

class SettingsPanel {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            showAdvanced: options.showAdvanced !== false,
            onConfigChange: options.onConfigChange || null,
            onSave: options.onSave || null,
            onReset: options.onReset || null,
            ...options
        };
        
        this.config = {};
        this.originalConfig = {};
        this.hasChanges = false;
        
        this.init();
    }

    /**
     * 初始化设置面板
     */
    async init() {
        await this.loadConfig();
        this.createUI();
        this.bindEvents();
        this.updateUI();
    }

    /**
     * 加载配置
     */
    async loadConfig() {
        try {
            if (window.electronAPI) {
                this.config = await window.electronAPI.getConfig();
                this.originalConfig = JSON.parse(JSON.stringify(this.config));
            }
        } catch (error) {
            console.error('加载配置失败:', error);
            this.config = this.getDefaultConfig();
        }
    }

    /**
     * 获取默认配置
     */
    getDefaultConfig() {
        return {
            performance: {
                maxMemoryUsage: '4GB',
                workerThreads: 4,
                chunkSize: 100000,
                enableCompression: true,
                maxConcurrentTasks: 3
            },
            ui: {
                theme: 'light',
                language: 'zh-CN',
                previewRows: 1000,
                enableAnimations: true,
                showProgressDetails: true
            },
            security: {
                enableEncryption: false,
                autoCleanup: true,
                maxFileSize: '10GB'
            },
            advanced: {
                enableLogging: true,
                logLevel: 'info',
                enableDeveloperMode: false
            }
        };
    }

    /**
     * 创建UI
     */
    createUI() {
        this.container.innerHTML = `
            <div class="settings-panel">
                <div class="settings-header">
                    <h2 class="settings-title">应用设置</h2>
                    <div class="settings-actions">
                        <button class="btn btn-sm btn-ghost reset-settings">重置</button>
                        <button class="btn btn-sm btn-primary save-settings" disabled>保存</button>
                    </div>
                </div>
                
                <div class="settings-content">
                    <div class="settings-tabs">
                        <div class="tab-list">
                            <button class="tab-button active" data-tab="performance">性能</button>
                            <button class="tab-button" data-tab="ui">界面</button>
                            <button class="tab-button" data-tab="security">安全</button>
                            ${this.options.showAdvanced ? '<button class="tab-button" data-tab="advanced">高级</button>' : ''}
                        </div>
                        
                        <div class="tab-content">
                            <!-- 性能设置 -->
                            <div class="tab-panel active" data-panel="performance">
                                <div class="setting-group">
                                    <h3 class="group-title">内存和处理</h3>
                                    
                                    <div class="setting-item">
                                        <label class="setting-label">
                                            <span class="label-text">最大内存使用</span>
                                            <span class="label-description">设置应用可使用的最大内存量</span>
                                        </label>
                                        <select class="setting-input" data-config="performance.maxMemoryUsage">
                                            <option value="2GB">2GB</option>
                                            <option value="4GB">4GB</option>
                                            <option value="8GB">8GB</option>
                                            <option value="16GB">16GB</option>
                                        </select>
                                    </div>
                                    
                                    <div class="setting-item">
                                        <label class="setting-label">
                                            <span class="label-text">工作线程数</span>
                                            <span class="label-description">并行处理使用的线程数量</span>
                                        </label>
                                        <input type="number" class="setting-input" min="1" max="16" 
                                               data-config="performance.workerThreads">
                                    </div>
                                    
                                    <div class="setting-item">
                                        <label class="setting-label">
                                            <span class="label-text">数据块大小</span>
                                            <span class="label-description">每次处理的数据行数</span>
                                        </label>
                                        <input type="number" class="setting-input" min="1000" max="1000000" step="1000"
                                               data-config="performance.chunkSize">
                                    </div>
                                    
                                    <div class="setting-item">
                                        <label class="setting-label">
                                            <span class="label-text">最大并发任务</span>
                                            <span class="label-description">同时处理的最大任务数</span>
                                        </label>
                                        <input type="number" class="setting-input" min="1" max="10"
                                               data-config="performance.maxConcurrentTasks">
                                    </div>
                                    
                                    <div class="setting-item">
                                        <label class="setting-checkbox">
                                            <input type="checkbox" data-config="performance.enableCompression">
                                            <span class="checkbox-text">启用数据压缩</span>
                                            <span class="checkbox-description">压缩缓存数据以节省存储空间</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- 界面设置 -->
                            <div class="tab-panel" data-panel="ui">
                                <div class="setting-group">
                                    <h3 class="group-title">外观</h3>
                                    
                                    <div class="setting-item">
                                        <label class="setting-label">
                                            <span class="label-text">主题</span>
                                            <span class="label-description">选择应用的外观主题</span>
                                        </label>
                                        <select class="setting-input" data-config="ui.theme">
                                            <option value="light">浅色</option>
                                            <option value="dark">深色</option>
                                            <option value="auto">跟随系统</option>
                                        </select>
                                    </div>
                                    
                                    <div class="setting-item">
                                        <label class="setting-label">
                                            <span class="label-text">语言</span>
                                            <span class="label-description">界面显示语言</span>
                                        </label>
                                        <select class="setting-input" data-config="ui.language">
                                            <option value="zh-CN">简体中文</option>
                                            <option value="en-US">English</option>
                                        </select>
                                    </div>
                                    
                                    <div class="setting-item">
                                        <label class="setting-label">
                                            <span class="label-text">预览行数</span>
                                            <span class="label-description">数据预览显示的最大行数</span>
                                        </label>
                                        <input type="number" class="setting-input" min="10" max="10000" step="10"
                                               data-config="ui.previewRows">
                                    </div>
                                    
                                    <div class="setting-item">
                                        <label class="setting-checkbox">
                                            <input type="checkbox" data-config="ui.enableAnimations">
                                            <span class="checkbox-text">启用动画效果</span>
                                            <span class="checkbox-description">界面切换和操作的动画效果</span>
                                        </label>
                                    </div>
                                    
                                    <div class="setting-item">
                                        <label class="setting-checkbox">
                                            <input type="checkbox" data-config="ui.showProgressDetails">
                                            <span class="checkbox-text">显示详细进度</span>
                                            <span class="checkbox-description">显示处理过程的详细信息</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- 安全设置 -->
                            <div class="tab-panel" data-panel="security">
                                <div class="setting-group">
                                    <h3 class="group-title">数据安全</h3>
                                    
                                    <div class="setting-item">
                                        <label class="setting-label">
                                            <span class="label-text">最大文件大小</span>
                                            <span class="label-description">允许处理的最大文件大小</span>
                                        </label>
                                        <select class="setting-input" data-config="security.maxFileSize">
                                            <option value="1GB">1GB</option>
                                            <option value="5GB">5GB</option>
                                            <option value="10GB">10GB</option>
                                            <option value="20GB">20GB</option>
                                        </select>
                                    </div>
                                    
                                    <div class="setting-item">
                                        <label class="setting-checkbox">
                                            <input type="checkbox" data-config="security.enableEncryption">
                                            <span class="checkbox-text">启用数据加密</span>
                                            <span class="checkbox-description">加密存储敏感数据</span>
                                        </label>
                                    </div>
                                    
                                    <div class="setting-item">
                                        <label class="setting-checkbox">
                                            <input type="checkbox" data-config="security.autoCleanup">
                                            <span class="checkbox-text">自动清理临时文件</span>
                                            <span class="checkbox-description">应用关闭时自动清理临时文件</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- 高级设置 -->
                            ${this.options.showAdvanced ? `
                            <div class="tab-panel" data-panel="advanced">
                                <div class="setting-group">
                                    <h3 class="group-title">开发和调试</h3>
                                    
                                    <div class="setting-item">
                                        <label class="setting-checkbox">
                                            <input type="checkbox" data-config="advanced.enableLogging">
                                            <span class="checkbox-text">启用日志记录</span>
                                            <span class="checkbox-description">记录应用运行日志</span>
                                        </label>
                                    </div>
                                    
                                    <div class="setting-item">
                                        <label class="setting-label">
                                            <span class="label-text">日志级别</span>
                                            <span class="label-description">记录日志的详细程度</span>
                                        </label>
                                        <select class="setting-input" data-config="advanced.logLevel">
                                            <option value="error">错误</option>
                                            <option value="warn">警告</option>
                                            <option value="info">信息</option>
                                            <option value="debug">调试</option>
                                        </select>
                                    </div>
                                    
                                    <div class="setting-item">
                                        <label class="setting-checkbox">
                                            <input type="checkbox" data-config="advanced.enableDeveloperMode">
                                            <span class="checkbox-text">开发者模式</span>
                                            <span class="checkbox-description">启用开发者工具和调试功能</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
                
                <div class="settings-footer">
                    <div class="settings-info">
                        <span class="info-text">更改将在重启应用后生效</span>
                    </div>
                </div>
            </div>
        `;

        // 获取DOM元素引用
        this.elements = {
            tabButtons: this.container.querySelectorAll('.tab-button'),
            tabPanels: this.container.querySelectorAll('.tab-panel'),
            settingInputs: this.container.querySelectorAll('[data-config]'),
            saveButton: this.container.querySelector('.save-settings'),
            resetButton: this.container.querySelector('.reset-settings')
        };
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 标签页切换
        this.elements.tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                this.switchTab(button.dataset.tab);
            });
        });

        // 配置项变化
        this.elements.settingInputs.forEach(input => {
            const eventType = input.type === 'checkbox' ? 'change' : 'input';
            input.addEventListener(eventType, () => {
                this.handleConfigChange(input);
            });
        });

        // 保存按钮
        this.elements.saveButton.addEventListener('click', () => {
            this.saveConfig();
        });

        // 重置按钮
        this.elements.resetButton.addEventListener('click', () => {
            this.resetConfig();
        });

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 's') {
                    e.preventDefault();
                    if (this.hasChanges) {
                        this.saveConfig();
                    }
                } else if (e.key === 'r') {
                    e.preventDefault();
                    this.resetConfig();
                }
            }
        });
    }

    /**
     * 切换标签页
     */
    switchTab(tabName) {
        // 更新标签按钮状态
        this.elements.tabButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.tab === tabName);
        });

        // 更新面板显示
        this.elements.tabPanels.forEach(panel => {
            panel.classList.toggle('active', panel.dataset.panel === tabName);
        });
    }

    /**
     * 更新UI
     */
    updateUI() {
        this.elements.settingInputs.forEach(input => {
            const configPath = input.dataset.config;
            const value = this.getConfigValue(configPath);

            if (input.type === 'checkbox') {
                input.checked = Boolean(value);
            } else {
                input.value = value || '';
            }
        });

        this.hasChanges = false;
        this.updateSaveButton();
    }

    /**
     * 获取配置值
     */
    getConfigValue(path) {
        const keys = path.split('.');
        let value = this.config;

        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return undefined;
            }
        }

        return value;
    }

    /**
     * 设置配置值
     */
    setConfigValue(path, value) {
        const keys = path.split('.');
        let target = this.config;

        // 导航到目标对象
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!target[key] || typeof target[key] !== 'object') {
                target[key] = {};
            }
            target = target[key];
        }

        // 设置值
        const lastKey = keys[keys.length - 1];
        target[lastKey] = value;
    }

    /**
     * 处理配置变化
     */
    handleConfigChange(input) {
        const configPath = input.dataset.config;
        let value;

        if (input.type === 'checkbox') {
            value = input.checked;
        } else if (input.type === 'number') {
            value = parseInt(input.value) || 0;
        } else {
            value = input.value;
        }

        this.setConfigValue(configPath, value);
        this.hasChanges = true;
        this.updateSaveButton();

        // 触发配置变化回调
        if (this.options.onConfigChange) {
            this.options.onConfigChange({
                path: configPath,
                value: value,
                config: this.config
            });
        }
    }

    /**
     * 更新保存按钮状态
     */
    updateSaveButton() {
        this.elements.saveButton.disabled = !this.hasChanges;
        this.elements.saveButton.textContent = this.hasChanges ? '保存更改' : '保存';
    }

    /**
     * 保存配置
     */
    async saveConfig() {
        if (!this.hasChanges) return;

        try {
            // 显示保存状态
            this.elements.saveButton.disabled = true;
            this.elements.saveButton.textContent = '保存中...';

            // 调用Electron API保存配置
            if (window.electronAPI) {
                await window.electronAPI.setConfig(null, this.config);
            }

            // 更新原始配置
            this.originalConfig = JSON.parse(JSON.stringify(this.config));
            this.hasChanges = false;
            this.updateSaveButton();

            // 显示成功消息
            this.showMessage('配置保存成功', 'success');

            // 触发保存回调
            if (this.options.onSave) {
                this.options.onSave(this.config);
            }

        } catch (error) {
            console.error('保存配置失败:', error);
            this.showMessage('配置保存失败: ' + error.message, 'error');
            this.updateSaveButton();
        }
    }

    /**
     * 重置配置
     */
    async resetConfig() {
        const confirmed = confirm('确定要重置所有设置到默认值吗？此操作不可撤销。');
        if (!confirmed) return;

        try {
            // 调用Electron API重置配置
            if (window.electronAPI) {
                await window.electronAPI.resetConfig();
                this.config = await window.electronAPI.getConfig();
            } else {
                this.config = this.getDefaultConfig();
            }

            // 更新UI
            this.updateUI();
            this.showMessage('配置已重置为默认值', 'success');

            // 触发重置回调
            if (this.options.onReset) {
                this.options.onReset(this.config);
            }

        } catch (error) {
            console.error('重置配置失败:', error);
            this.showMessage('重置配置失败: ' + error.message, 'error');
        }
    }

    /**
     * 显示消息
     */
    showMessage(message, type = 'info') {
        // 创建消息元素
        const messageEl = document.createElement('div');
        messageEl.className = `alert alert-${type} fixed top-4 right-4 w-auto max-w-md z-50`;
        messageEl.innerHTML = `
            <span>${message}</span>
            <button class="btn btn-sm btn-ghost" onclick="this.parentElement.remove()">×</button>
        `;

        document.body.appendChild(messageEl);

        // 3秒后自动移除
        setTimeout(() => {
            if (messageEl.parentElement) {
                messageEl.remove();
            }
        }, 3000);
    }

    /**
     * 检查是否有未保存的更改
     */
    hasUnsavedChanges() {
        return this.hasChanges;
    }

    /**
     * 获取当前配置
     */
    getCurrentConfig() {
        return { ...this.config };
    }

    /**
     * 导入配置
     */
    async importConfig(configData) {
        try {
            this.config = { ...this.config, ...configData };
            this.updateUI();
            this.hasChanges = true;
            this.updateSaveButton();
            
            this.showMessage('配置导入成功', 'success');
        } catch (error) {
            console.error('导入配置失败:', error);
            this.showMessage('导入配置失败: ' + error.message, 'error');
        }
    }

    /**
     * 导出配置
     */
    exportConfig() {
        try {
            const configData = JSON.stringify(this.config, null, 2);
            const blob = new Blob([configData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = 'p-excel-config.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
            this.showMessage('配置导出成功', 'success');
            
        } catch (error) {
            console.error('导出配置失败:', error);
            this.showMessage('导出配置失败: ' + error.message, 'error');
        }
    }

    /**
     * 销毁组件
     */
    destroy() {
        // 移除事件监听器
        document.removeEventListener('keydown', this.handleKeydown);
        
        // 清空容器
        this.container.innerHTML = '';
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SettingsPanel;
} else {
    window.SettingsPanel = SettingsPanel;
}