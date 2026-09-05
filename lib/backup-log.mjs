const BACKUP_LOG_DEFINITIONS = {
  started: { level: "INFO", event: "github.backup.started", message: "开始备份数据到 GitHub" },
  succeeded: { level: "INFO", event: "github.backup.succeeded", message: "数据已成功备份到 GitHub" },
  failed: { level: "ERROR", event: "github.backup.failed", message: "数据备份到 GitHub 失败" },
};

const SENSITIVE_KEY = /(token|api[-_]?key|authorization|secret|credential|password)/i;

export function createGitHubBackupLog(stage, context = {}) {
  const definition = BACKUP_LOG_DEFINITIONS[stage] || BACKUP_LOG_DEFINITIONS.failed;
  const safeContext = Object.fromEntries(
    Object.entries(context).filter(([key]) => !SENSITIVE_KEY.test(key)),
  );
  return { ...definition, context: safeContext };
}
