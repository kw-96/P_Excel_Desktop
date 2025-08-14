/**
 * 虚拟滚动组件 - 用于大数据集的高性能显示
 */

class VirtualScroll {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            itemHeight: options.itemHeight || 40,
            bufferSize: options.bufferSize || 10,
            renderItem: options.renderItem || this.defaultRenderItem,
            onScroll: options.onScroll || null,
            ...options
        };
        
        this.data = [];
        this.visibleItems = [];
        this.scrollTop = 0;
        this.containerHeight = 0;
        this.totalHeight = 0;
        this.startIndex = 0;
        this.endIndex = 0;
        
        this.init();
    }

    /**
     * 初始化虚拟滚动
     */
    init() {
        this.container.style.position = 'relative';
        this.container.style.overflow = 'auto';
        
        // 创建滚动容器
        this.scrollContainer = document.createElement('div');
        this.scrollContainer.style.position = 'absolute';
        this.scrollContainer.style.top = '0';
        this.scrollContainer.style.left = '0';
        this.scrollContainer.style.right = '0';
        this.scrollContainer.style.willChange = 'transform';
        
        // 创建内容容器
        this.contentContainer = document.createElement('div');
        this.contentContainer.style.position = 'relative';
        
        this.scrollContainer.appendChild(this.contentContainer);
        this.container.appendChild(this.scrollContainer);
        
        // 绑定滚动事件
        this.container.addEventListener('scroll', this.handleScroll.bind(this));
        
        // 监听容器大小变化
        this.resizeObserver = new ResizeObserver(() => {
            this.updateContainerHeight();
            this.render();
        });
        this.resizeObserver.observe(this.container);
        
        this.updateContainerHeight();
    }

    /**
     * 设置数据
     */
    setData(data) {
        this.data = data;
        this.totalHeight = data.length * this.options.itemHeight;
        this.scrollContainer.style.height = `${this.totalHeight}px`;
        this.render();
    }

    /**
     * 更新容器高度
     */
    updateContainerHeight() {
        this.containerHeight = this.container.clientHeight;
    }

    /**
     * 处理滚动事件
     */
    handleScroll() {
        this.scrollTop = this.container.scrollTop;
        this.render();
        
        if (this.options.onScroll) {
            this.options.onScroll({
                scrollTop: this.scrollTop,
                scrollHeight: this.totalHeight,
                clientHeight: this.containerHeight
            });
        }
    }

    /**
     * 渲染可见项
     */
    render() {
        if (this.data.length === 0) {
            this.contentContainer.innerHTML = '';
            return;
        }

        // 计算可见范围
        const visibleStart = Math.floor(this.scrollTop / this.options.itemHeight);
        const visibleEnd = Math.min(
            visibleStart + Math.ceil(this.containerHeight / this.options.itemHeight),
            this.data.length - 1
        );

        // 添加缓冲区
        this.startIndex = Math.max(0, visibleStart - this.options.bufferSize);
        this.endIndex = Math.min(this.data.length - 1, visibleEnd + this.options.bufferSize);

        // 清空内容容器
        this.contentContainer.innerHTML = '';

        // 设置容器偏移
        const offsetY = this.startIndex * this.options.itemHeight;
        this.contentContainer.style.transform = `translateY(${offsetY}px)`;

        // 渲染可见项
        for (let i = this.startIndex; i <= this.endIndex; i++) {
            const item = this.data[i];
            const element = this.options.renderItem(item, i);
            element.style.position = 'absolute';
            element.style.top = `${(i - this.startIndex) * this.options.itemHeight}px`;
            element.style.left = '0';
            element.style.right = '0';
            element.style.height = `${this.options.itemHeight}px`;
            this.contentContainer.appendChild(element);
        }
    }

    /**
     * 默认渲染项函数
     */
    defaultRenderItem(item, index) {
        const div = document.createElement('div');
        div.textContent = JSON.stringify(item);
        div.style.padding = '8px';
        div.style.borderBottom = '1px solid #eee';
        return div;
    }

    /**
     * 滚动到指定索引
     */
    scrollToIndex(index) {
        const scrollTop = index * this.options.itemHeight;
        this.container.scrollTop = scrollTop;
    }

    /**
     * 获取当前可见范围
     */
    getVisibleRange() {
        return {
            start: this.startIndex,
            end: this.endIndex,
            total: this.data.length
        };
    }

    /**
     * 更新项高度
     */
    updateItemHeight(height) {
        this.options.itemHeight = height;
        this.totalHeight = this.data.length * height;
        this.scrollContainer.style.height = `${this.totalHeight}px`;
        this.render();
    }

    /**
     * 销毁组件
     */
    destroy() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        this.container.removeEventListener('scroll', this.handleScroll);
        this.container.innerHTML = '';
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VirtualScroll;
} else {
    window.VirtualScroll = VirtualScroll;
}