/**
 * Package READMEs sometimes contain sample keys and tokens (a PEM key in a crypto
 * package's example, a Mapbox token in a maps demo). The AI can copy those into
 * summaries, and GitHub's secret scanning then flags our data files. They're never
 * our secrets, but we don't want to republish them either, so mask anything key-shaped.
 */
const PATTERNS = [
  // PEM blocks: keep the header/footer so the example still reads right, drop the body.
  [/(-----BEGIN [A-Z0-9 ]*(?:PRIVATE KEY|CERTIFICATE|PUBLIC KEY)[A-Z ]*-----)[\s\S]*?(-----END [A-Z0-9 ]*-----)/g, "$1\n<key data>\n$2"],
  [/AIza[0-9A-Za-z_-]{35}/g, "<api-key>"],                         // Google / Firebase
  [/\bAQ\.[A-Za-z0-9_-]{30,}/g, "<api-key>"],                        // Gemini (new format)
  [/\bgsk_[A-Za-z0-9]{20,}/g, "<api-key>"],                          // Groq
  [/\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}/g, "<api-key>"],          // OpenAI / Anthropic
  [/\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{10,}/g, "<api-key>"],   // Stripe
  [/\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}/g, "<token>"],
  [/\b(?:pk|sk)\.eyJ[A-Za-z0-9._-]{20,}/g, "<mapbox-token>"],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}/g, "<token>"],                    // Slack
  [/hooks\.slack\.com\/services\/[A-Za-z0-9/]+/g, "hooks.slack.com/services/<webhook>"],
  [/\bAKIA[0-9A-Z]{16}\b/g, "<aws-key>"],
  [/\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/g, "<api-key>"],     // SendGrid
  [/\beyJhbGciOi[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, "<jwt>"],
];

export function scrubText(s) {
  let out = s;
  for (const [re, rep] of PATTERNS) out = out.replace(re, rep);
  return out;
}

/** Deep-copy `value`, masking secrets in every string. */
export function scrub(value) {
  if (typeof value === "string") return scrubText(value);
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, scrub(v)]));
  return value;
}
