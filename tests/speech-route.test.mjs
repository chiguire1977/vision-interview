import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});
after(async () => { await vite.close(); });

test("speech route forwards an uploaded audio blob to Workers AI", async () => {
  const route = await vite.ssrLoadModule("/app/api/speech/transcribe/route.ts");
  let captured;
  const ai = {
    run: async (model, input) => {
      captured = { model, input };
      return { text: "这是服务端识别结果" };
    },
  };
  const form = new FormData();
  form.append("audio", new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" }), "answer.webm");

  const response = await route.transcribeSpeech(new Request("http://localhost/api/speech/transcribe", {
    method: "POST",
    body: form,
  }), ai);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, text: "这是服务端识别结果" });
  assert.equal(captured.model, "@cf/openai/whisper-large-v3-turbo");
  assert.deepEqual([...captured.input.audio], [1, 2, 3]);
});

test("speech route explains when the audio file is missing", async () => {
  const route = await vite.ssrLoadModule("/app/api/speech/transcribe/route.ts");
  const response = await route.transcribeSpeech(new Request("http://localhost/api/speech/transcribe", { method: "POST", body: new FormData() }), { run() {} });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { ok: false, message: "请先录制一段语音。" });
});
