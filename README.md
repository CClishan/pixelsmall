# PixelSmall v1.2

PixelSmall 是一个纯浏览器端的图片与扫描 PDF 压缩工具。

## v1.2 主要更新

- 视觉重做为 PixelTurn 系列同款三栏结构：头部 / 左侧工作区 / 右侧配置区
- 上传区、队列区、配置区按 native 主题细节重新对齐
- 图片压缩改为按格式分流的浏览器端编码链路，不再只依赖单一路径
- PDF 压缩改为逐页栅格化后重编码再重组，更适合扫描件
- 移动端加入底部悬浮操作栏，上传后 drop 区会自动收紧，把空间让给队列
- 队列排序入口已移除，保留下载、删除、取消和 ZIP 打包下载

## 当前能力

| 类型 | 方案 |
|---|---|
| JPEG | `MozJPEG` WASM 编码 |
| PNG 无损 | `OxiPNG` 优化 |
| PNG 有损 | `UPNG.js` 调色板压缩 + `OxiPNG` |
| SVG | `SVGO` 优化 |
| WEBP | 当前走浏览器兼容编码路径 |
| PDF | `pdf.js` 渲染页面，按页选择 JPEG / PNG，再用 `pdf-lib` 重组 |

## 交互特性

- 本地上传、本地压缩，不依赖后端上传处理
- 图片与 PDF 双工作区切换
- 队列态、处理中、完成态、错误态完整区分
- 单文件下载、批量 ZIP 下载
- 已完成冗长说明折叠到状态图标提示里
- 移动端设置/处理/ZIP 下载按钮悬浮到底部

## 项目结构

| 路径 | 说明 |
|---|---|
| `src/App.tsx` | 主布局、工作区切换、配置区、处理流程 |
| `src/components/` | 上传区、队列、提示、tab 等组件 |
| `src/lib/compression/` | 图片/PDF 压缩链路与编码器封装 |
| `src/lib/copy.ts` | 中英文文案 |
| `src/index.css` | 当前 native 对齐样式 |
| `archive/next-prototype/` | 历史归档，不参与当前构建 |

## 设计与复用文档

| 文件 | 作用 |
|---|---|
| `DESIGN.md` | 这条工具家族的设计语言、组件气质、视觉禁忌和复用规则 |
| `TOOL_SCHEMA.md` | 新工具如何复用 header / drop / queue / settings / mobile actions 的工程接入约定 |

这两份文档现在已经明确包含：

- 页面网格结构
- 主容器宽度
- spacing scale
- 卡片 padding
- 控件高度与圆角层级
- 响应式间距策略

## 开源致谢

- `@jsquash/jpeg`
- `@jsquash/oxipng`
- `upng-js`
- `svgo`
- `pdfjs-dist`
- `pdf-lib`
- `browser-image-compression`（兼容回退链路）

## 本地运行

```bash
npm install
npm run dev
```

如需避免端口冲突，可直接运行：

```bash
npm run dev -- --port 3001
```

## 构建检查

```bash
npm run lint
npm run build
```

## 部署

| 项目 | 值 |
|---|---|
| Framework preset | `Vite` |
| Root directory | 仓库根目录 |
| Build command | `npm run build` |
| Output directory | `dist` |
| Environment variables | 无 |
