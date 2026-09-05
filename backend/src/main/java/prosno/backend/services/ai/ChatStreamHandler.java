package prosno.backend.services.ai;

import java.util.List;
import java.util.UUID;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import prosno.backend.dto.ChatMessageResponse;
import prosno.backend.dto.CitationDto;
import prosno.backend.entity.ChatMessage;
import prosno.backend.entity.MessageRole;
import prosno.backend.repository.ChatMessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Generation step: call OpenAI via Spring AI and stream tokens to the browser
 * over SSE.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ChatStreamHandler {

    private final ChatModel chatModel;
    private final ChatMessageRepository chatMessageRepository;
    private final CitationMapper citationMapper;

    public SseEmitter stream(
            UUID sessionId,
            ChatMessageResponse savedUserMessage,
            List<CitationDto> citations,
            String systemPrompt,
            String userPrompt) {
        SseEmitter emitter = new SseEmitter(RagSettings.STREAM_TIMEOUT_MS);
        streamWithExistingEmitter(emitter, sessionId, savedUserMessage, citations, systemPrompt, userPrompt);
        return emitter;
    }

    public void streamWithExistingEmitter(
            SseEmitter emitter,
            UUID sessionId,
            ChatMessageResponse savedUserMessage,
            List<CitationDto> citations,
            String systemPrompt,
            String userPrompt) {

        StringBuilder fullReply = new StringBuilder();
        long t0 = System.currentTimeMillis();
        java.util.concurrent.atomic.AtomicLong firstTokenTime = new java.util.concurrent.atomic.AtomicLong(0);

        try {
            log.info("SSE connection opened for session {}", sessionId);
            emitter.onCompletion(() -> log.info("SSE stream completed for session {}", sessionId));
            emitter.onError(err -> log.warn("SSE stream failed for session {}: {}", sessionId, err.getMessage()));
            emitter.onTimeout(() -> log.warn("SSE stream timed out for session {}", sessionId));

            emitter.send(SseEmitter.event()
                    .name("user_message")
                    .data(savedUserMessage));

            ChatClient.builder(chatModel)
                    .build()
                    .prompt()
                    .system(systemPrompt)
                    .user(userPrompt)
                    .stream()
                    .content()
                    .doOnNext(token -> {
                        if (firstTokenTime.compareAndSet(0, System.currentTimeMillis())) {
                            log.info("LLM generation started, first token emitted (ttft: {}ms)", (System.currentTimeMillis() - t0));
                        }
                        appendToken(emitter, fullReply, token);
                    })
                    .doOnError(err -> {
                        if (err.getMessage() != null && err.getMessage().equals("Client disconnected")) {
                            log.info("Chat stream aborted by client disconnect");
                        } else {
                            log.error("Chat stream error", err);
                        }
                        emitter.completeWithError(err);
                    })
                    .doOnComplete(() -> completeStream(
                            emitter, sessionId, fullReply, citations, t0, firstTokenTime.get()))
                    .subscribe();
        } catch (Exception ex) {
            emitter.completeWithError(ex);
        }
    }

    private void appendToken(SseEmitter emitter, StringBuilder fullReply, String token) {
        if (token == null) {
            return;
        }
        fullReply.append(token);
        try {
            emitter.send(SseEmitter.event()
                    .name("token")
                    .data(token));
        } catch (Exception ex) {
            throw new RuntimeException("Client disconnected", ex);
        }
    }

    private void completeStream(
            SseEmitter emitter,
            UUID sessionId,
            StringBuilder fullReply,
            List<CitationDto> citations,
            long t0,
            long firstTokenTime) {
        try {
            ChatMessage assistant = chatMessageRepository.save(ChatMessage.builder()
                    .sessionId(sessionId)
                    .role(MessageRole.ASSISTANT)
                    .content(fullReply.toString())
                    .citations(citationMapper.toJson(citations))
                    .build());

            emitter.send(SseEmitter.event()
                    .name("assistant_message")
                    .data(toMessageResponse(assistant)));
            emitter.send(SseEmitter.event().name("done").data("[DONE]"));
            emitter.complete();
            long totalTime = System.currentTimeMillis() - t0;
            log.info("LLM generation completed - totalTime: {}ms, replyLength: {}", totalTime, fullReply.length());
        } catch (Exception ex) {
            emitter.completeWithError(ex);
        }
    }

    private ChatMessageResponse toMessageResponse(ChatMessage message) {
        return new ChatMessageResponse(
                message.getId(),
                message.getRole(),
                message.getContent(),
                citationMapper.fromJson(message.getCitations()),
                message.getCreatedAt());
    }
}