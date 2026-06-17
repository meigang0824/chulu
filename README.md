# 初炉 uni-app 小程序项目框架

这是给 OpenClaw / AI 编码工具使用的 uni-app 项目骨架，用于根据原型图高保真还原微信小程序。

## 使用方式

1. 用 HBuilderX 打开本项目目录。
2. 将 `PROMPT_FOR_AI.md` 的内容发给 OpenClaw / AI 编码工具。
3. 要求 AI 先读取 `openclaw.yml`、`docs/`、`docs/prototypes/`。
4. 开发完成后，在 HBuilderX 中选择：
   - 运行到小程序模拟器 → 微信开发者工具
   - 或发行 → 小程序-微信

## 技术栈

- HBuilderX
- uni-app
- Vue 单文件组件
- SCSS
- 微信小程序编译目标：mp-weixin

## 注意

不要修改 `unpackage/` 目录，它是 HBuilderX 编译产物。
