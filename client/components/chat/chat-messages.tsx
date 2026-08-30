"use client";

import { Bot, UserRound } from "lucide-react";
import { useEffect, useRef } from "react";

import { ChatMarkdown } from "@/components/chat/chat-markdown";
import { CitationChips } from "@/components/chat/citation-chips";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageGroup,
} from "@/components/ui/message";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { ChatMessage, Repository } from "@/lib/api";
import { cn } from "@/lib/utils";

export function ChatMessages({
  repo,
  messages,
  streamText,
  streaming,
  isLoading,
}: {
  repo: Repository;
  messages: ChatMessage[];
  streamText?: string;
  streaming?: boolean;
  isLoading?: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText]);

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-6">
        <Skeleton className="h-16 w-2/3 rounded-3xl" />
        <Skeleton className="ml-auto h-12 w-1/2 rounded-3xl" />
        <Skeleton className="h-24 w-3/4 rounded-3xl" />
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6">
        {messages.length === 0 && !streamText && (
          <div className="rounded-sm border border-border dark:border-white/10 bg-muted/30 dark:bg-[#0f0f0f] px-6 py-10 text-center font-mono">
            <p className="font-medium text-foreground dark:text-neutral-200">System Ready</p>
            <p className="mt-1 text-xs text-muted-foreground/80 dark:text-neutral-500">
              Try executing: "Where is authentication handled?" or "Explain the repository indexing flow."
            </p>
          </div>
        )}

        <MessageGroup>
          {messages.map((message) => {
            const isUser = message.role === "USER";
            return (
              <Message key={message.id} align={isUser ? "end" : "start"}>
                <MessageAvatar>
                  <Avatar className="size-8 rounded-sm border border-border dark:border-white/10">
                    <AvatarFallback
                      className={cn(
                        "rounded-sm font-mono text-xs",
                        isUser
                          ? "bg-primary/10 dark:bg-amber-500/10 text-primary dark:text-amber-500"
                          : "bg-cyan-500/10 text-cyan-500"
                      )}
                    >
                      {isUser ? (
                        <UserRound className="size-4" />
                      ) : (
                        <Bot className="size-4" />
                      )}
                    </AvatarFallback>
                  </Avatar>
                </MessageAvatar>
                <MessageContent>
                  <Bubble
                    variant={isUser ? "default" : "muted"}
                    align={isUser ? "end" : "start"}
                    className={cn(!isUser && "max-w-full", "rounded-none border border-border dark:border-white/10 shadow-none", isUser ? "bg-muted dark:bg-[#1a1a1a] text-foreground dark:text-neutral-200" : "bg-muted/30 dark:bg-[#0f0f0f] text-foreground/90 dark:text-neutral-300")}
                  >
                    <BubbleContent className={cn(!isUser && "w-full max-w-full px-4 py-3", "font-mono text-sm")}>
                      {isUser ? (
                        <span className="whitespace-pre-wrap">
                          {message.content}
                        </span>
                      ) : (
                        <ChatMarkdown content={message.content} />
                      )}
                    </BubbleContent>
                  </Bubble>
                  {!isUser && message.citations?.length > 0 && (
                    <MessageFooter>
                      <CitationChips repo={repo} citations={message.citations} />
                    </MessageFooter>
                  )}
                  </MessageContent>
                </Message>
              );
            })}

            {streaming && !streamText && (
              <Message align="start">
                <MessageAvatar>
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-muted">
                      <Bot className="size-4" />
                    </AvatarFallback>
                  </Avatar>
                </MessageAvatar>
                <MessageContent>
                  <Bubble variant="muted" align="start" className="max-w-full">
                    <BubbleContent className="w-full max-w-full px-4 py-3">
                      <div className="flex items-center gap-1.5 h-5">
                        <span className="size-1.5 animate-bounce rounded-full bg-foreground/50 [animation-delay:-0.3s]" />
                        <span className="size-1.5 animate-bounce rounded-full bg-foreground/50 [animation-delay:-0.15s]" />
                        <span className="size-1.5 animate-bounce rounded-full bg-foreground/50" />
                      </div>
                    </BubbleContent>
                  </Bubble>
                </MessageContent>
              </Message>
            )}

            {streamText && (
            <Message align="start">
              <MessageAvatar>
                <Avatar className="size-8">
                  <AvatarFallback className="bg-muted">
                    <Bot className="size-4" />
                  </AvatarFallback>
                </Avatar>
              </MessageAvatar>
              <MessageContent>
                <Bubble variant="muted" align="start" className="max-w-full">
                  <BubbleContent className="w-full max-w-full px-4 py-3">
                    <ChatMarkdown content={streamText} isStreaming />
                    <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-foreground/50 align-middle" />
                  </BubbleContent>
                </Bubble>
              </MessageContent>
            </Message>
          )}
        </MessageGroup>
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}