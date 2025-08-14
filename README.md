# P_Excel 桌面版

## 📋 项目概述

P_Excel桌面版是基于Electron开发的跨平台桌面应用，专为处理大批量Excel/CSV文件而设计。相比Web版本，桌面版突破了浏览器限制，支持GB级别大文件和百万级数据行处理。

### ✨ 核心特性

- **🚀 大文件支持** - 支持GB级别文件，百万行数据处理
- **⚡ 高性能处理** - 多进程架构，并行数据处理
- **🖥️ 跨平台运行** - 支持Windows、macOS、Linux
- **📊 可视化规则** - 保持Web版本的可视化操作体验
- **🔒 数据安全** - 完全本地处理，无网络传输
- **🎯 智能缓存** - 内存+磁盘缓存策略，优化性能

## 🏗️ 技术架构

### 核心技术栈
- **桌面框架**: Electron + Node.js
- **数据处理**: Apache Arrow + DuckDB
- **UI框架**: 保留现有HTML/CSS/JS + daisyUI
- **存储方案**: SQLite + 文件系统缓存
- **多进程**: 主进程 + 渲染进程 + Worker进程池

### 项目结构
```
P_Excel_Desktop/
├── src/
│   ├── main/              # Electron主进程
│   │   ├── app.js                # 应用入口
│   │   ├── appManager.js         # 应用管理器
│   │   ├── fileSystemManager.js  # 文件系统管理
│   │   ├── ipcManager.js         # 进程间通信
│   │   └── resourceMonitor.js    # 资源监控
│   ├── renderer/          # 渲染进程（保留Web版本结构）
│   │   ├── js/
│   │   │   ├── core/             # 核心业务逻辑
│   │   │   ├── ui/               # UI组件
│   │   │   └── utils/            # 工具函数
│   │   ├── css/                  # 样式文件
│   │   └── index.html            # 主界面
│   ├── workers/           # Worker进程
│   │   ├── dataParserWorker.js   # 数据解析
│   │   ├── dataProcessorWorker.js # 数据处理
│   │   └── cacheWorker.js        # 缓存管理
│   └── shared/            # 共享代码
├── resources/             # 应用资源
├── build/                # 构建配置
├── dist/                 # 构建输出
└── package.json          # 项目配置
```

## 🔧 功能特性

### 保留Web版本功能
- ✅ 多文件拖拽上传
- ✅ 可视化数据预览
- ✅ 规则化数据处理（筛选、排序、合并）
- ✅ 快捷操作（筛选本月数据、提取优质资源位）
- ✅ Excel/CSV格式导出

### 新增桌面版功能
- 🆕 **大文件处理**: 支持1GB+文件，100万+行数据
- 🆕 **批量处理**: 队列管理，并行处理多个文件
- 🆕 **高级计算**: 数学运算、统计分析、自定义公式
- 🆕 **智能缓存**: 内存+磁盘缓存，优化大数据处理
- 🆕 **错误恢复**: 自动恢复机制，处理异常情况
- 🆕 **性能监控**: 实时资源使用监控
- 🆕 **安全保护**: 数据加密存储，自动清理

## 🚀 快速开始

### 环境要求
- Node.js >= 16.0.0
- npm >= 8.0.0
- 操作系统: Windows 10+, macOS 10.15+, Ubuntu 18.04+

### 安装依赖
```bash
# 克隆项目
git clone https://github.com/kw-96/P_Excel_Desktop.git
cd P_Excel_Desktop

# 安装依赖
npm install
```

### 开发模式
```bash
# 启动开发模式
npm run dev

# 运行测试
npm test

# 代码检查
npm run lint
```

### 构建应用
```bash
# 构建当前平台
npm run build

# 构建Windows版本
npm run build:win

# 构建macOS版本  
npm run build:mac

# 构建Linux版本
npm run build:linux

# 构建所有平台
npm run build:all
```

## 📊 性能对比

| 特性 | Web版本 | 桌面版本 |
|------|---------|----------|
| 最大文件大小 | 10MB | 10GB+ |
| 最大数据行数 | 10万行 | 1000万行+ |
| 处理方式 | 单线程 | 多进程并行 |
| 内存限制 | 浏览器限制 | 系统内存 |
| 缓存策略 | 浏览器缓存 | 智能缓存 |
| 错误恢复 | 基础 | 自动恢复 |

## 🔒 安全特性

- **本地处理**: 所有数据处理在本地完成
- **无网络通信**: 完全离线运行
- **数据加密**: 支持敏感数据加密存储
- **自动清理**: 应用关闭时自动清理临时文件
- **权限控制**: 文件访问权限检查

## 📱 系统支持

### Windows
- Windows 10 (x64, x86)
- Windows 11 (x64, ARM64)
- 安装包: NSIS安装器、便携版

### macOS  
- macOS 10.15+ (Intel)
- macOS 11+ (Apple Silicon)
- 安装包: DMG磁盘映像

### Linux
- Ubuntu 18.04+
- CentOS 7+
- 安装包: AppImage、DEB、RPM

## 🛠️ 开发指南

### 项目架构
- **主进程**: 应用生命周期、文件系统、系统集成
- **渲染进程**: UI界面、用户交互（保留Web版本结构）
- **Worker进程**: 数据处理、计算任务
- **共享模块**: 跨进程通信、工具函数

### 添加新功能
1. 确定功能类型（核心逻辑/UI组件/工具函数）
2. 选择合适进程（主进程/渲染进程/Worker进程）
3. 遵循现有目录结构和命名规范
4. 添加适当的IPC通信
5. 编写相应测试

### 代码规范
- ESLint代码检查
- 中文注释和文档
- 模块化设计
- 错误处理

## 📝 更新日志

### v1.0.0 (开发中)
- 🎉 项目初始化
- ⚡ Electron架构搭建
- 📊 大文件处理引擎
- 🔧 多进程通信机制
- 🎯 保留Web版本所有功能

## 🤝 贡献指南

1. Fork本项目
2. 创建功能分支 (`git checkout -b feature/新功能`)
3. 提交修改 (`git commit -m '添加新功能'`)
4. 推送到分支 (`git push origin feature/新功能`)
5. 创建Pull Request

## 📄 许可证

本项目采用MIT许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🔗 相关链接

- [Web版本仓库](https://github.com/kw-96/RuleXcel)
- [问题反馈](https://github.com/kw-96/P_Excel_Desktop/issues)
- [功能建议](https://github.com/kw-96/P_Excel_Desktop/discussions)

---

**P_Excel桌面版** - 突破限制，处理更大数据！🚀