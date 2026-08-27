export class RequestBodyTooLargeError extends Error {}

export async function readJsonRequestBody(
  request: Request,
  maximumBytes: number,
): Promise<{ body: unknown; byteLength: number }> {
  if (!request.body) return { body: JSON.parse(""), byteLength: 0 };

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let byteLength = 0;
  let rawBody = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > maximumBytes) {
        await reader.cancel();
        throw new RequestBodyTooLargeError();
      }
      rawBody += decoder.decode(value, { stream: true });
    }
    rawBody += decoder.decode();
  } finally {
    reader.releaseLock();
  }

  return { body: JSON.parse(rawBody), byteLength };
}
