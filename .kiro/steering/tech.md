# 技术架构

## 重构概述

从Web应用重构为基于Electron的跨平台桌面应用，采用主进程+渲染进程+Worker进程的多进程架构。

## 桌面应用框架

### 核心技术栈
- **Electron**: 跨平台桌面应用开发框架
- **Node.js**: 后端逻辑和文件系统操作
- **TypeScript**: 类型安全的JavaScript开发
- **原生模块**: 性能关键部分使用C++扩展

### 数据处理引擎
- **Apache Arrow**: 内存列式数据格式，支持大数据处理
- **DuckDB**: 嵌入式分析数据库，支持SQL查询
- **Stream处理**: 流式读取和处理大文件
- **保留现有**: SheetJS (xlsx.js)、Arquero、JSONLogic

### UI框架
- **保留现有**: HTML + CSS + JavaScript
- **daisyUI**: 保持现有UI组件库
- **增强功能**: 添加桌面应用特有的UI元素

### 存储方案
- **SQLite**: 元数据和配置存储
- **文件系统**: 大文件缓存和临时存储
- **内存映射**: 大文件高效访问

## 项目结构

### Electron应用结构
```
P_Excel/
├── src/
│   ├── main/           # 主进程代码
│   │   ├── app.js             # 应用入口
│   │   ├── fileManager.js     # 文件系统管理
│   │   ├── ipcManager.js      # 进程间通信
│   │   └── resourceMonitor.js # 系统资源监控
│   ├── renderer/       # 渲染进程代码
│   │   ├── js/         # 保留现有Web版本结构
│   │   │   ├── core/          # 核心业务逻辑
│   │   │   ├── ui/            # UI组件
│   │   │   ├── utils/         # 工具函数
│   │   │   └── main.js        # 渲染进程入口
│   │   ├── css/        # 样式文件
│   │   └── index.html  # 主界面
│   ├── workers/        # Worker进程
│   │   ├── dataParser.js      # 数据解析Worker
│   │   ├── dataProcessor.js   # 数据处理Worker
│   │   ├── cacheManager.js    # 缓存管理Worker
│   │   └── calculator.js      # 计算引擎Worker
│   └── shared/         # 共享代码
│       ├── constants.js       # 常量定义
│       ├── types.js          # 类型定义
│       └── utils.js          # 共享工具
├── resources/          # 应用资源
├── build/             # 构建配置
├── dist/              # 构建输出
├── package.json       # 项目配置
└── electron-builder.json # 打包配置
```

### 核心组件架构

#### 主进程组件
- **AppManager**: 应用生命周期管理
- **FileSystemManager**: 大文件处理和缓存管理
- **IPCManager**: 进程间通信和数据传输
- **ResourceMonitor**: 系统资源监控

#### 渲染进程组件
- **MainController**: 主应用控制器（保留现有接口）
- **DataManager**: 大数据处理管理器
- **UIManager**: 增强的UI管理器
- **QuickActionsManager**: 扩展的快捷操作管理器
- **CalculationManager**: 新增计算引擎管理器

#### Worker进程组件
- **DataParserWorker**: 大文件流式解析
- **DataProcessorWorker**: 并行数据处理
- **CacheWorker**: 智能缓存管理
- **CalculationWorker**: 数学计算和公式引擎

## 开发工作流

### 开发环境搭建
```bash
# 安装依赖
npm install

# 开发模式启动
npm run dev

# 构建应用
npm run build

# 打包应用
npm run dist

# 运行测试
npm test
```

### 构建和打包
- **开发构建**: 热重载和调试支持
- **生产构建**: 代码优化和压缩
- **多平台打包**: Windows、macOS、Linux
- **自动更新**: 内置更新机制

## 性能优化策略

### 内存管理
- **流式处理**: 大文件分块读取
- **内存池**: 重用内存块，减少GC压力
- **压缩存储**: 内存中数据压缩
- **智能缓存**: LRU缓存策略

### 并行处理
- **Worker线程池**: 多线程并行处理
- **任务分片**: 大任务拆分为小任务
- **负载均衡**: 动态分配任务
- **管道处理**: 流水线式数据处理

### 磁盘I/O优化
- **异步I/O**: 所有文件操作异步执行
- **批量操作**: 合并小的I/O操作
- **预读取**: 预测性数据加载
- **SSD优化**: 针对SSD存储优化

## 兼容性和部署

### 系统要求
- **Windows**: Windows 10+ (x64, ARM64)
- **macOS**: macOS 10.15+ (x64, Apple Silicon)
- **Linux**: Ubuntu 18.04+, CentOS 7+ (x64)

### 部署方式
- **安装包**: NSIS (Windows), DMG (macOS), AppImage/DEB/RPM (Linux)
- **便携版**: 免安装版本
- **企业部署**: MSI包和静默安装
- **自动更新**: 增量更新机制

### 开发工具
- **IDE**: VS Code + Electron扩展
- **调试**: Chrome DevTools集成
- **测试**: Jest + Spectron
- **CI/CD**: GitHub Actions
- **代码质量**: ESLint + Prettier