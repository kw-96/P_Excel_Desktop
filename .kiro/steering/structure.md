# 项目结构与组织

## 重构项目目录结构

### Electron桌面应用结构

```
P_Excel/
├── src/                    # 源代码
│   ├── main/              # Electron主进程
│   │   ├── app.js                # 应用入口和生命周期管理
│   │   ├── appManager.js         # 应用管理器
│   │   ├── fileSystemManager.js  # 文件系统管理器
│   │   ├── ipcManager.js         # 进程间通信管理器
│   │   ├── resourceMonitor.js    # 系统资源监控
│   │   └── menuManager.js        # 菜单和系统集成
│   ├── renderer/          # 渲染进程（保留Web版本结构）
│   │   ├── js/
│   │   │   ├── core/             # 核心业务逻辑
│   │   │   │   ├── fileParser.js      # 文件解析器
│   │   │   │   ├── dataProcessor.js   # 数据处理器
│   │   │   │   ├── ruleEngine.js      # 规则引擎
│   │   │   │   ├── exporter.js        # 文件导出器
│   │   │   │   ├── columnMapper.js    # 列映射工具
│   │   │   │   └── ruleProcessor.js   # 规则处理器
│   │   │   ├── ui/               # UI组件
│   │   │   │   ├── dataPreview.js     # 数据预览组件
│   │   │   │   ├── progressManager.js # 进度管理器
│   │   │   │   ├── quickActions.js    # 快捷操作组件
│   │   │   │   ├── ruleConfigModal.js # 规则配置界面
│   │   │   │   └── resourceMonitor.js # 资源监控界面
│   │   │   ├── utils/            # 工具函数
│   │   │   │   ├── validator.js       # 数据验证工具
│   │   │   │   ├── formatter.js       # 格式化工具
│   │   │   │   └── logger.js          # 日志工具
│   │   │   └── main.js           # 渲染进程入口
│   │   ├── css/
│   │   │   ├── main.css          # 主样式文件
│   │   │   └── components/       # 组件样式
│   │   └── index.html            # 主界面
│   ├── workers/           # Worker进程
│   │   ├── dataParserWorker.js   # 数据解析Worker
│   │   ├── dataProcessorWorker.js # 数据处理Worker
│   │   ├── cacheWorker.js        # 缓存管理Worker
│   │   └── calculationWorker.js  # 计算引擎Worker
│   └── shared/            # 共享代码
│       ├── constants.js          # 常量定义
│       ├── types.js             # 类型定义
│       ├── ipcChannels.js       # IPC通道定义
│       └── utils.js             # 共享工具函数
├── resources/             # 应用资源
│   ├── icons/            # 应用图标
│   ├── templates/        # 模板文件
│   └── examples/         # 示例文件
├── build/                # 构建配置
│   ├── icon.ico         # Windows图标
│   ├── icon.icns        # macOS图标
│   └── icon.png         # Linux图标
├── dist/                 # 构建输出目录
├── test/                 # 测试文件
│   ├── unit/            # 单元测试
│   ├── integration/     # 集成测试
│   └── e2e/             # 端到端测试
├── docs/                 # 项目文档
├── .kiro/               # Kiro配置
├── package.json         # 项目配置
├── electron-builder.json # 打包配置
├── tsconfig.json        # TypeScript配置
└── README.md            # 项目说明
```

## 代码组织原则

### 进程分离架构

- **主进程 (main/)**: 应用生命周期、文件系统、系统集成
- **渲染进程 (renderer/)**: UI界面、用户交互（保留Web版本结构）
- **Worker进程 (workers/)**: 数据处理、计算任务
- **共享代码 (shared/)**: 跨进程共享的工具和定义

### 模块职责划分

- **core/**: 核心业务逻辑、数据处理、文件操作
- **ui/**: 用户界面组件、交互逻辑、视觉反馈
- **utils/**: 共享工具函数、验证、格式化、日志
- **workers/**: 后台处理任务、大数据计算、缓存管理

### 文件命名规范

- **文件名**: camelCase (例如: `fileParser.js`, `dataPreview.js`)
- **类名**: PascalCase (例如: `FileParser`, `DataProcessor`)
- **函数名**: camelCase (例如: `parseFile`, `validateData`)
- **常量**: UPPER_SNAKE_CASE (例如: `MAX_FILE_SIZE`)
- **TypeScript类型**: PascalCase (例如: `ProcessingTask`, `FileMetadata`)

### 导入导出模式

- 使用ES6模块和明确的导入导出
- 主要类使用默认导出
- 工具函数和常量使用命名导出
- 同模块组内使用相对导入
- 跨进程通信使用IPC通道

## 关键架构模式

### 多进程通信

```javascript
// IPC通道定义 (shared/ipcChannels.js)
export const IPC_CHANNELS = {
  FILE_UPLOAD: 'file:upload',
  DATA_PROCESS: 'data:process',
  PROGRESS_UPDATE: 'progress:update',
  ERROR_REPORT: 'error:report'
};

// 主进程发送 (main/)
ipcMain.handle(IPC_CHANNELS.FILE_UPLOAD, async (event, filePath) => {
  return await fileSystemManager.processFile(filePath);
});

// 渲染进程调用 (renderer/)
const result = await ipcRenderer.invoke(IPC_CHANNELS.FILE_UPLOAD, filePath);
```

### 数据流架构

1. **文件上传**: 渲染进程 → 主进程 → Worker进程
2. **数据处理**: Worker进程 → 主进程 → 渲染进程
3. **进度更新**: Worker进程 → 主进程 → 渲染进程
4. **结果展示**: 渲染进程UI组件显示

### 错误处理策略

- **分层错误处理**: 每个进程处理自己的错误
- **错误传播**: 通过IPC传递错误信息
- **用户友好提示**: 渲染进程显示用户可理解的错误
- **详细日志记录**: 主进程统一记录详细日志

## 开发指南

### 添加新功能流程

1. **确定功能类型**: 核心逻辑、UI组件、还是工具函数
2. **选择合适进程**: 主进程、渲染进程、还是Worker进程
3. **放置到对应目录**: 遵循现有目录结构
4. **遵循命名规范**: 使用一致的命名约定
5. **添加适当的导入导出**: 确保模块可以被正确引用
6. **更新IPC通道**: 如需跨进程通信，定义新的IPC通道
7. **编写测试**: 为新功能添加相应测试

### 文件组织规则

- **相关功能聚合**: 将相关功能放在同一目录
- **关注点分离**: 数据处理与界面展示分离
- **接口一致性**: 保持模块接口的一致性
- **文档化复杂交互**: 为复杂的模块交互添加文档

### 依赖管理

- **Node.js依赖**: 在package.json中管理
- **前端库**: 保留现有的CDN引用方式
- **本地库文件**: 放在resources/目录作为备份
- **原生模块**: 使用electron-rebuild重新编译

### 迁移策略

- **渐进式迁移**: 保持Web版本代码结构，逐步增强
- **接口兼容**: 确保现有API接口保持兼容
- **功能对等**: 确保桌面版包含Web版本所有功能
- **性能提升**: 在保持功能的基础上提升性能

## 质量保证

### 代码规范

- **ESLint**: 代码风格检查
- **Prettier**: 代码格式化
- **TypeScript**: 类型检查（逐步引入）
- **JSDoc**: 函数和类的文档注释

### 测试策略

- **单元测试**: 核心业务逻辑测试
- **集成测试**: 模块间交互测试
- **端到端测试**: 完整功能流程测试
- **性能测试**: 大文件处理性能测试

### 构建和部署

- **开发构建**: 快速构建，支持热重载
- **生产构建**: 代码优化和压缩
- **多平台打包**: 自动化多平台构建
- **版本管理**: 语义化版本控制
