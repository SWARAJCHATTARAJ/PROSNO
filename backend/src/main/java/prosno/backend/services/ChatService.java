package prosno.backend.services;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import prosno.backend.dto.ChatMessageResponse;
import prosno.backend.dto.ChatSessionResponse;
import prosno.backend.dto.CreateChatSessionRequest;
import prosno.backend.entity.ChatMessage;
import prosno.backend.entity.ChatSession;
import prosno.backend.entity.IndexStatus;
import prosno.backend.entity.MessageRole;
import prosno.backend.entity.Repository;
import prosno.backend.exceptions.BadRequestException;
import prosno.backend.exceptions.NotFoundException;
import prosno.backend.repository.ChatMessageRepository;
import prosno.backend.repository.ChatSessionRepository;
import prosno.backend.services.ai.ChatPromptBuilder;
import prosno.backend.services.ai.ChatStreamHandler;
import prosno.backend.services.ai.CitationMapper;
import prosno.backend.services.ai.CodeContextRetriever;
import lombok.RequiredArgsConstructor;

import lombok.extern.slf4j.Slf4j;

/**
 * Chat sessions and the RAG chat pipeline entry point.
 *
 * <p>
 * {@link #streamReply} orchestrates the full flow:
 * validate → save user message → retrieve code context → build prompts → stream
 * AI reply.
 * Each step is implemented in a dedicated class under {@code service.ai}.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ChatService {

    private final ChatSessionRepository chatSessionRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final RepoService repoService;
    private final prosno.backend.services.indexing.IndexingService indexingService;
    private final CodeContextRetriever codeContextRetriever;
    private final ChatPromptBuilder chatPromptBuilder;
    private final ChatStreamHandler chatStreamHandler;
    private final CitationMapper citationMapper;

    @Transactional
    public ChatSessionResponse createSession(UUID userId, CreateChatSessionRequest request) {
        Repository repo = repoService.requireOwned(request.repositoryId(), userId);
        if (repo.getIndexStatus() != IndexStatus.READY && repo.getIndexStatus() != IndexStatus.EXPIRED) {
            throw new BadRequestException("Repository must be indexed before chatting");
        }

        String title = request.title() != null && !request.title().isBlank()
                ? request.title()
                : "Chat with " + repo.getFullName();

        ChatSession session = ChatSession.builder()
                .userId(userId)
                .repositoryId(repo.getId())
                .title(title)
                .build();
        session = chatSessionRepository.save(session);
        return toSessionResponse(session);
    }

    @Transactional(readOnly = true)
    public List<ChatSessionResponse> listSessions(UUID userId, UUID repositoryId) {
        repoService.requireOwned(repositoryId, userId);
        return chatSessionRepository
                .findByUserIdAndRepositoryIdOrderByCreatedAtDesc(userId, repositoryId)
                .stream()
                .map(this::toSessionResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ChatMessageResponse> getMessages(UUID userId, UUID sessionId) {
        ChatSession session = requireSession(userId, sessionId);
        return chatMessageRepository.findBySessionIdOrderByCreatedAtAsc(session.getId()).stream()
                .map(this::toMessageResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public ChatSession requireSession(UUID userId, UUID sessionId) {
        return chatSessionRepository.findByIdAndUserId(sessionId, userId)
                .orElseThrow(() -> new NotFoundException("Chat session not found"));
    }

    public SseEmitter streamReply(UUID userId, UUID sessionId, String userContent) {
        // 1. Ensure the session exists and the repo is indexed
        ChatSession session = requireSession(userId, sessionId);
        Repository repo = repoService.requireOwned(session.getRepositoryId(), userId);
        
        // Touch lastAccessedAt to prevent cleanup
        repoService.updateLastAccessedAt(repo.getId());

        if (repo.getIndexStatus() == IndexStatus.EXPIRED) {
            // Trigger soft-wakeup
            String outcome = indexingService.tryStartIndexing(repo.getId(), userId);
            if ("STARTED_INDEXING".equals(outcome)) {
                indexingService.indexAsync(repo.getId(), userId);
            }
            
            SseEmitter emitter = new SseEmitter(1000L * 60 * 10); // 10 minute timeout for wakeup
            new Thread(() -> {
                try {
                    // Poll until READY
                    Repository r = repo;
                    long startTime = System.currentTimeMillis();
                    long maxWaitTime = 2 * 60 * 1000L; // 2 minutes

                    while (r.getIndexStatus() == IndexStatus.INDEXING || r.getIndexStatus() == IndexStatus.EXPIRED || r.getIndexStatus() == IndexStatus.PENDING) {
                        if (System.currentTimeMillis() - startTime > maxWaitTime) {
                            log.error("Repository {} stuck in {} for too long during chat wakeup", r.getFullName(), r.getIndexStatus());
                            sendErrorEventAndComplete(emitter, "Wake up timeout. Please try again or refresh from the dashboard.");
                            return;
                        }
                        try {
                            emitter.send(SseEmitter.event()
                                    .name("status")
                                    .data("{\"type\": \"status\", \"message\": \"Waking up repository...\"}"));
                        } catch (Exception ex) {
                            // Client might have disconnected
                            return;
                        }
                        Thread.sleep(2000);
                        r = repoService.requireOwned(r.getId(), userId);
                    }

                    if (r.getIndexStatus() == IndexStatus.FAILED) {
                        log.error("Failed to index repository {} during chat wakeup: {}", r.getFullName(), r.getErrorMessage());
                        sendErrorEventAndComplete(emitter, "Failed to reload this repository. Please try refreshing it from the dashboard.");
                        return;
                    }

                    if (r.getIndexStatus() != IndexStatus.READY) {
                        log.error("Unexpected index status {} for repository {} during chat wakeup", r.getIndexStatus(), r.getFullName());
                        sendErrorEventAndComplete(emitter, "Failed to wake up repository. Please try indexing manually.");
                        return;
                    }

                    // proceed with RAG now that it's awake
                    proceedWithRag(emitter, session, r, userContent, userId);
                } catch (Exception e) {
                    emitter.completeWithError(e);
                }
            }).start();
            return emitter;
        }

        if (repo.getIndexStatus() != IndexStatus.READY) {
            throw new BadRequestException("Repository is not ready for chat");
        }

        SseEmitter emitter = new SseEmitter(prosno.backend.services.ai.RagSettings.STREAM_TIMEOUT_MS);
        proceedWithRag(emitter, session, repo, userContent, userId);
        return emitter;
    }

    private void proceedWithRag(SseEmitter emitter, ChatSession session, Repository repo, String userContent, UUID userId) {
        // 2. Persist the user's message
        ChatMessage userMessage = chatMessageRepository.save(ChatMessage.builder()
                .sessionId(session.getId())
                .role(MessageRole.USER)
                .content(userContent)
                .build());

        // 3. RAG retrieval — find code chunks similar to the question
        var retrievedContext = codeContextRetriever.retrieve(repo.getId(), userContent);

        // 4. Build LLM prompts from retrieved context + question
        String systemPrompt = chatPromptBuilder.systemPrompt(repo.getFullName());
        String userPrompt = chatPromptBuilder.userPrompt(retrievedContext.contextText(), userContent);

        // 5. Stream OpenAI response to the client (SSE)
        // We bypass chatStreamHandler's return since we already have the emitter
        chatStreamHandler.streamWithExistingEmitter(
                emitter,
                session.getId(),
                toMessageResponse(userMessage),
                retrievedContext.citations(),
                systemPrompt,
                userPrompt);
    }

    private ChatSessionResponse toSessionResponse(ChatSession session) {
        return new ChatSessionResponse(
                session.getId(),
                session.getRepositoryId(),
                session.getTitle(),
                session.getCreatedAt());
    }

    private ChatMessageResponse toMessageResponse(ChatMessage message) {
        return new ChatMessageResponse(
                message.getId(),
                message.getRole(),
                message.getContent(),
                citationMapper.fromJson(message.getCitations()),
                message.getCreatedAt());
    }

    private void sendErrorEventAndComplete(SseEmitter emitter, String message) {
        try {
            // Escape quotes in message if necessary, assuming message doesn't have raw quotes
            emitter.send(SseEmitter.event()
                    .name("error")
                    .data("{\"type\": \"error\", \"message\": \"" + message + "\"}"));
            emitter.complete();
        } catch (Exception ex) {
            emitter.completeWithError(ex);
        }
    }
}