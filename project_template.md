# 项目开发文档

## 项目基本信息

### 项目名称
[RuleXcel]

### 项目描述
[批量进行表格文件读取、筛选数据、排序并导出表格的轻量级可视化纯前端web工具]

### 项目类型
- Web应用

### 项目优先级
- 高


## 技术架构

### 技术栈
- **UI框架**: 原生HTML/CSS/JS
- **文件解析**: SheetJS (xlsx.js)
- **数据处理**: Arquero
- **规则引擎**: JSONLogic + 自定义DSL
- **UI组件库**: daisyUI
- **表格导出**: SheetJS

### 开发工具
- **代码编辑器**: Cursor
- **版本控制**: Git + GitHub
- **包管理器**: npm
- **代码规范**: ESLint

## 功能需求

### 核心功能
1. 批量上传表格文件（支持execl、csv）
2. 批量读取表格内容
3. 自定义规则批量处理表格数据、数据排序以及合并表格
4. 导出表格文件
5. 存在两个快捷按钮（筛选本月数据；提取优质资源位），固定表格处理规则，快捷处理并导出表格

### 核心流程
flowchart TB
    A[上传多个文件] --> B[SheetJS解析为JSON]
    B --> C[用户输入规则DSL]
    C --> D{规则类型}
    D -->|筛选| E[Arquero.filter]
    D -->|排序| F[Arquero.orderby]
    D -->|合并| G[Arquero.join]
    E & F & G --> H[SheetJS导出结果]

### 性能要求
- **响应时间**: < 500ms（文件解析和处理）
- **文件大小**: 支持单文件最大10MB的Excel/CSV
- **数据量**: 支持单个文件最多100,000行数据处理
- **浏览器兼容**: 支持Chrome 80+, Firefox 75+, Safari 13+
- **存储**: 纯前端处理，不保存历史记录和数据

## 项目结构

### 目录规划
```
RuleXcel/
├── index.html              # 主页面
├── .cursor/                # Cursor AI配置目录
│   └── rules/              # 项目级AI规则配置
├── src/
│   ├── js/
│   │   ├── core/          # 核心功能模块
│   │   │   ├── fileParser.js      # 文件解析器
│   │   │   ├── dataProcessor.js   # 数据处理器
│   │   │   ├── ruleEngine.js      # 规则引擎
│   │   │   └── exporter.js        # 文件导出器
│   │   ├── ui/            # UI交互模块
│   │   │   ├── fileUpload.js      # 文件上传组件
│   │   │   ├── ruleEditor.js      # 规则编辑器
│   │   │   ├── dataPreview.js     # 数据预览
│   │   │   └── quickActions.js    # 快捷操作
│   │   ├── utils/         # 工具函数
│   │   │   ├── validator.js       # 数据验证
│   │   │   ├── formatter.js       # 格式化工具
│   │   │   └── logger.js          # 日志工具
│   │   └── main.js        # 主入口文件
│   ├── css/
│   │   ├── main.css       # 主样式文件
│   │   └── components/    # 组件样式
│   └── assets/
│       ├── icons/         # 图标资源
│       └── examples/      # 示例文件
├── libs/                  # 第三方库
│   ├── xlsx.min.js        # SheetJS
│   ├── arquero.min.js     # Arquero数据处理
│   └── json-logic.min.js  # JSONLogic规则引擎
├── logs/                  # 开发日志目录
│   └── 2025-07-01.md      # 按日期命名的开发日志
├── docs/                  # 项目文档
│   ├── user-guide.md      # 用户使用指南
│   └── api-reference.md   # API参考文档
├── package.json           # 项目依赖（开发工具）
├── README.md              # 项目说明
├── .gitignore             # Git忽略文件
└── .eslintrc.json         # ESLint配置
```

### 命名规范
- **文件命名**: kebab-case（如: file-parser.js）
- **函数命名**: camelCase（如: parseExcelFile）
- **变量命名**: camelCase（如: uploadedFiles）
- **常量命名**: UPPER_SNAKE_CASE（如: MAX_FILE_SIZE）
- **CSS类名**: BEM命名法（如: .rule-editor__input）

## AI开发计划

> 本项目采用Cursor AI全程辅助开发，所有开发任务将通过AI协助完成

### 阶段一 - 项目初始化
- [ ] 创建完整项目目录结构
- [ ] 配置.cursor/rules/目录和MDC规则文件
- [ ] 创建基础HTML页面框架
- [ ] 引入必要的第三方库
- [ ] 初始化Git仓库并配置GitHub

### 阶段二 - 核心功能实现
- [ ] 文件上传与解析模块
- [ ] 数据预览与表格显示
- [ ] 规则引擎与DSL解析
- [ ] 数据处理（筛选、排序、合并）
- [ ] 文件导出功能

### 阶段三 - 快捷操作与优化
- [ ] 快捷按钮实现（本月数据筛选、优质资源位提取）
- [ ] UI/UX优化与响应式适配
- [ ] 错误处理与用户体验优化
- [ ] 性能优化

### 阶段四 - 部署与文档
- [ ] GitHub Pages配置与部署
- [ ] 用户使用指南编写
- [ ] 项目文档完善
- [ ] 最终测试与发布

## Cursor Rules配置规范

### 项目规则结构 (.cursor/rules/)

根据最新的Cursor规范，项目规则使用`.cursor/rules/`目录结构，每个规则文件采用MDC格式：

#### 主规则文件: .cursor/rules/project-setup.mdc
```
---
description: RuleXcel项目开发主规则
alwaysApply: true
---

# RuleXcel项目开发规则

## 项目概述
这是一个纯前端的Excel/CSV文件批量处理工具，使用原生JavaScript开发。

## 开发规范
1. 使用原生HTML/CSS/JavaScript，不使用框架
2. 遵循ES6+语法标准
3. 采用模块化开发，每个功能独立文件
4. 使用daisyUI进行UI样式设计
5. 所有操作在浏览器端完成，不涉及服务器交互

## 代码风格
- 使用camelCase命名函数和变量
- 使用kebab-case命名文件
- 使用UPPER_SNAKE_CASE命名常量
- 每个函数都要有详细的JSDoc注释
- 错误处理要完善，用户友好的提示信息

## 技术栈
- 文件解析: SheetJS (xlsx.js)
- 数据处理: Arquero
- 规则引擎: JSONLogic + 自定义DSL
- UI组件: daisyUI
- 构建工具: 原生开发，无构建步骤

## 特殊要求
1. 每次修改后更新logs目录下的日志文件
2. 日志文件按日期命名（YYYY-MM-DD.md）
3. 记录修改内容、时间和原因
4. 确保代码可以直接在浏览器中运行
5. 优先考虑性能和用户体验

## 文件组织
- 核心功能放在src/js/core/目录
- UI组件放在src/js/ui/目录  
- 工具函数放在src/js/utils/目录
- 样式文件放在src/css/目录
- 第三方库放在libs/目录
```

#### JavaScript规则: .cursor/rules/javascript-style.mdc
```
---
description: JavaScript编码规范
globs: ["src/js/**/*.js"]
alwaysApply: false
---

# JavaScript编码规范

## 语法规范
- 使用ES6+语法特性
- 优先使用const，必要时使用let，避免var
- 使用箭头函数处理短函数
- 使用模板字符串进行字符串拼接
- 使用解构赋值简化代码

## 函数设计
- 每个函数职责单一，功能明确
- 函数名使用动词开头，描述功能
- 参数数量不超过3个，复杂参数使用对象
- 返回值类型保持一致

## 错误处理
- 使用try-catch处理可能出错的操作
- 提供用户友好的错误提示
- 记录详细的错误日志便于调试
```

#### UI组件规则: .cursor/rules/ui-components.mdc
```
---
description: UI组件开发规范
globs: ["src/js/ui/**/*.js", "src/css/**/*.css"]
alwaysApply: false
---

# UI组件开发规范

## 组件设计原则
- 组件功能单一，职责明确
- 支持自定义配置和样式
- 提供清晰的API接口
- 支持事件回调机制

## 样式规范
- 使用daisyUI作为基础UI框架
- 采用BEM命名法编写自定义CSS
- 确保响应式设计兼容性
- 优化性能，避免重复渲染

## 交互设计
- 提供清晰的用户反馈
- 支持键盘操作
- 考虑无障碍访问需求
```

#### 开发日志规则: .cursor/rules/development-logs.mdc
```
---
description: 开发日志记录规范
globs: ["logs/**/*.md"]
alwaysApply: false
---

# 开发日志记录规范

## 日志格式
- 文件名格式: YYYY-MM-DD.md
- 包含修改时间、内容、原因
- 使用Markdown格式编写
- 记录重要决策和变更

## 内容要求
- 详细描述修改的文件和功能
- 说明修改原因和目标
- 记录遇到的问题和解决方案
- 标注修改者和时间信息

@logs/template.md
```

## 开发规范

### 代码提交规范
- **feat**: 新功能
- **fix**: 修复bug
- **docs**: 文档更新
- **style**: 代码格式调整
- **refactor**: 代码重构
- **test**: 测试相关
- **chore**: 构建过程或辅助工具的变动

### 分支管理
- **main**: 主分支

## 注意事项

### 开发注意事项
- **纯前端实现**: 所有数据处理在浏览器端完成，不涉及服务器交互
- **文件安全**: 用户上传的文件仅在浏览器内存中处理，不会上传到服务器
- **内存管理**: 处理大文件时注意内存占用，及时释放不用的数据
- **错误处理**: 完善的错误捕获和用户友好的错误提示
- **浏览器兼容**: 确保在主流浏览器中正常运行

### 性能考虑点
- **文件大小限制**: 单文件最大10MB，防止浏览器崩溃
- **数据分页**: 大数据量时使用虚拟滚动或分页显示
- **异步处理**: 文件解析和数据处理使用Web Workers避免UI阻塞
- **缓存机制**: 解析结果临时缓存，避免重复解析

### 安全注意事项
- **文件类型检查**: 严格验证上传文件的类型和格式
- **数据验证**: 对用户输入的规则进行严格验证
- **XSS防护**: 避免直接渲染用户输入的HTML内容

### 已知限制
- 仅支持Excel（.xlsx/.xls）和CSV格式文件
- 不支持带有复杂公式的Excel文件
- 不支持Excel中的图片、图表等非数据内容
- 浏览器内存限制了可处理的最大数据量

## 部署配置

### GitHub Pages部署
1. **仓库设置**: 在GitHub仓库Settings中启用Pages功能
2. **分支配置**: 选择main分支作为部署源
3. **自定义域名**: 可配置自定义域名（可选）
4. **自动部署**: 每次推送到main分支自动触发部署

### 本地开发服务器
```bash
# 使用Python简单HTTP服务器
python -m http.server 8000

# 或使用Node.js的http-server
npx http-server -p 8000
```

### 构建优化
- 压缩JavaScript和CSS文件
- 优化图片资源
- 启用浏览器缓存
- 配置CDN加速（可选）

## 参考资料

### 官方文档
- [SheetJS Documentation](https://docs.sheetjs.com/) - Excel/CSV文件处理
- [Arquero Documentation](https://uwdata.github.io/arquero/) - 数据转换和查询
- [JSONLogic Documentation](https://jsonlogic.com/) - 规则引擎
- [daisyUI Documentation](https://daisyui.com/) - Tailwind CSS组件库

### 技术参考
- [MDN Web Docs - File API](https://developer.mozilla.org/en-US/docs/Web/API/File) - 文件处理API
- [MDN Web Docs - Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) - 后台线程处理

### 类似项目参考
- [SheetJS Live Demo](https://sheetjs.com/demos/) - 在线Excel处理工具
- [CSV to JSON Converter](https://csvjson.com/) - 在线CSV转换工具
- [Luckysheet](https://mengshukeji.gitee.io/LuckysheetDocs/) - 在线表格编辑器

## 更新日志

### 2025-07-01 - v0.1.0
- 项目初始化
- 完善项目开发文档
- 确定技术架构和开发计划

---

**备注**: 
- 项目采用纯前端架构，部署在GitHub Pages
- 所有数据处理在浏览器端完成，保证数据安全
- 定期更新开发进度和遇到的问题
- 欢迎提交Issues和Pull Requests