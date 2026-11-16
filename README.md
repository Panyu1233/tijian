# 体检

职业健康体检与职业卫生管理相关资料，包括产品方案、需求文档、企业模板，以及职业卫生管理、培训、应急管理等通用资料。

## 隐私说明

本仓库为公开仓库，不包含员工个人职业健康监护档案、体检报告、企业职业卫生档案，以及包含上述内容的总压缩包。

## 本地预览

```powershell
node preview/preview-server.cjs
```

打开 `http://127.0.0.1:8765/preview/index.html?login=1`。

当前版本是纯前端演示：文件在浏览器本地解析，企业、人员和生成文档数据存入 `localStorage/sessionStorage`，不会上传到服务器。

## 回归测试

先启动预览服务，再通过 `E2E_FILES_DIR` 指定不含个人信息的测试资料目录：

```powershell
$env:E2E_FILES_DIR = '<测试资料目录>'
node preview/e2e-test.cjs
```
