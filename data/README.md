# 学习数据存档

`vision-interview-data.json` 由 `/api/backup` 自动写入，内容是浏览器
localStorage 的镜像：

| key | 内容 |
|---|---|
| `vision-interview-records` | 学习记录（答题、评分、掌握度） |
| `vision-interview-projects` | 项目列表 |
| `vision-interview-ai-preferences` | AI 偏好（模型、开关） |
| `vision-interview-ai-provider-settings` | 各服务商配置 |
| `vision-interview-project-view` | 界面视图状态 |

这个文件会随 `sync.sh` 一起提交到 GitHub，重新启动时由前端自动拉回，
因此换设备或清缓存都不会丢数据。

注意：此处**不应**存放 API key。密钥请放在 `.env`（已被 .gitignore 忽略）。
