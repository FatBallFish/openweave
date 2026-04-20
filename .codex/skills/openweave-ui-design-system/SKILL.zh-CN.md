---
name: openweave-ui-design-system
description: OpenWeave 的产品级 UI 设计系统，适用于 AI 工作流编排与无限画布界面。凡是设计、重构、评审或扩展 OpenWeave renderer UI，都应使用此技能，尤其是 workspace shell、canvas shell、节点卡片、inspector、run drawer、对话框和导航相关界面。本技能规定亮色主题使用 Blueprint Canvas，暗色主题使用 Slate Terminal；在产出 mock、静态 demo、React 组件或 UI review 建议前应先使用它。
---

# OpenWeave UI 设计系统

使用这个技能，保证 OpenWeave 在持续演进时仍然保持一致的产品级视觉语言。

## 核心规则

- 亮色模式统一使用 `Blueprint Canvas`。
- 暗色模式统一使用 `Slate Terminal`。
- 设计目标是工程操作效率，而不是艺术渲染。
- 无限画布必须是主工作面；外围 chrome 只能辅助，不能抢戏。
- `running`、`selected`、`warning`、`failed` 等状态必须在 1 秒内可被辨认。

## 使用流程

1. 先判断本次改动的目标表面：workspace shell、canvas shell、node host、inspector、drawer 或 dialog。
2. 再判断需求只涉及亮色、只涉及暗色，还是两者都涉及。
3. 设计前先读对应参考文件：
   - 亮色看 `references/blueprint-canvas.md`
   - 暗色看 `references/slate-terminal.md`
   - 共享规则看 `references/component-rules.md`
4. 除非用户明确要求更大范围改版，否则优先保留现有产品结构。
5. 输出时要给出明确 token、间距、状态表达和层级规则，不要只给抽象形容词。

## 共享产品优先级

- 优先服务高密度工程操作：节点多、状态多、侧边面板多。
- 产品 chrome 必须克制，让图结构关系更清晰。
- 优先使用边框、间距和克制的强调，而不是装饰性效果。
- 节点类型要有一致家族感，但不能全部长得一样。
- terminal、portal、file-tree 这类节点必须“先能干活，再谈装饰”。

## 强约束

- 不要漂移成通用 SaaS dashboard 风格。
- 不要使用紫色主导的默认 AI 配色。
- 不要使用过强的玻璃拟态、霓虹发光或 3D 装饰。
- 不要让画布背景比节点内容更抢眼。
- 不要把关键运行状态埋在低存在感的文字里。
- 不要每个功能各搞一套视觉语言；所有新 UI 都必须映射回这套系统。

## 合格输出的标准

一个好的 OpenWeave UI 结果应当：

- 明确说明使用的是哪个主题
- 给出或复用具体 token
- 清楚描述 shell 层级
- 说明 selected / running / warning / error 的视觉表达
- 如果同时涉及亮暗模式，要保证两者语义一致
- 能提升 branch、verification、portal 操作、terminal 查看、node inspection 等真实工程任务的可用性

## 评审清单

交付前检查：

- 画布是否仍然是最重要的工作面？
- 导航、inspector、drawer 是否都比 graph 更安静？
- selected、running、warning、failed、idle 是否能被立刻区分？
- 字体和信息密度是否像工程工具，而不是营销页面？
- 亮色是否符合 Blueprint Canvas，暗色是否符合 Slate Terminal？
- 如果把这次改动同时放到 portal / terminal / file-tree / note 节点里，整体还是否协调？

## 参考文件

- `references/blueprint-canvas.md` - 亮色主题 token 与布局规则
- `references/slate-terminal.md` - 暗色主题 token 与布局规则
- `references/component-rules.md` - 共享组件结构、状态规则与 do / don't 检查项
