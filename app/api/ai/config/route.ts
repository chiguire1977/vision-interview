export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    providers: {
      deepseek: {
        configured: Boolean(process.env.DEEPSEEK_API_KEY),
        baseUrl: "https://api.deepseek.com",
        defaultModel: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
      },
      openai: {
        configured: Boolean(process.env.OPENAI_API_KEY),
        baseUrl: "https://api.openai.com/v1",
        defaultModel: process.env.OPENAI_MODEL || "gpt-5-mini",
      },
    },
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
