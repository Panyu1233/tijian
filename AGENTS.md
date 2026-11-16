# 项目协作规则

目标：长任务可接续、上下文可压缩、不重复读取大文件。

## 上下文与接续
1. 项目唯一接续入口是根目录 `HANDOFF.md`。
2. 新会话、上下文压缩后、用户说“继续/做到哪了”时：先只读 `HANDOFF.md`；不要通读 `preview/app.js`、`preview/index.html`、`preview/styles.css` 或原始 doc/pdf/xlsx。
3. 需要代码细节时，先用 `rg -n` 定位，再只读相关行段；禁止整文件输出大文件。
4. 以下时机必须更新 `HANDOFF.md`（覆盖写，不追加日志）：
   - 开始预计超过 10 次工具调用的任务前；
   - 每完成一个可验证阶段；
   - 连续读取多个大文件或生成大段代码后；
   - 即将结束回合前。
5. `HANDOFF.md` 控制在 120 行以内，只写：目标、当前状态、关键文件、已完成、下一步、验证方式、风险/决策。不要贴代码、原文或长日志。
6. 若上下文接近上限而系统尚未压缩：先写 HANDOFF，再继续；压缩后只读 HANDOFF 恢复。
7. 不要在多个文件重复维护进度；`README.md` 只保留项目简介，进度以 `HANDOFF.md` 为准。

## 项目结构
- `preview/`：纯前端原型，主要开发区。
- `preview/index.html`：页面结构、视图、弹窗。
- `preview/styles.css`：样式与响应式。
- `preview/app.js`：主流程、账号、上传解析、映射、生成、档案库。
- `preview/mapping.js`：企业、岗位、员工、检测报告映射。
- `preview/parsers.js`：本地文件解析及大小/行数限制。
- `preview/templates.js`：6 类文档模板与正文渲染。
- `preview/preview-server.cjs`：静态服务器，默认端口 8765。
- `preview/vendor/`：pdf.js、JSZip、XLSX 本地依赖。
- `职业卫生管理资料/`、根目录 docx/pdf/xlsx：原始资料，默认只读。

## 开发约定
- 保持原生 HTML/CSS/JS，无构建步骤；不要引入框架，除非用户明确要求。
- 数据存 `localStorage/sessionStorage`，仅用于本地演示，不要描述为生产级后端。
- 保持现有中文 UI、设计系统和按企业码隔离资料的逻辑。
- 不提交个人健康档案、体检报告、企业职业卫生档案；遵守 `.gitignore`。
- 临时/生成文件放 `preview/`，不要污染根目录。
- 不删除用户原始资料；清理前先列清单并征得确认。

## 验证
- 启动：`node preview/preview-server.cjs`
- 打开：`http://127.0.0.1:8765/preview/index.html?login=1`
- 最小回归：登录/注册 → 上传资料 → 核查 → 企业档案映射 → 文档生成 → 档案库。
- 只有改动涉及 UI/流程时才做浏览器验证；纯文档或规则改动不必启动服务器。
