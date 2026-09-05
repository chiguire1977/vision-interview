export const WHISPER_MODEL = "@cf/openai/whisper-large-v3-turbo";
export const MAX_AUDIO_BYTES = 16 * 1024 * 1024;

export function validateSpeechUpload(file) {
  if (!file || typeof file.size !== "number" || file.size <= 0) return "录音内容为空，请重新录音。";
  if (file.size > MAX_AUDIO_BYTES) return "录音文件不能超过 16 MB。";
  if (typeof file.type !== "string" || !file.type.startsWith("audio/")) return "无法识别音频格式，请重新录音。";
  return null;
}

export function parseWhisperTranscription(payload) {
  if (!payload || typeof payload !== "object") return null;
  const text = payload.text;
  return typeof text === "string" && text.trim() ? text.trim() : null;
}

export async function transcribeWithWhisper(ai, audio) {
  if (!ai || typeof ai.run !== "function") throw new Error("Cloudflare Workers AI 未配置，请稍后重试。");
  const payload = await ai.run(WHISPER_MODEL, {
    audio,
    language: "zh",
    task: "transcribe",
    vad_filter: true,
  });
  const text = parseWhisperTranscription(payload);
  if (!text) throw new Error("Whisper 未返回有效的语音文本，请重新录音。");
  return text;
}
