import { test, expect } from '@playwright/test';
import { parseTokenData, streamChatMessage } from '../lib/stream-chat';
import type { ChatMessage, Citation } from '../lib/api';

test.describe('Chat Stream Parsing Regression Tests', () => {

  // 1. token = "**hello**"
  test('1. parses token = "**hello**" without throwing JSON syntax error', () => {
    const result = parseTokenData('**hello**');
    expect(result).toBe('**hello**');
  });

  // 2. token = "normal text"
  test('2. parses token = "normal text"', () => {
    const result = parseTokenData('normal text');
    expect(result).toBe('normal text');
  });

  // 3. token containing quotes
  test('3. parses token containing quotes and preserves quotes', () => {
    expect(parseTokenData('He said "hello"')).toBe('He said "hello"');
    expect(parseTokenData("It's a 'quoted' string")).toBe("It's a 'quoted' string");
    expect(parseTokenData('"')).toBe('"');
    expect(parseTokenData('code with "quotes"')).toBe('code with "quotes"');
  });

  // 4. token containing newline
  test('4. parses token containing newline without dropping line breaks', () => {
    expect(parseTokenData('\n')).toBe('\n');
    expect(parseTokenData('line 1\nline 2')).toBe('line 1\nline 2');
    expect(parseTokenData('\n\n')).toBe('\n\n');
  });

  // 5. token containing JSON-looking text
  test('5. parses token containing JSON-looking text as string, not object', () => {
    expect(parseTokenData('{"key": "value"}')).toBe('{"key": "value"}');
    expect(parseTokenData('{"status": 200, "ok": true}')).toBe('{"status": 200, "ok": true}');
    expect(parseTokenData('{"incomplete":')).toBe('{"incomplete":');
    expect(parseTokenData('[1, 2, 3]')).toBe('[1, 2, 3]');
  });

  // Helper to create a mock ReadableStream from SSE string
  function createSseStream(sseContent: string): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(sseContent));
        controller.close();
      },
    });
  }

  // 6. JSON metadata event
  test('6. handles JSON metadata events (user_message, assistant_message, status)', async () => {
    const userMsg: ChatMessage = {
      id: 'usr-1',
      role: 'USER',
      content: 'hello',
      citations: [],
      createdAt: '2026-09-05T00:00:00Z',
    };
    const assistantMsg: ChatMessage = {
      id: 'ast-1',
      role: 'ASSISTANT',
      content: '**hello** from assistant',
      citations: [],
      createdAt: '2026-09-05T00:00:01Z',
    };

    const sse = [
      'event: user_message\ndata: ' + JSON.stringify(userMsg) + '\n\n',
      'event: status\ndata: {"type":"status","message":"Searching codebase..."}\n\n',
      'event: token\ndata: **hello**\n\n',
      'event: assistant_message\ndata: ' + JSON.stringify(assistantMsg) + '\n\n',
      'event: done\ndata: [DONE]\n\n',
    ].join('');

    let receivedUserMsg: ChatMessage | null = null;
    let receivedAssistantMsg: ChatMessage | null = null;
    let receivedStatus: string | null = null;
    let receivedToken = '';
    let doneCalled = false;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      body: createSseStream(sse),
    } as unknown as Response);

    try {
      await streamChatMessage('session-1', 'hello', {
        onUserMessage: (m) => { receivedUserMsg = m; },
        onAssistantMessage: (m) => { receivedAssistantMsg = m; },
        onStatus: (s) => { receivedStatus = s; },
        onToken: (t) => { receivedToken += t; },
        onDone: () => { doneCalled = true; },
      });

      expect(receivedUserMsg).toEqual(userMsg);
      expect(receivedAssistantMsg).toEqual(assistantMsg);
      expect(receivedStatus).toBe('Searching codebase...');
      expect(receivedToken).toBe('**hello**');
      expect(doneCalled).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // 7. malformed event
  test('7. malformed event does not crash the stream', async () => {
    const sse = [
      'event: unknown_event\ndata: {this is broken json\n\n',
      'event: user_message\ndata: not-valid-json\n\n',
      'event: status\ndata: Plain text status update\n\n',
      'event: token\ndata: **resilient**\n\n',
      'event: done\ndata: [DONE]\n\n',
    ].join('');

    let tokens = '';
    let status = '';
    let done = false;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      body: createSseStream(sse),
    } as unknown as Response);

    try {
      await streamChatMessage('session-1', 'hello', {
        onToken: (t) => { tokens += t; },
        onStatus: (s) => { status = s; },
        onDone: () => { done = true; },
      });

      expect(status).toBe('Plain text status update');
      expect(tokens).toBe('**resilient**');
      expect(done).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // 8. [DONE]
  test('8. handles [DONE] completion marker cleanly without emitting as token', async () => {
    const sse = [
      'event: token\ndata: Hello\n\n',
      'data: [DONE]\n\n',
    ].join('');

    let tokens = '';
    let doneCalled = false;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      body: createSseStream(sse),
    } as unknown as Response);

    try {
      await streamChatMessage('session-1', 'hello', {
        onToken: (t) => { tokens += t; },
        onDone: () => { doneCalled = true; },
      });

      expect(tokens).toBe('Hello');
      expect(doneCalled).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // 9. citation event
  test('9. handles citation events as separate events and extracts citations', async () => {
    const mockCitations: Citation[] = [
      { filePath: 'src/main/java/App.java', startLine: 10, endLine: 25, language: 'java' },
      { filePath: 'README.md', startLine: 1, endLine: 5, language: 'markdown' },
    ];

    const sse = [
      'event: token\ndata: Here is the code\n\n',
      'event: citation\ndata: ' + JSON.stringify(mockCitations) + '\n\n',
      'event: done\ndata: [DONE]\n\n',
    ].join('');

    let receivedCitations: Citation[] = [];
    let tokens = '';

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      body: createSseStream(sse),
    } as unknown as Response);

    try {
      await streamChatMessage('session-1', 'hello', {
        onToken: (t) => { tokens += t; },
        onCitations: (c) => { receivedCitations = c; },
      });

      expect(tokens).toBe('Here is the code');
      expect(receivedCitations).toEqual(mockCitations);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // 10. mixed Markdown + citations
  test('10. handles mixed Markdown + code blocks + citations incrementally', async () => {
    const mockCitation: Citation = { filePath: 'src/auth.ts', startLine: 40, endLine: 50, language: 'typescript' };
    const assistantMsg: ChatMessage = {
      id: 'ast-final',
      role: 'ASSISTANT',
      content: '**Key Points:**\n- Item 1\n- Item 2\n\n```ts\nconst x = 42;\n```',
      citations: [mockCitation],
      createdAt: '2026-09-05T00:00:02Z',
    };

    const chunks = [
      'event: token\ndata: **Key\n\n',
      'event: token\ndata:  Points:**\n\n',
      'event: token\ndata:\ndata:- Item 1\ndata:- Item 2\ndata:\ndata:\n\n',
      'event: token\ndata:```ts\ndata:const x = 42;\ndata:```\n\n',
      'event: assistant_message\ndata: ' + JSON.stringify(assistantMsg) + '\n\n',
      'event: done\ndata: [DONE]\n\n',
    ];

    const streamTokens: string[] = [];
    let finalMsg: ChatMessage | null = null;
    let done = false;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      body: createSseStream(chunks.join('')),
    } as unknown as Response);

    try {
      await streamChatMessage('session-1', 'hello', {
        onToken: (t) => { streamTokens.push(t); },
        onAssistantMessage: (m) => { finalMsg = m; },
        onDone: () => { done = true; },
      });

      // Verify streaming was incremental
      expect(streamTokens.length).toBe(4);
      expect(streamTokens.join('')).toBe(assistantMsg.content);
      expect(finalMsg).toEqual(assistantMsg);
      expect(finalMsg ? (finalMsg as ChatMessage).citations : []).toEqual([mockCitation]);
      expect(done).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});