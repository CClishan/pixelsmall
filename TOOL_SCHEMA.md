# PixelTurn Utility Tool Schema

## 1. 目标

这份 `TOOL_SCHEMA.md` 是 `DESIGN.md` 的工程落地补充。

`DESIGN.md` 负责定义这条产品线“看起来像什么”；  
`TOOL_SCHEMA.md` 负责定义这条产品线“新工具应该怎么接进来”。

以后新增任意图片/PDF 处理工具时，优先不要重做整页，而是把业务能力挂到同一个家族外壳上。

---

## 2. 推荐的分层

| 层 | 角色 | 是否复用 |
|---|---|---|
| `FamilyShell` | 页面外层、网格、头部、移动端底部栏 | 强制复用 |
| `WorkspaceModule` | 左栏 drop / cards / queue | 强制复用 |
| `ConfigurationModule` | 右栏标题、配置容器、参数组、主操作 | 强制复用 |
| `ToolAdapter` | 当前工具的文案、参数定义、队列 meta、按钮行为 | 每个工具自定义 |
| `ProcessingEngine` | 真正的压缩/转换/导出逻辑 | 每个工具自定义 |

推荐理解方式：

| 你在做什么 | 应该改哪层 |
|---|---|
| 换工具名称 | `ToolAdapter` |
| 换 drop 提示 | `ToolAdapter` |
| 新增一个滑杆 | `ToolAdapter` 的 settings schema |
| 变更主按钮文案 | `ToolAdapter` |
| 重写整个 header 风格 | 不允许，属于 `FamilyShell` |
| 把 queue 改成另一套排版 | 默认不允许，先走家族组件 |

---

## 3. 固定外壳

### 3.1 FamilyShell

所有同系工具共享：

| 区域 | 固定内容 |
|---|---|
| Header 左侧 | 主标题 |
| Header 右侧 | `WorkspaceTabs` + `LocaleSwitch` |
| 主体左栏 | `Dropzone` + `WorkspaceCards` + `QueueList` |
| 主体右栏 | `ConfigHeader` + `SettingsPanel` + `ActionStack` + `CreditsPanel` |
| 移动端 | `MobileFabBar` |

### 3.2 固定组件名单

| 组件 | 说明 |
|---|---|
| `HeaderShell` | 页面头部骨架 |
| `WorkspaceTabs` | 工具工作区切换 |
| `LocaleSwitch` | 中英切换 |
| `FileDropzone` | 上传入口 |
| `WorkspaceCards` | 左栏摘要卡 |
| `QueueList` | 队列容器 |
| `QueueRow` | 队列单行骨架 |
| `ConfigHeader` | 右栏 `CONFIGURATION` 标题行 |
| `SettingsPanel` | 右栏分组配置容器 |
| `SegmentedControl` | 选择类控件 |
| `RangeControl` | 滑杆类控件 |
| `ActionStack` | 桌面主操作 |
| `MobileFabBar` | 移动端底部操作 |
| `CreditsPanel` | 致谢 / 补充状态 |
| `ToastRegion` | 提示反馈 |

---

## 4. ToolAdapter 必须提供什么

以后每个新工具，至少要能回答下面这些问题：

| 问题 | 对应字段 |
|---|---|
| 这个工具叫什么 | `title` |
| 有几个工作区 / tab | `tabs` |
| 可以接收什么文件 | `dropzone.accept` |
| drop 区显示什么文案 | `dropzone.title / hint` |
| 左栏摘要卡显示什么 | `workspaceCards` |
| queue 每行展示哪些 meta | `queue.meta` |
| 右栏有哪些参数组 | `settings.sections` |
| 主按钮做什么 | `actions.primary` |
| 是否支持 ZIP / 批量下载 | `actions.downloadZip` |
| 右栏底部显示什么补充信息 | `credits` |

---

## 5. 推荐 schema 结构

下面不是死代码，而是建议的统一接口模型。

```ts
type LocaleText =
  | string
  | {
      en: string;
      zh: string;
    };

type WorkspaceKind = "image" | "pdf" | "custom";

type ToolDefinition = {
  toolId: string;
  title: LocaleText;
  tabs: WorkspaceTabDefinition[];
  dropzone: Record<string, DropzoneDefinition>;
  workspaceCards: Record<string, WorkspaceCardDefinition[]>;
  queue: Record<string, QueueDefinition>;
  settings: Record<string, SettingsPanelDefinition>;
  actions: Record<string, ActionDefinition>;
  credits?: CreditsDefinition;
};
```

### 5.1 LayoutSpec

以后所有工具默认都可以挂一份显式布局规格，避免只靠页面代码里临时写 class。

```ts
type LayoutSpec = {
  shell: {
    maxWidth: "6xl" | "7xl" | string;
    desktopPadding: string;
    mobilePadding: string;
    gridColumns: 12;
    desktopGap: string;
    leftSpan: number;
    rightSpan: number;
  };
  spacing: {
    pageSection: string;
    blockGap: string;
    cardGap: string;
    controlGap: string;
    metaGap: string;
  };
};
```

推荐默认值：

| 字段 | 默认值 |
|---|---|
| `shell.maxWidth` | `6xl` |
| `shell.desktopPadding` | `p-8 md:p-16` |
| `shell.mobilePadding` | `p-4` |
| `shell.desktopGap` | `gap-10` |
| `shell.leftSpan` | `8` |
| `shell.rightSpan` | `4` |
| `spacing.pageSection` | `space-8` |
| `spacing.blockGap` | `space-6` |
| `spacing.cardGap` | `space-4` |
| `spacing.controlGap` | `space-3` |
| `spacing.metaGap` | `space-2` |

### 5.2 ComponentSizeSpec

```ts
type ComponentSizeSpec = {
  tabs: {
    outerHeight: number;
    innerHeight: number;
    outerRadius: number;
    innerRadius: number;
  };
  buttons: {
    primaryHeight: number;
    secondaryHeight: number;
    smallHeight: number;
  };
  queue: {
    rowHeight: number;
    thumbSize: number;
    actionHitSize: number;
    readyPillHeight: number;
  };
  panels: {
    configPaddingDesktop: number;
    configPaddingMobile: number;
    controlSectionPaddingDesktop: number;
    controlSectionPaddingMobile: number;
  };
};
```

推荐默认值：

| 字段 | 默认值 |
|---|---|
| `tabs.outerHeight` | `34` |
| `tabs.innerHeight` | `26` |
| `tabs.outerRadius` | `16` |
| `tabs.innerRadius` | `12` |
| `buttons.primaryHeight` | `60` |
| `buttons.secondaryHeight` | `60` |
| `buttons.smallHeight` | `32` |
| `queue.rowHeight` | `80` |
| `queue.thumbSize` | `48` |
| `queue.actionHitSize` | `32` |
| `queue.readyPillHeight` | `18` |
| `panels.configPaddingDesktop` | `32` |
| `panels.configPaddingMobile` | `20` |
| `panels.controlSectionPaddingDesktop` | `20` |
| `panels.controlSectionPaddingMobile` | `16` |

---

## 6. 子结构定义

### 6.1 `WorkspaceTabDefinition`

```ts
type WorkspaceTabDefinition = {
  id: string;
  label: LocaleText;
  icon?: string;
};
```

规则：

- 默认短标签
- 最好 `2~4` 个
- 超过 `4` 个优先横向滚动，不要压得太小

### 6.2 `DropzoneDefinition`

```ts
type DropzoneDefinition = {
  title: LocaleText;
  hint: LocaleText;
  accept: string;
  multiple?: boolean;
  compactTitle?: LocaleText;
  compactHint?: LocaleText;
  icon?: "plus" | "image" | "file" | "pdf" | "custom";
  sizing?: {
    desktopMinHeight?: number;
    mobileMinHeight?: number;
    compactMinHeight?: number;
    desktopPadding?: string;
    compactPadding?: string;
  };
};
```

规则：

- 大态与紧凑态共用一个组件
- 文案最多一主一辅，不要三行堆叠
- icon 语义允许替换，但风格不能跳出家族

### 6.3 `WorkspaceCardDefinition`

```ts
type WorkspaceCardDefinition = {
  id: string;
  label: LocaleText;
  body: LocaleText | { type: "runtime"; key: string };
  meta?: LocaleText | { type: "runtime"; key: string };
  compactOnMobile?: boolean;
};
```

规则：

- 固定语义顺序是 `label -> body -> meta`
- 桌面可 2~4 张
- 移动端可压成紧凑卡

### 6.4 `QueueDefinition`

```ts
type QueueDefinition = {
  title: LocaleText;
  emptyLabel: LocaleText;
  readyBadge?: LocaleText;
  meta: QueueMetaDefinition[];
  detailPolicy?: "inline" | "collapse-to-tooltip";
  sizing?: {
    rowHeight?: number;
    thumbnailSize?: number;
    actionHitSize?: number;
    tooltipWidth?: string;
  };
};
```

### 6.5 `QueueMetaDefinition`

```ts
type QueueMetaDefinition = {
  id: string;
  source:
    | "originalSize"
    | "compressedSize"
    | "fileType"
    | "pageCount"
    | "engine"
    | "duration"
    | "custom";
  emphasize?: "none" | "success" | "warning";
  formatter?: string;
  when?: string;
};
```

规则：

- `compressedSize` 默认允许绿色强调
- 单行 meta 最多建议 `4~6` 项
- 长说明默认折叠到 tooltip，而不是撑高队列

### 6.6 `SettingsPanelDefinition`

```ts
type SettingsPanelDefinition = {
  title?: LocaleText;
  layout?: {
    cardPaddingDesktop?: string;
    cardPaddingMobile?: string;
    sectionGap?: string;
    subsectionGap?: string;
  };
  sections: SettingsSectionDefinition[];
};
```

### 6.7 `SettingsSectionDefinition`

```ts
type SettingsSectionDefinition =
  | SegmentedSectionDefinition
  | RangeSectionDefinition
  | CollapsibleSectionDefinition
  | NoticeSectionDefinition;
```

#### a. 分段选择

```ts
type SegmentedSectionDefinition = {
  type: "segmented";
  id: string;
  label: LocaleText;
  columns?: 2 | 3 | 4;
  size?: "sm" | "md";
  options: {
    value: string;
    label: LocaleText;
  }[];
};
```

适用：

- 输出格式
- preset
- mode
- result policy

#### b. 滑杆

```ts
type RangeSectionDefinition = {
  type: "range";
  id: string;
  label: LocaleText;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  hint?: LocaleText;
  size?: "md";
};
```

适用：

- 质量
- DPI
- 最大尺寸
- 阈值

#### c. 可折叠高级设置

```ts
type CollapsibleSectionDefinition = {
  type: "collapsible";
  id: string;
  label: LocaleText;
  badge?: LocaleText;
  defaultOpen?: boolean;
  children: SettingsSectionDefinition[];
};
```

规则：

- 高级设置默认收起
- 允许带 `建议默认` 这种轻标签
- 只装“低频参数”，不要塞主流程常用项

#### d. 轻量说明

```ts
type NoticeSectionDefinition = {
  type: "notice";
  id: string;
  label?: LocaleText;
  body: LocaleText;
};
```

### 6.8 `ActionDefinition`

```ts
type ActionDefinition = {
  primary: {
    label: LocaleText;
    icon?: "archive" | "download" | "convert" | "resize" | "custom";
  };
  secondary?: {
    label: LocaleText;
    action: "downloadZip" | "clear" | "custom";
  }[];
};
```

规则：

- 桌面端主操作在右栏底部
- 移动端映射到 `MobileFabBar`
- 如果存在批量下载，默认作为 secondary

### 6.9 `CreditsDefinition`

```ts
type CreditsDefinition = {
  title: LocaleText;
  note?: LocaleText;
  chips?: LocaleText[];
};
```

适用：

- 开源致谢
- local-only / browser-side 说明
- 编码器说明

---

## 7. 当前 PixelSmall 的映射示例

### 7.1 图片工作区

```ts
const imageTool = {
  title: { en: "PixelSmall", zh: "PixelSmall" },
  tabs: [
    { id: "image", label: { en: "Images", zh: "图片" } },
    { id: "pdf", label: { en: "PDF", zh: "PDF" } },
  ],
  dropzone: {
    image: {
      title: { en: "Drag, drop, or browse for images", zh: "拖拽、释放或点击选择图片" },
      hint: { en: "JPG PNG WEBP BMP TIFF SVG - up to 50MB each", zh: "JPG PNG WEBP BMP TIFF SVG - 单个文件不超过 50MB" },
      accept: "image/jpeg,image/png,image/webp,image/bmp,image/x-ms-bmp,image/tiff,image/svg+xml",
      icon: "plus",
    },
  },
};
```

### 7.2 PDF 工作区

```ts
const pdfTool = {
  dropzone: {
    pdf: {
      title: { en: "Drag, drop, or browse for PDFs", zh: "拖拽、释放或点击选择 PDF" },
      hint: { en: "Scanned PDF - up to 50MB each", zh: "扫描 PDF - 单个文件不超过 50MB" },
      accept: "application/pdf",
      icon: "pdf",
    },
  },
  settings: {
    pdf: {
      sections: [
        {
          type: "segmented",
          id: "compressionPreset",
          label: { en: "Compression preset", zh: "压缩预设" },
          columns: 3,
          options: [
            { value: "fast", label: { en: "Fast", zh: "快速" } },
            { value: "balanced", label: { en: "Balanced", zh: "均衡" } },
            { value: "smallest", label: { en: "Smallest", zh: "最小" } },
          ],
        },
      ],
    },
  },
};
```

---

## 8. 新工具接入 checklist

以后新增工具时，至少确认下面这些项：

| 检查项 | 是否必须 |
|---|---|
| 有家族 header，不自创头部 | 是 |
| 有 `WorkspaceTabs` / `LocaleSwitch` 统一风格 | 是 |
| drop 有大态和紧凑态 | 是 |
| queue 复用同一骨架 | 是 |
| 右栏有 `CONFIGURATION` 标题行 | 是 |
| 主次按钮进入统一 action 体系 | 是 |
| 移动端无横向溢出 | 是 |
| 中英双语都不炸版 | 是 |
| tooltip / toast / ready 标签风格一致 | 是 |
| 新参数组尽量用 segmented / range / collapsible 组合表达 | 是 |

---

## 9. 推荐的下一步工程化动作

这份 schema 写完后，后面最值得继续做的是：

| 顺序 | 动作 |
|---|---|
| 1 | 抽 `HeaderShell` |
| 2 | 抽 `LocaleSwitch` |
| 3 | 抽 `SegmentedControl` |
| 4 | 抽 `RangeControl` |
| 5 | 抽 `ActionStack` |
| 6 | 抽 `MobileFabBar` |
| 7 | 用 `ToolDefinition` 真正驱动 `src/App.tsx` |

最终目标不是“每次复制一份 PixelSmall 再改”，而是：

> 用同一个家族壳 + 一份工具 schema，快速拼出新的图片处理工具。
