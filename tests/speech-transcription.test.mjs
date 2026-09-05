import assert from "node:assert/strict";
import test from "node:test";

import {
  WHISPER_MODEL,
  parseWhisperTranscription,
  transcribeWithWhisper,
  validateSpeechUpload,
} from "../lib/speech-transcription.mjs";

test("validates a non-empty audio upload within the server limit", () => {
  assert.equal(validateSpeechUpload({ size: 1024, type: "audio/webm" }), null);
  assert.equal(validateSpeechUpload({ size: 0, type: "audio/webm" }), "录音内容为空，请重新录音。");
  assert.equal(validateSpeechUpload({ size: 1024, type: "" }), "无法识别音频格式，请重新录音。");
  assert.equal(validateSpeechUpload({ size: 16 * 1024 * 1024 + 1, type: "audio/webm" }), "录音文件不能超过 16 MB。");
});

test("calls the Cloudflare Whisper model with Chinese transcription options", async () => {
  let call;
  const ai = {
    run: async (...args) => {
      call = args;
      return { text: "  这是测试回答。  " };
    },
  };
  const result = await transcribeWithWhisper(ai, new Uint8Array([1, 2, 3]));

  assert.equal(result, "这是测试回答。");
  assert.equal(call[0], WHISPER_MODEL);
  assert.deepEqual(call[1], {
    audio: new Uint8Array([1, 2, 3]),
    language: "zh",
    task: "transcribe",
    vad_filter: true,
  });
});

test("accepts Whisper response text and rejects an empty transcription", () => {
  assert.equal(parseWhisperTranscription({ text: "回答内容" }), "回答内容");
  assert.equal(parseWhisperTranscription({ transcription_info: {}, text: "  " }), null);
  assert.equal(parseWhisperTranscription(null), null);
});
