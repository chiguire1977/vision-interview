import {
  transcribeWithWhisper,
  validateSpeechUpload,
} from "@/lib/speech-transcription.mjs";

type WorkersAiBinding = {
  run: (model: string, input: Record<string, unknown>) => Promise<unknown>;
};

type AudioUpload = {
  size: number;
  type: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

function isAudioUpload(value: FormDataEntryValue | null): value is AudioUpload {
  if (!value || typeof value !== "object") return false;
  const upload = value as Partial<AudioUpload>;
  return typeof upload.size === "number"
    && typeof upload.type === "string"
    && typeof upload.arrayBuffer === "function";
}

export async function transcribeSpeech(request: Request, ai?: WorkersAiBinding) {
  if (request.method !== "POST") return Response.json({ ok: false, message: "仅支持 POST 请求。" }, { status: 405 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ ok: false, message: "无法读取录音数据，请重新录音。" }, { status: 400 });
  }

  const upload = form.get("audio");
  if (!isAudioUpload(upload)) return Response.json({ ok: false, message: "请先录制一段语音。" }, { status: 400 });
  const validationError = validateSpeechUpload(upload);
  if (validationError) return Response.json({ ok: false, message: validationError }, { status: 400 });

  try {
    const text = await transcribeWithWhisper(ai, new Uint8Array(await upload.arrayBuffer()));
    return Response.json({ ok: true, text }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "语音识别服务暂时不可用，请稍后重试。";
    return Response.json({ ok: false, message }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const { env } = await import("cloudflare:workers");
  return transcribeSpeech(request, (env as unknown as { AI?: WorkersAiBinding }).AI);
}
