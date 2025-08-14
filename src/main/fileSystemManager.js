/**
 * 文件系统管理器 - 负责大文件处理和缓存管理
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');

class FileSystemManager {
    constructor() {
        this.cacheDir = path.join(os.tmpdir(), 'p-excel-cache');
        this.configDir = path.join(os.homedir(), '.p-excel');
        this.tempFiles = new Set();
        this.cacheSize = 0;
        this.maxCacheSize = 2 * 1024 * 1024 * 1024; // 2GB
    }

    /**
     * 初始化文件系统管理器
     */
    async initialize() {
        try {
            // 创建必要的目录
            await this.ensureDirectories();
            
            // 清理旧的临时文件
            await this.cleanupOldTempFiles();
            
            // 计算当前缓存大小
            await this.calculateCacheSize();
            
            console.log('文件系统管理器初始化完成');
        } catch (error) {
            console.error('文件系统管理器初始化失败:', error);
            throw error;
        }
    }

    /**
     * 确保必要目录存在
     */
    async ensureDirectories() {
        const directories = [
            this.cacheDir,
            this.configDir,
            path.join(this.cacheDir, 'data'),
            path.join(this.cacheDir, 'temp'),
            path.join(this.configDir, 'logs')
        ];

        for (const dir of directories) {
            try {
                await fs.access(dir);
            } catch (error) {
                if (error.code === 'ENOENT') {
                    await fs.mkdir(dir, { recursive: true });
                    console.log('创建目录:', dir);
                }
            }
        }
    }

    /**
     * 流式读取大文件
     */
    async streamReadFile(filePath, options = {}) {
        const {
            chunkSize = 1024 * 1024, // 1MB chunks
            encoding = 'utf8',
            onProgress = null
        } = options;

        try {
            const stats = await fs.stat(filePath);
            const fileSize = stats.size;
            let bytesRead = 0;
            const chunks = [];

            const fileHandle = await fs.open(filePath, 'r');
            const buffer = Buffer.alloc(chunkSize);

            while (bytesRead < fileSize) {
                const { bytesRead: currentBytesRead } = await fileHandle.read(
                    buffer, 0, chunkSize, bytesRead
                );

                if (currentBytesRead === 0) break;

                const chunk = buffer.subarray(0, currentBytesRead);
                chunks.push(chunk);
                bytesRead += currentBytesRead;

                // 报告进度
                if (onProgress) {
                    onProgress({
                        bytesRead,
                        totalBytes: fileSize,
                        progress: Math.round((bytesRead / fileSize) * 100)
                    });
                }
            }

            await fileHandle.close();

            // 合并所有块
            const result = Buffer.concat(chunks);
            return encoding ? result.toString(encoding) : result;

        } catch (error) {
            console.error('流式读取文件失败:', error);
            throw error;
        }
    }

    /**
     * 创建临时文件
     */
    async createTempFile(data, options = {}) {
        const {
            prefix = 'p-excel-',
            suffix = '.tmp',
            encoding = 'utf8'
        } = options;

        try {
            const tempFileName = `${prefix}${Date.now()}-${Math.random().toString(36).substr(2, 9)}${suffix}`;
            const tempFilePath = path.join(this.cacheDir, 'temp', tempFileName);

            await fs.writeFile(tempFilePath, data, encoding);
            this.tempFiles.add(tempFilePath);

            console.log('创建临时文件:', tempFilePath);
            return tempFilePath;

        } catch (error) {
            console.error('创建临时文件失败:', error);
            throw error;
        }
    }

    /**
     * 缓存数据
     */
    async cacheData(key, data, options = {}) {
        const {
            compress = true,
            ttl = 24 * 60 * 60 * 1000 // 24小时
        } = options;

        try {
            const cacheKey = this.generateCacheKey(key);
            const cacheFilePath = path.join(this.cacheDir, 'data', `${cacheKey}.cache`);
            
            const cacheEntry = {
                key,
                data,
                timestamp: Date.now(),
                ttl,
                compressed: compress
            };

            let cacheData = JSON.stringify(cacheEntry);
            
            if (compress) {
                const zlib = require('zlib');
                cacheData = await new Promise((resolve, reject) => {
                    zlib.gzip(cacheData, (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    });
                });
            }

            await fs.writeFile(cacheFilePath, cacheData);
            
            // 更新缓存大小
            const stats = await fs.stat(cacheFilePath);
            this.cacheSize += stats.size;

            // 检查缓存大小限制
            if (this.cacheSize > this.maxCacheSize) {
                await this.evictOldCache();
            }

            console.log('数据已缓存:', cacheKey);
            return cacheKey;

        } catch (error) {
            console.error('缓存数据失败:', error);
            throw error;
        }
    }

    /**
     * 获取缓存数据
     */
    async getCachedData(key) {
        try {
            const cacheKey = this.generateCacheKey(key);
            const cacheFilePath = path.join(this.cacheDir, 'data', `${cacheKey}.cache`);

            // 检查文件是否存在
            try {
                await fs.access(cacheFilePath);
            } catch (error) {
                return null; // 缓存不存在
            }

            let cacheData = await fs.readFile(cacheFilePath);
            let cacheEntry;

            try {
                // 尝试解析为JSON（未压缩的缓存）
                cacheEntry = JSON.parse(cacheData.toString());
            } catch (parseError) {
                // 可能是压缩的缓存
                const zlib = require('zlib');
                const decompressed = await new Promise((resolve, reject) => {
                    zlib.gunzip(cacheData, (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    });
                });
                cacheEntry = JSON.parse(decompressed.toString());
            }

            // 检查TTL
            if (Date.now() - cacheEntry.timestamp > cacheEntry.ttl) {
                await this.removeCachedData(key);
                return null;
            }

            console.log('缓存命中:', cacheKey);
            return cacheEntry.data;

        } catch (error) {
            console.error('获取缓存数据失败:', error);
            return null;
        }
    }

    /**
     * 删除缓存数据
     */
    async removeCachedData(key) {
        try {
            const cacheKey = this.generateCacheKey(key);
            const cacheFilePath = path.join(this.cacheDir, 'data', `${cacheKey}.cache`);

            const stats = await fs.stat(cacheFilePath);
            await fs.unlink(cacheFilePath);
            
            this.cacheSize -= stats.size;
            console.log('缓存已删除:', cacheKey);

        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('删除缓存失败:', error);
            }
        }
    }

    /**
     * 生成缓存键
     */
    generateCacheKey(key) {
        return crypto.createHash('md5').update(key).digest('hex');
    }

    /**
     * 清理旧的临时文件
     */
    async cleanupOldTempFiles() {
        try {
            const tempDir = path.join(this.cacheDir, 'temp');
            const files = await fs.readdir(tempDir);
            const now = Date.now();
            const maxAge = 24 * 60 * 60 * 1000; // 24小时

            for (const file of files) {
                const filePath = path.join(tempDir, file);
                const stats = await fs.stat(filePath);
                
                if (now - stats.mtime.getTime() > maxAge) {
                    await fs.unlink(filePath);
                    console.log('清理旧临时文件:', filePath);
                }
            }

        } catch (error) {
            console.error('清理临时文件失败:', error);
        }
    }

    /**
     * 清理所有临时文件
     */
    async cleanupTempFiles() {
        try {
            for (const tempFile of this.tempFiles) {
                try {
                    await fs.unlink(tempFile);
                    console.log('删除临时文件:', tempFile);
                } catch (error) {
                    if (error.code !== 'ENOENT') {
                        console.error('删除临时文件失败:', tempFile, error);
                    }
                }
            }
            this.tempFiles.clear();

        } catch (error) {
            console.error('清理临时文件失败:', error);
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

            this.cacheSize = totalSize;
            console.log('当前缓存大小:', this.formatBytes(this.cacheSize));

        } catch (error) {
            console.error('计算缓存大小失败:', error);
            this.cacheSize = 0;
        }
    }

    /**
     * 清理旧缓存
     */
    async evictOldCache() {
        try {
            const dataDir = path.join(this.cacheDir, 'data');
            const files = await fs.readdir(dataDir);
            const fileStats = [];

            // 获取所有缓存文件的统计信息
            for (const file of files) {
                const filePath = path.join(dataDir, file);
                const stats = await fs.stat(filePath);
                fileStats.push({
                    path: filePath,
                    mtime: stats.mtime,
                    size: stats.size
                });
            }

            // 按修改时间排序，删除最旧的文件
            fileStats.sort((a, b) => a.mtime - b.mtime);

            let freedSpace = 0;
            const targetFreeSpace = this.maxCacheSize * 0.2; // 释放20%的空间

            for (const file of fileStats) {
                if (freedSpace >= targetFreeSpace) break;

                await fs.unlink(file.path);
                freedSpace += file.size;
                this.cacheSize -= file.size;
                console.log('清理旧缓存:', file.path);
            }

            console.log('缓存清理完成，释放空间:', this.formatBytes(freedSpace));

        } catch (error) {
            console.error('清理旧缓存失败:', error);
        }
    }

    /**
     * 获取缓存信息
     */
    async getCacheInfo() {
        try {
            const dataDir = path.join(this.cacheDir, 'data');
            const tempDir = path.join(this.cacheDir, 'temp');
            
            const dataFiles = await fs.readdir(dataDir);
            const tempFiles = await fs.readdir(tempDir);

            return {
                cacheSize: this.cacheSize,
                maxCacheSize: this.maxCacheSize,
                cacheUsagePercent: Math.round((this.cacheSize / this.maxCacheSize) * 100),
                dataFileCount: dataFiles.length,
                tempFileCount: tempFiles.length,
                cacheDir: this.cacheDir
            };

        } catch (error) {
            console.error('获取缓存信息失败:', error);
            return null;
        }
    }

    /**
     * 清理所有缓存
     */
    async clearCache() {
        try {
            const dataDir = path.join(this.cacheDir, 'data');
            const files = await fs.readdir(dataDir);

            for (const file of files) {
                const filePath = path.join(dataDir, file);
                await fs.unlink(filePath);
            }

            this.cacheSize = 0;
            console.log('所有缓存已清理');

        } catch (error) {
            console.error('清理缓存失败:', error);
        }
    }

    /**
     * 优化缓存
     */
    async optimizeCache() {
        try {
            // 清理过期缓存
            await this.cleanupExpiredCache();
            
            // 如果缓存使用率超过80%，清理旧缓存
            if (this.cacheSize > this.maxCacheSize * 0.8) {
                await this.evictOldCache();
            }

            console.log('缓存优化完成');

        } catch (error) {
            console.error('缓存优化失败:', error);
        }
    }

    /**
     * 清理过期缓存
     */
    async cleanupExpiredCache() {
        try {
            const dataDir = path.join(this.cacheDir, 'data');
            const files = await fs.readdir(dataDir);

            for (const file of files) {
                const filePath = path.join(dataDir, file);
                
                try {
                    const cacheData = await fs.readFile(filePath);
                    let cacheEntry;

                    try {
                        cacheEntry = JSON.parse(cacheData.toString());
                    } catch (parseError) {
                        // 可能是压缩的缓存
                        const zlib = require('zlib');
                        const decompressed = await new Promise((resolve, reject) => {
                            zlib.gunzip(cacheData, (err, result) => {
                                if (err) reject(err);
                                else resolve(result);
                            });
                        });
                        cacheEntry = JSON.parse(decompressed.toString());
                    }

                    // 检查是否过期
                    if (Date.now() - cacheEntry.timestamp > cacheEntry.ttl) {
                        const stats = await fs.stat(filePath);
                        await fs.unlink(filePath);
                        this.cacheSize -= stats.size;
                        console.log('清理过期缓存:', filePath);
                    }

                } catch (error) {
                    // 如果无法解析缓存文件，删除它
                    console.warn('无法解析缓存文件，删除:', filePath);
                    const stats = await fs.stat(filePath);
                    await fs.unlink(filePath);
                    this.cacheSize -= stats.size;
                }
            }

        } catch (error) {
            console.error('清理过期缓存失败:', error);
        }
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
     * 检查磁盘空间
     */
    async checkDiskSpace() {
        try {
            const stats = await fs.statfs(this.cacheDir);
            const freeSpace = stats.bavail * stats.bsize;
            const totalSpace = stats.blocks * stats.bsize;
            
            return {
                free: freeSpace,
                total: totalSpace,
                used: totalSpace - freeSpace,
                freePercent: Math.round((freeSpace / totalSpace) * 100)
            };

        } catch (error) {
            console.error('检查磁盘空间失败:', error);
            return null;
        }
    }

    /**
     * 清理资源
     */
    async cleanup() {
        try {
            // 清理所有临时文件
            await this.cleanupTempFiles();
            
            // 优化缓存
            await this.optimizeCache();
            
            console.log('文件系统管理器清理完成');

        } catch (error) {
            console.error('文件系统管理器清理失败:', error);
        }
    }
}

module.exports = FileSystemManager;