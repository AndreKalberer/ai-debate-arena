/**
 * Strips characters that could break out of XML-style delimiters and enforces
 * a length cap. Used to reduce prompt injection surface for user-supplied topics.
 */
export function sanitizeTopic(topic: string): string {
  return topic
    .slice(0, 500)
    .replace(/[<>]/g, "")
    .trim();
}
