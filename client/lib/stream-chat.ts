import { getApiBaseUrl, ApiError, getCsrfToken, type ChatMessage, type Citation } from "@/lib/api";

export type StreamChatHandlers = {
  onUserMessage?: (message: ChatMessage) => void;
  onToken?: (token: string) => void;
  onStatus?: (message: string) => void;
  onAssistantMessage?: (message: ChatMessage) => void;
  onCitations?: (citations: Citation[]) => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
  signal?: AbortSignal;
};

/**
 * Safely parse an incoming token payload.
 *
 * Plain Markdown (such as "**hello**", normal text, quotes, code, etc.)
 * is preserved exactly as message content without running JSON.parse.
 *
 * If the token happens to be wrapped in a JSON object (e.g. {"token": "..."}),
 * or an explicitly JSON-encoded string from a mock/proxy (e.g. "\"hello\\n\""),
 * it extracts the content safely without crashing on non-JSON content.
 */
export function parseTokenData(data: string): string {
  if (!data || data === "[DONE]" || data.trim() === "[DONE]") {
    return "";
  }

  // If data is wrapped in a JSON object (e.g. OpenAI/proxy wrapper format)
  if (data.startsWith("{") && data.endsWith("}")) {
    try {
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === "object") {
        if (typeof parsed.token === "string") return parsed.token;
        if (typeof parsed.content === "string") return parsed.content;
        if (typeof parsed.text === "string") return parsed.text;
        if (typeof parsed.delta?.content === "string") return parsed.delta.content;
      }
    } catch {
      // If it's a code block containing JSON text or malformed JSON, preserve as raw text
      return data;
    }
  }

  // If data is an explicitly JSON-escaped string (e.g. from tests or proxies that stringify tokens)
  if (data.startsWith('"') && data.endsWith('"') && data.length >= 2) {
    try {
      const parsed = JSON.parse(data);
      if (typeof parsed === "string") {
        return parsed;
      }
    } catch {
      // Unmatched or raw quotes in Markdown/code; preserve as raw text
      return data;
    }
  }

  // Plain Markdown or text (e.g. **hello**, normal text, quotes, code, newlines)
  return data;
}

export async function streamChatMessage(
  sessionId: string,
  content: string,
  handlers: StreamChatHandlers = {}
): Promise<void> {
  const csrfToken = getCsrfToken();
  const res = await fetch(
    `${getApiBaseUrl()}/api/chat/sessions/${sessionId}/messages`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken ? { "X-XSRF-TOKEN": csrfToken } : {}),
      },
      body: JSON.stringify({ content }),
      signal: handlers.signal,
    }
  );

  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = await res.json();
      message = data.message ?? data.error ?? message;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, message);
  }

  if (!res.body) {
    throw new Error("No response body for SSE stream");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let doneCalled = false;

  const signalDone = () => {
    if (!doneCalled) {
      doneCalled = true;
      handlers.onDone?.();
    }
  };

  const processEventBlock = (part: string) => {
    if (!part.trim()) return;

    const lines = part.split(/\r?\n/);
    let event = "message";
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith("event:")) {
        event = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        const dataStr = line.slice(5);
        dataLines.push(dataStr.startsWith(" ") ? dataStr.slice(1) : dataStr);
      } else if (line === "data") {
        dataLines.push("");
      } else if (line.startsWith("id:") || line.startsWith("retry:") || line.startsWith(":")) {
        // SSE control / comment fields
      } else if (dataLines.length > 0) {
        // Line continuation for non-standard multi-line data
        dataLines.push(line);
      }
    }

    if (dataLines.length === 0) return;

    const data = dataLines.join("\n");

    // Check for completion marker [DONE]
    if (event === "done" || data.trim() === "[DONE]") {
      signalDone();
      return;
    }

    try {
      if (event === "token" || event === "message") {
        const token = parseTokenData(data);
        if (token) {
          handlers.onToken?.(token);
        }
      } else if (event === "status") {
        let statusText = data;
        try {
          const parsed = JSON.parse(data);
          if (typeof parsed === "string") {
            statusText = parsed;
          } else if (
            parsed &&
            typeof parsed === "object" &&
            typeof parsed.message === "string"
          ) {
            statusText = parsed.message;
          }
        } catch {
          // If not JSON, use data directly as plain text status message
        }
        handlers.onStatus?.(statusText);
      } else if (event === "user_message") {
        try {
          const msg = JSON.parse(data) as ChatMessage;
          if (msg && typeof msg === "object" && msg.id) {
            handlers.onUserMessage?.(msg);
          }
        } catch (err) {
          console.warn("Failed to parse user_message SSE event:", data, err);
        }
      } else if (event === "assistant_message") {
        try {
          const msg = JSON.parse(data) as ChatMessage;
          if (msg && typeof msg === "object" && msg.id) {
            handlers.onAssistantMessage?.(msg);
          }
        } catch (err) {
          console.warn("Failed to parse assistant_message SSE event:", data, err);
        }
      } else if (event === "citation" || event === "citations") {
        try {
          const parsed = JSON.parse(data);
          const citations: Citation[] = Array.isArray(parsed)
            ? parsed
            : parsed && typeof parsed === "object" && Array.isArray(parsed.citations)
            ? parsed.citations
            : parsed && typeof parsed === "object" && parsed.filePath
            ? [parsed]
            : [];
          if (citations.length > 0) {
            handlers.onCitations?.(citations);
          }
        } catch (err) {
          console.warn("Failed to parse citation SSE event:", data, err);
        }
      } else if (event === "error") {
        let errorMsg = "An error occurred";
        try {
          const parsed = JSON.parse(data);
          if (typeof parsed === "string") {
            errorMsg = parsed;
          } else if (parsed && typeof parsed === "object") {
            errorMsg = parsed.message || parsed.error || errorMsg;
          }
        } catch {
          if (data.trim()) {
            errorMsg = data.trim();
          }
        }
        const error = new Error(errorMsg);
        handlers.onError?.(error);
        throw error;
      }
    } catch (err) {
      if (event === "error") {
        throw err;
      }
      // Non-error events do not crash the stream if malformed
      console.warn(`Error handling SSE event "${event}":`, err);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const normalized = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const parts = normalized.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      processEventBlock(part);
    }
  }

  if (buffer.trim()) {
    processEventBlock(buffer);
  }

  signalDone();
}