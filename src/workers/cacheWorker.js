/**
 * 缓存管理Worker - 在独立进程中管理缓存操作
 */

const { parentPort, workerData } = require('worker_threads');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

class CacheWorker {
    constructor() {
        this.cacheDir = workerData?.cacheDir || path.join(require('os').tmpdir(), 'p-excel-cache');
        this.maxCacheSize = workerData?.maxCacheSize || 2 * 1024 * 1024 * 1024; // 2GB
        this.currentCacheSize = 0;
        this.cacheIndex = new Map(); // 内存中的缓存索引
        this.isProcessing = false;
        
        this.setupMessageHandlers();
        this.initializeCache();
    }

    /**
     * 设置消息处理器
     */
    setupMessageHandlers() {
        if (parentPort) {
            parentPort.on('message', async (message) => {
                try {
                    await this.handleMessage(message);
                } catch (error) {
                    this.sendError(error, message.id);
                }
            });
        }
    }

    /**
     * 初始化缓存
     */
    async initializeCache() {
        try {
            // 确保缓存目录存在
            await this.ensureCacheDirectory();
            
            // 加载缓存索引
            await this.loadCacheIndex();
            
            // 计算当前缓存大小
            await this.calculateCacheSize();
            
            console.log('缓存Worker初始化完成');
        } catch (error) {
            console.error('缓存Worker初始化失败:', error);
        }
    }

    /**
     * 处理消息
     */
    async handleMessage(message) {
        const { type, id, data } = message;

        switch (type) {
            case 'cache-set':
                await this.setCacheData(data, id);
                break;
            case 'cache-get':
                await this.getCacheData(data, id);
                break;
            case 'cache-delete':
                await this.deleteCacheData(data, id);
                break;
            case 'cache-clear':
                await this.clearCache(data, id);
                break;
            case 'cache-info':
                await this.getCacheInfo(data, id);
                break;
            case 'cache-optimize':
                await this.optimizeCache(data, id);
                break;
            case 'cache-cleanup':
                await this.cleanupExpiredCache(data, id);
                break;
            case 'cache-compress':
                await this.compressCache(data, id);
                break;
            default:
                throw new Error(`未知的消息类型: ${type}`);
        }
    }

    /**
     * 确保缓存目录存在
     */
    async ensureCacheDirectory() {
        const directories = [
            this.cacheDir,
            path.join(this.cacheDir, 'data'),
            path.join(this.cacheDir, 'temp'),
            path.join(this.cacheDir, 'index')
        ];

        for (const dir of directories) {
            try {
                await fs.access(dir);
            } catch (error) {
                if (error.code === 'ENOENT') {
                    await fs.mkdir(dir, { recursive: true });
                }
            }
        }
    }

    /**
     * 加载缓存索引
     */
    async loadCacheIndex() {
        try {
            const indexPath = path.join(this.cacheDir, 'index', 'cache-index.json');
            const indexData = await fs.readFile(indexPath, 'utf8');
            const index = JSON.parse(indexData);
            
            // 重建Map
            this.cacheIndex = new Map(Object.entries(index));
            console.log(`缓存索引加载完成: ${this.cacheIndex.size} 项`);
            
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('加载缓存索引失败:', error);
            }
            // 如果索引文件不存在，创建空索引
            this.cacheIndex = new Map();
        }
    }

    /**
     * 保存缓存索引
     */
    async saveCacheIndex() {
        try {
            const indexPath = path.join(this.cacheDir, 'index', 'cache-index.json');
            const indexData = JSON.stringify(Object.fromEntries(this.cacheIndex), null, 2);
            await fs.writeFile(indexPath, indexData, 'utf8');
        } catch (error) {
            console.error('保存缓存索引失败:', error);
        }
    }

    /**
     * 计算缓存大小
     */
    async calculateCacheSize() {
        try {
            const dataDir = path.join(this.cacheDir, 'data');
            const files = await fs.readdir(dataDir);
            let totalSize = 0;

            for (const file of files) {
                const filePath = path.join(dataDir, file);
                const stats = await fs.stat(filePath);
                totalSize += stats.size;
            }

            this.currentCacheSize = totalSize;
            console.log(`当前缓存大小: ${this.formatBytes(this.currentCacheSize)}`);

        } catch (error) {
            console.error('计算缓存大小失败:', error);
            this.currentCacheSize = 0;
        }
    }

    /**
     * 设置缓存数据
     */
    async setCacheData(data, messageId) {
        const { key, value, options = {} } = data;
        
        try {
            this.isProcessing = true;
            this.sendProgress({ stage: 'caching', progress: 0 }, messageId);

            const {
                ttl = 24 * 60 * 60 * 1000, // 24小时
                compress = true,
                priority = 'normal'
            } = options;

            // 生成缓存键
            const cacheKey = this.generateCacheKey(key);
            const cacheFilePath = path.join(this.cacheDir, 'data', `${cacheKey}.cache`);

            // 准备缓存数据
            const cacheEntry = {
                key,
                value,
                timestamp: Date.now(),
                ttl,
                compressed: compress,
                priority,
                size: 0
            };

            this.sendProgress({ stage: 'serializing', progress: 25 }, messageId);

            // 序列化数据
            let serializedData = JSON.stringify(cacheEntry);
            
            // 压缩数据
            if (compress) {
                this.sendProgress({ stage: 'compressing', progress: 50 }, messageId);
                serializedData = await gzip(serializedData);
            }

            // 写入文件
            this.sendProgress({ stage: 'writing', progress: 75 }, messageId);
            await fs.writeFile(cacheFilePath, serializedData);

            // 更新索引
            const stats = await fs.stat(cacheFilePath);
            cacheEntry.size = stats.size;
            this.cacheIndex.set(cacheKey, {
                key,
                timestamp: cacheEntry.timestamp,
                ttl,
                size: stats.size,
                compressed: compress,
                priority,
                filePath: cacheFilePath
            });

            // 更新缓存大小
            this.currentCacheSize += stats.size;

            // 保存索引
            await this.saveCacheIndex();

            // 检查缓存大小限制
            if (this.currentCacheSize > this.maxCacheSize) {
                await this.evictOldCache();
            }

            this.sendProgress({ stage: 'complete', progress: 100 }, messageId);

            this.sendResult({
                success: true,
                cacheKey,
                size: stats.size,
                compressed: compress
            }, messageId);

        } catch (error) {
            this.sendError(error, messageId);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * 获取缓存数据
     */
    async getCacheData(data, messageId) {
        const { key } = data;
        
        try {
            this.isProcessing = true;
            this.sendProgress({ stage: 'retrieving', progress: 0 }, messageId);

            const cacheKey = this.generateCacheKey(key);
            const cacheInfo = this.cacheIndex.get(cacheKey);

            if (!cacheInfo) {
                this.sendResult({
                    success: false,
                    found: false,
                    reason: 'Cache miss'
                }, messageId);
                return;
            }

            // 检查TTL
            if (Date.now() - cacheInfo.timestamp > cacheInfo.ttl) {
                // 缓存过期，删除
                await this.deleteCacheEntry(cacheKey);
                this.sendResult({
                    success: false,
                    found: false,
                    reason: 'Cache expired'
                }, messageId);
                return;
            }

            this.sendProgress({ stage: 'reading', progress: 25 }, messageId);

            // 读取缓存文件
            let cacheData = await fs.readFile(cacheInfo.filePath);

            // 解压缩数据
            if (cacheInfo.compressed) {
                this.sendProgress({ stage: 'decompressing', progress: 50 }, messageId);
                cacheData = await gunzip(cacheData);
            }

            this.sendProgress({ stage: 'deserializing', progress: 75 }, messageId);

            // 反序列化数据
            const cacheEntry = JSON.parse(cacheData.toString());

            this.sendProgress({ stage: 'complete', progress: 100 }, messageId);

            this.sendResult({
                success: true,
                found: true,
                data: cacheEntry.value,
                metadata: {
                    key: cacheEntry.key,
                    timestamp: cacheEntry.timestamp,
                    age: Date.now() - cacheEntry.timestamp,
                    size: cacheInfo.size,
                    compressed: cacheInfo.compressed
                }
            }, messageId);

        } catch (error) {
            if (error.code === 'ENOENT') {
                // 文件不存在，从索引中删除
                const cacheKey = this.generateCacheKey(key);
                this.cacheIndex.delete(cacheKey);
                await this.saveCacheIndex();
                
                this.sendResult({
                    success: false,
                    found: false,
                    reason: 'Cache file not found'
                }, messageId);
            } else {
                this.sendError(error, messageId);
            }
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * 删除缓存数据
     */
    async deleteCacheData(data, messageId) {
        const { key } = data;
        
        try {
            const cacheKey = this.generateCacheKey(key);
            await this.deleteCacheEntry(cacheKey);

            this.sendResult({
                success: true,
                deleted: true
            }, messageId);

        } catch (error) {
            this.sendError(error, messageId);
        }
    }

    /**
     * 删除缓存条目
     */
    async deleteCacheEntry(cacheKey) {
        const cacheInfo = this.cacheIndex.get(cacheKey);
        
        if (cacheInfo) {
            try {
                await fs.unlink(cacheInfo.filePath);
                this.currentCacheSize -= cacheInfo.size;
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    console.error('删除缓存文件失败:', error);
                }
            }
            
            this.cacheIndex.delete(cacheKey);
            await this.saveCacheIndex();
        }
    }

    /**
     * 清理缓存
     */
    async clearCache(data, messageId) {
        const { pattern = null } = data;
        
        try {
            this.isProcessing = true;
            this.sendProgress({ stage: 'clearing', progress: 0 }, messageId);

            let deletedCount = 0;
            let deletedSize = 0;

            if (pattern) {
                // 按模式删除
                const regex = new RegExp(pattern);
                const keysToDelete = [];
                
                for (const [cacheKey, cacheInfo] of this.cacheIndex) {
                    if (regex.test(cacheInfo.key)) {
                        keysToDelete.push(cacheKey);
                    }
                }

                for (const cacheKey of keysToDelete) {
                    const cacheInfo = this.cacheIndex.get(cacheKey);
                    if (cacheInfo) {
                        deletedSize += cacheInfo.size;
                        await this.deleteCacheEntry(cacheKey);
                        deletedCount++;
                    }
                }
            } else {
                // 清理所有缓存
                const dataDir = path.join(this.cacheDir, 'data');
                const files = await fs.readdir(dataDir);

                for (const file of files) {
                    const filePath = path.join(dataDir, file);
                    const stats = await fs.stat(filePath);
                    deletedSize += stats.size;
                    await fs.unlink(filePath);
                    deletedCount++;
                }

                this.cacheIndex.clear();
                this.currentCacheSize = 0;
                await this.saveCacheIndex();
            }

            this.sendProgress({ stage: 'complete', progress: 100 }, messageId);

            this.sendResult({
                success: true,
                deletedCount,
                deletedSize,
                remainingSize: this.currentCacheSize
            }, messageId);

        } catch (error) {
            this.sendError(error, messageId);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * 获取缓存信息
     */
    async getCacheInfo(data, messageId) {
        try {
            const cacheStats = {
                totalEntries: this.cacheIndex.size,
                totalSize: this.currentCacheSize,
                maxSize: this.maxCacheSize,
                usagePercent: Math.round((this.currentCacheSize / this.maxCacheSize) * 100),
                directory: this.cacheDir,
                entries: []
            };

            // 获取缓存条目详情
            for (const [cacheKey, cacheInfo] of this.cacheIndex) {
                cacheStats.entries.push({
                    key: cacheInfo.key,
                    size: cacheInfo.size,
                    age: Date.now() - cacheInfo.timestamp,
                    ttl: cacheInfo.ttl,
                    compressed: cacheInfo.compressed,
                    priority: cacheInfo.priority,
                    expired: Date.now() - cacheInfo.timestamp > cacheInfo.ttl
                });
            }

            // 按大小排序
            cacheStats.entries.sort((a, b) => b.size - a.size);

            this.sendResult({
                success: true,
                data: cacheStats
            }, messageId);

        } catch (error) {
            this.sendError(error, messageId);
        }
    }

    /**
     * 优化缓存
     */
    async optimizeCache(data, messageId) {
        try {
            this.isProcessing = true;
            this.sendProgress({ stage: 'optimizing', progress: 0 }, messageId);

            let optimizedCount = 0;
            let savedSpace = 0;

            // 清理过期缓存
            this.sendProgress({ stage: 'cleaning_expired', progress: 25 }, messageId);
            const expiredResult = await this.cleanupExpiredCacheInternal();
            optimizedCount += expiredResult.deletedCount;
            savedSpace += expiredResult.deletedSize;

            // 压缩未压缩的缓存
            this.sendProgress({ stage: 'compressing', progress: 50 }, messageId);
            const compressResult = await this.compressUncompressedCache();
            savedSpace += compressResult.savedSpace;

            // 如果缓存使用率仍然过高，清理旧缓存
            if (this.currentCacheSize > this.maxCacheSize * 0.8) {
                this.sendProgress({ stage: 'evicting_old', progress: 75 }, messageId);
                const evictResult = await this.evictOldCache();
                optimizedCount += evictResult.deletedCount;
                savedSpace += evictResult.deletedSize;
            }

            this.sendProgress({ stage: 'complete', progress: 100 }, messageId);

            this.sendResult({
                success: true,
                optimizedEntries: optimizedCount,
                savedSpace,
                currentSize: this.currentCacheSize,
                usagePercent: Math.round((this.currentCacheSize / this.maxCacheSize) * 100)
            }, messageId);

        } catch (error) {
            this.sendError(error, messageId);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * 清理过期缓存
     */
    async cleanupExpiredCache(data, messageId) {
        try {
            const result = await this.cleanupExpiredCacheInternal();
            
            this.sendResult({
                success: true,
                ...result
            }, messageId);

        } catch (error) {
            this.sendError(error, messageId);
        }
    }

    /**
     * 内部清理过期缓存
     */
    async cleanupExpiredCacheInternal() {
        const now = Date.now();
        const expiredKeys = [];
        
        for (const [cacheKey, cacheInfo] of this.cacheIndex) {
            if (now - cacheInfo.timestamp > cacheInfo.ttl) {
                expiredKeys.push(cacheKey);
            }
        }

        let deletedCount = 0;
        let deletedSize = 0;

        for (const cacheKey of expiredKeys) {
            const cacheInfo = this.cacheIndex.get(cacheKey);
            if (cacheInfo) {
                deletedSize += cacheInfo.size;
                await this.deleteCacheEntry(cacheKey);
                deletedCount++;
            }
        }

        return { deletedCount, deletedSize };
    }

    /**
     * 压缩未压缩的缓存
     */
    async compressUncompressedCache() {
        let savedSpace = 0;
        
        for (const [cacheKey, cacheInfo] of this.cacheIndex) {
            if (!cacheInfo.compressed) {
                try {
                    // 读取原始数据
                    const originalData = await fs.readFile(cacheInfo.filePath);
                    const originalSize = originalData.length;
                    
                    // 压缩数据
                    const compressedData = await gzip(originalData);
                    
                    // 如果压缩后更小，则替换
                    if (compressedData.length < originalSize) {
                        await fs.writeFile(cacheInfo.filePath, compressedData);
                        
                        const spaceSaved = originalSize - compressedData.length;
                        savedSpace += spaceSaved;
                        this.currentCacheSize -= spaceSaved;
                        
                        // 更新索引
                        cacheInfo.compressed = true;
                        cacheInfo.size = compressedData.length;
                    }
                } catch (error) {
                    console.error('压缩缓存失败:', cacheKey, error);
                }
            }
        }

        if (savedSpace > 0) {
            await this.saveCacheIndex();
        }

        return { savedSpace };
    }

    /**
     * 清理旧缓存
     */
    async evictOldCache() {
        // 按时间戳排序，删除最旧的缓存
        const entries = Array.from(this.cacheIndex.entries());
        entries.sort((a, b) => {
            // 优先级低的先删除
            if (a[1].priority !== b[1].priority) {
                const priorityOrder = { low: 0, normal: 1, high: 2 };
                return priorityOrder[a[1].priority] - priorityOrder[b[1].priority];
            }
            // 时间戳早的先删除
            return a[1].timestamp - b[1].timestamp;
        });

        const targetSize = this.maxCacheSize * 0.7; // 清理到70%
        let deletedCount = 0;
        let deletedSize = 0;

        for (const [cacheKey, cacheInfo] of entries) {
            if (this.currentCacheSize <= targetSize) {
                break;
            }

            deletedSize += cacheInfo.size;
            await this.deleteCacheEntry(cacheKey);
            deletedCount++;
        }

        return { deletedCount, deletedSize };
    }

    /**
     * 压缩缓存
     */
    async compressCache(data, messageId) {
        const { keys = [] } = data;
        
        try {
            this.isProcessing = true;
            this.sendProgress({ stage: 'compressing', progress: 0 }, messageId);

            let compressedCount = 0;
            let savedSpace = 0;
            const totalKeys = keys.length || this.cacheIndex.size;
            let processedKeys = 0;

            const keysToProcess = keys.length > 0 ? 
                keys.map(key => this.generateCacheKey(key)) : 
                Array.from(this.cacheIndex.keys());

            for (const cacheKey of keysToProcess) {
                const cacheInfo = this.cacheIndex.get(cacheKey);
                
                if (cacheInfo && !cacheInfo.compressed) {
                    try {
                        const originalData = await fs.readFile(cacheInfo.filePath);
                        const compressedData = await gzip(originalData);
                        
                        if (compressedData.length < originalData.length) {
                            await fs.writeFile(cacheInfo.filePath, compressedData);
                            
                            const spaceSaved = originalData.length - compressedData.length;
                            savedSpace += spaceSaved;
                            this.currentCacheSize -= spaceSaved;
                            
                            cacheInfo.compressed = true;
                            cacheInfo.size = compressedData.length;
                            compressedCount++;
                        }
                    } catch (error) {
                        console.error('压缩缓存失败:', cacheKey, error);
                    }
                }

                processedKeys++;
                const progress = (processedKeys / totalKeys) * 100;
                this.sendProgress({ 
                    stage: 'compressing', 
                    progress,
                    processedKeys,
                    totalKeys,
                    compressedCount
                }, messageId);
            }

            if (compressedCount > 0) {
                await this.saveCacheIndex();
            }

            this.sendProgress({ stage: 'complete', progress: 100 }, messageId);

            this.sendResult({
                success: true,
                compressedCount,
                savedSpace,
                currentSize: this.currentCacheSize
            }, messageId);

        } catch (error) {
            this.sendError(error, messageId);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * 生成缓存键
     */
    generateCacheKey(key) {
        return crypto.createHash('md5').update(String(key)).digest('hex');
    }

    /**
     * 格式化字节数
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 发送进度更新
     */
    sendProgress(progress, messageId) {
        if (parentPort) {
            parentPort.postMessage({
                type: 'progress',
                id: messageId,
                data: progress
            });
        }
    }

    /**
     * 发送结果
     */
    sendResult(result, messageId) {
        if (parentPort) {
            parentPort.postMessage({
                type: 'result',
                id: messageId,
                data: result
            });
        }
    }

    /**
     * 发送错误
     */
    sendError(error, messageId) {
        if (parentPort) {
            parentPort.postMessage({
                type: 'error',
                id: messageId,
                data: {
                    message: error.message,
                    stack: error.stack
                }
            });
        }
    }
}

// 创建Worker实例
const worker = new CacheWorker();

// 发送就绪信号
if (parentPort) {
    parentPort.postMessage({
        type: 'ready',
        data: {
            workerId: workerData?.workerId || 'unknown',
            cacheDir: worker.cacheDir,
            maxCacheSize: worker.maxCacheSize,
            timestamp: Date.now()
        }
    });
}