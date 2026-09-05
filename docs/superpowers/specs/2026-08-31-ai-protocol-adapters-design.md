# AI Protocol Adapters Design

## Goal

让 VisionInterview 支持 OpenAI-compatible Chat Completions、OpenAI Responses 和 Anthropic Messages 三种上游协议，并让 AI 设置中的连接测试验证真实聊天请求。

## Scope

- 统一适配层负责 endpoint、请求头、请求体和响应内容提取。
- 题库生成、回答审阅和设置页测试共用 `/api/ai/chat`。
- `/api/ai/models` 继续只负责读取模型列表，但对 OpenCode Go 模型补充协议映射。
- API Key 只从请求体或服务器环境变量读取，不写入日志、配置文件或仓库。

## Protocol behavior

`chat-completions` 使用 `/chat/completions`、Bearer 认证、`messages`、`max_tokens` 和 `stream:false`；`responses` 使用 `/responses`、Bearer 认证、`input` 和 `max_output_tokens`；`anthropic-messages` 使用 `/messages`、`x-api-key`、`anthropic-version`、`system`、`messages` 和 `max_tokens`。

当基础地址是 OpenCode Go 地址时，适配层按官方模型 endpoint 映射自动选择协议；其他服务商使用用户在设置页选择的协议。

## Error and test behavior

真实连接测试发送一条短消息并显示成功、协议、模型和耗时。超时、上游 HTTP 错误、空响应和协议解析错误分别返回可读信息；日志只记录 provider、model、format、status 和 duration。

## Validation

- 单元测试覆盖三种请求体、认证头、endpoint、响应解析和 OpenCode Go 模型映射。
- 运行完整测试和生产构建。
- 通过 Sites checkpoint 发布并验证生产部署状态。
