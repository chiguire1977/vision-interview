export const GITHUB_TOKEN_COOKIE_NAME = "__Host-vision-interview-github-token";
export const GITHUB_TOKEN_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function cookieValue(request) {
  const header = request?.headers.get("cookie") || "";
  for (const item of header.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0 || item.slice(0, separator).trim() !== GITHUB_TOKEN_COOKIE_NAME) continue;
    const value = item.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value).trim();
    } catch {
      return "";
    }
  }
  return "";
}

export function readGitHubTokenFromRequest(request) {
  return cookieValue(request);
}

export function setGitHubTokenCookie(token, maxAge = GITHUB_TOKEN_COOKIE_MAX_AGE) {
  return `${GITHUB_TOKEN_COOKIE_NAME}=${encodeURIComponent(token.trim())}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearGitHubTokenCookie() {
  return `${GITHUB_TOKEN_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}
