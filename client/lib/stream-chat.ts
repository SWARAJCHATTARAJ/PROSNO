import { getApiBaseUrl, ApiError, getCsrfToken, type ChatMessage } from "@/lib/api";

export type StreamChatHandlers = {
  onUserMessage?: (message: ChatMessage) => void;
  onToken?: (token: string) => void;
  onStatus?: (message: string) => void;
  onAssistantMessage?: (message: ChatMessage) => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
  signal?: AbortSignal;
};

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

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      if (!part.trim()) continue;

      const lines = part.split("\n");
      let event = "message";
      const dataLines: string[] = [];

      for (const line of lines) {
        if (line.startsWith("event:")) {
          event = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          const dataStr = line.slice(5);
          dataLines.push(dataStr.startsWith(" ") ? dataStr.slice(1) : dataStr);
        }
      }

      const data = dataLines.join("\n");
      if (!data) continue;

      try {
        if (event === "token") {
          handlers.onToken?.(JSON.parse(data) as string);
        } else if (event === "status") {
          handlers.onStatus?.((JSON.parse(data) as { message: string }).message);
        } else if (event === "user_message") {
          handlers.onUserMessage?.(JSON.parse(data) as ChatMessage);
        } else if (event === "assistant_message") {
          handlers.onAssistantMessage?.(JSON.parse(data) as ChatMessage);
        } else if (event === "error") {
          const errorMsg = (JSON.parse(data) as { message?: string }).message || "An error occurred";
          throw new Error(errorMsg); // This will be caught locally
        } else if (event === "done") {
          // handled below
        }
      } catch (err) {
        handlers.onError?.(
          err instanceof Error ? err : new Error("Failed to parse SSE event")
        );
        throw err; // Re-throw to break the loop and fail the stream
      }
    }
  }

  handlers.onDone?.();
}