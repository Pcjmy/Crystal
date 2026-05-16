---
title: 架构概览
---

Crystal 的用户价值是“在你的代码库里完成任务”，内部实现以分层与循环为核心，但这些属于实现方式而不是定位本身。

## 分层结构

1. Interaction Layer：终端 UI（Ink）
2. Orchestration Layer：命令与会话编排（Commander）
3. Core Loop：多轮对话与工具调用的闭环
4. Tooling Layer：文件/搜索/命令等本地工具
5. Model Layer：模型通信（OpenAI 兼容）

## 相关阅读

如果你更关心“使用时发生了什么”，建议先读：[工作原理](./how-it-works)。

