"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  CircleStop,
  Headset,
  History,
  MessageCircle,
  Plus,
  Send,
  Star,
  X,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input, Textarea } from "@/components/ui/form-controls";
import { avatarFrameClassName } from "@/components/user-avatar";
import { useAuth } from "@/features/auth/auth-provider";
import {
  createChatRequest,
  createGuestSupportChatRequest,
  createSupportChatRequest,
  endChatRequest,
  endGuestChatRequest,
  getGuestChatRequest,
  guestChatRequest,
  listChatsRequest,
  rateChatRequest,
  sendGuestMessageRequest,
  sendChatMessageRequest,
  type AssistantChatTurnResult,
  type ChatHistoryItem,
} from "@/features/chat/api";
import { ChatMessageBubble } from "@/features/chat/chat-message-bubble";
import { ChatIconButton } from "@/features/chat/chat-icon-button";
import { DateGroupedMessageList } from "@/features/chat/date-grouped-message-list";
import { getErrorMessage } from "@/lib/api-error";
import {
  getAssistantAgentLabel,
  getLocalizedSupportSystemMessage,
  isInternalSupportTransferMessage,
} from "@/lib/domain-labels";
import type { ChatMessage, SupportChat } from "@/lib/types";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/providers/preferences-provider";

const copy = {
  en: {
    title: "AI Assistant",
    subtitle: "AI guidance with live support available",
    guestSubtitle: "General website guidance",
    open: "Open assistant",
    close: "Close assistant",
    newChat: "New chat",
    history: "Chat history",
    welcome: "Hello! I'm the AI Assistant. How can I help you today?",
    placeholder: "Write a message…",
    staffPlaceholder: "Ask a question or use /ban, /unban, /user…",
    send: "Send",
    waiting: "Waiting for support",
    active: (name: string) => `${name} is helping you`,
    ended: "This chat has ended.",
    end: "End chat",
    endTitle: "End this chat?",
    endDescription:
      "You can start a new chat afterwards, but this conversation will be closed.",
    liveChat: "Continue with live support",
    rate: "Rate this chat",
    reason: "What went well or badly?",
    submitRating: "Submit rating",
    rated: "Thanks for your feedback.",
    escalationDone: "The conversation was sent to support.",
    endedDone: "The chat was ended.",
    assistant: "AI Assistant",
    openStatus: "Support queue",
    activeStatus: "Human support",
    endedStatus: "Ended",
  },
  de: {
    title: "AI Assistant",
    subtitle: "KI-Hilfe mit verfügbarem Live-Support",
    guestSubtitle: "Allgemeine Website-Hilfe",
    open: "Assistent öffnen",
    close: "Assistent schließen",
    newChat: "Neuer Chat",
    history: "Chatverlauf",
    welcome: "Hallo! Ich bin der AI Assistant. Wie kann ich dir heute helfen?",
    placeholder: "Nachricht schreiben…",
    staffPlaceholder: "Frage stellen oder /ban, /unban, /user verwenden…",
    send: "Senden",
    waiting: "Wartet auf Support",
    active: (name: string) => `${name} hilft dir`,
    ended: "Dieser Chat ist beendet.",
    end: "Chat beenden",
    endTitle: "Diesen Chat beenden?",
    endDescription:
      "Danach kannst du einen neuen Chat starten, diese Unterhaltung wird jedoch geschlossen.",
    liveChat: "Mit Live-Support fortfahren",
    rate: "Chat bewerten",
    reason: "Was war gut oder schlecht?",
    submitRating: "Bewertung senden",
    rated: "Danke für dein Feedback.",
    escalationDone: "Die Unterhaltung wurde an den Support gesendet.",
    endedDone: "Der Chat wurde beendet.",
    assistant: "AI Assistant",
    openStatus: "Support-Warteschlange",
    activeStatus: "Menschlicher Support",
    endedStatus: "Beendet",
  },
} as const;

const statusLabel = (
  chat: SupportChat,
  t: (typeof copy)["en"] | (typeof copy)["de"],
): string => {
  if (chat.status === "assistant") return t.assistant;
  if (chat.status === "open") return t.openStatus;
  if (chat.status === "active") return t.activeStatus;
  return t.endedStatus;
};

export function ChatWidget() {
  const pathname = usePathname();
  const isDedicatedChatWorkspace = [
    "/assistant",
    "/admin/support",
    "/admin/contact",
  ].some((route) => pathname === route || pathname.startsWith(`${route}/`));
  const { locale, intlLocale } = usePreferences();
  const t = copy[locale];
  const { status, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [pendingUserMessage, setPendingUserMessage] = useState<{
    content: string;
    createdAt: string;
    previousMatchingMessages: number;
  } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [guestChat, setGuestChat] = useState<SupportChat | null>(null);
  const [draftMessages, setDraftMessages] = useState<ChatMessage[]>([]);
  const [supportOffer, setSupportOffer] = useState<
    AssistantChatTurnResult["support"] | null
  >(null);
  const firstNameOnly = (name: string | null | undefined) =>
    name?.trim().split(/\s+/)[0] ?? "";
  const formatMessageDate = (value: string) =>
    new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium" }).format(new Date(value));
  const [endIntent, setEndIntent] = useState<"end" | null>(null);
  const [rating, setRating] = useState(5);
  const [ratingReason, setRatingReason] = useState("");
  const [welcomeCreatedAt, setWelcomeCreatedAt] = useState(() =>
    new Date().toISOString(),
  );
  const endRef = useRef<HTMLDivElement>(null);

  const chatsQuery = useQuery({
    queryKey: ["chat", "own"],
    queryFn: listChatsRequest,
    enabled: status === "authenticated",
    refetchInterval: (query) =>
      query.state.data?.some((chat) => chat.status !== "ended") ? 4_000 : false,
  });
  const chats = useMemo(() => chatsQuery.data ?? [], [chatsQuery.data]);
  const selectedChat = chats.find((chat) => chat.id === selectedId) ?? null;

  const guestPollQuery = useQuery({
    queryKey: ["chat", "guest", guestChat?.id],
    queryFn: () => getGuestChatRequest(guestChat!.id),
    enabled:
      status !== "authenticated" &&
      Boolean(guestChat?.id) &&
      guestChat?.status !== "ended",
    refetchInterval: 4_000,
  });

  const activeChat =
    status === "authenticated" ? selectedChat : (guestPollQuery.data ?? guestChat);
  const transcriptHistory: ChatHistoryItem[] = draftMessages
    .filter(
      (item) =>
        (item.sender === "user" || item.sender === "ai") &&
        item.content.trim().length > 0,
    )
    .slice(-40)
    .map((item) => ({
      role: item.sender === "user" ? "user" : "assistant",
      content: item.content,
    }));
  const assistantHistory = transcriptHistory.slice(-20);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChat?.messages.length, draftMessages.length, open, pendingUserMessage]);

  const updateChatCache = (chat: SupportChat) => {
    queryClient.setQueryData<SupportChat[]>(["chat", "own"], (current = []) => [
      chat,
      ...current.filter((item) => item.id !== chat.id),
    ]);
    setSelectedId(chat.id);
  };

  const updateGuestChat = (chat: SupportChat) => {
    queryClient.setQueryData<SupportChat>(["chat", "guest", chat.id], chat);
    setGuestChat(chat);
  };

  const sendMutation = useMutation<
    | {
        kind: "assistant";
        result: AssistantChatTurnResult;
        userMessage: ChatMessage;
      }
    | { kind: "support"; chat: SupportChat },
    Error,
    { message: string; createdAt: string }
  >({
    mutationFn: async ({ message, createdAt }) => {
      if (activeChat?.status === "open" || activeChat?.status === "active") {
        const chat =
          activeChat.origin === "guest"
            ? await sendGuestMessageRequest(activeChat.id, message)
            : (await sendChatMessageRequest(activeChat.id, message, locale)).chat;
        return { kind: "support" as const, chat };
      }
      const result =
        status !== "authenticated"
          ? await guestChatRequest(message, locale, assistantHistory)
          : await createChatRequest(message, locale, assistantHistory);
      return {
        kind: "assistant" as const,
        result,
        userMessage: {
          id: `local-user-${createdAt}`,
          sender: "user" as const,
          senderId: null,
          senderName: null,
          content: message,
          createdAt,
        },
      };
    },
    onSuccess: (payload) => {
      setPendingUserMessage(null);
      if (payload.kind === "support") {
        if (payload.chat.origin === "guest") updateGuestChat(payload.chat);
        else updateChatCache(payload.chat);
        return;
      }
      setDraftMessages((current) => [
        ...current,
        payload.userMessage,
        ...(payload.result.message.content.trim() ? [payload.result.message] : []),
      ]);
      setSupportOffer(payload.result.support.available ? payload.result.support : null);
    },
    onError: (error, { message }) => {
      setPendingUserMessage(null);
      setInput((current) => current || message);
      toast.error(getErrorMessage(error, locale));
    },
  });

  const transferMutation = useMutation({
    mutationFn: async () => {
      const reason = supportOffer?.reason ?? "human_requested";
      if (status !== "authenticated") {
        return {
          kind: "guest" as const,
          chat: await createGuestSupportChatRequest(transcriptHistory, locale, reason),
        };
      }
      return {
        kind: "authenticated" as const,
        chat: await createSupportChatRequest(transcriptHistory, locale, reason),
      };
    },
    onSuccess: ({ chat, kind }) => {
      if (kind === "guest") updateGuestChat(chat);
      else updateChatCache(chat);
      setDraftMessages([]);
      setSupportOffer(null);
      toast.success(t.escalationDone);
    },
    onError: (error) => toast.error(getErrorMessage(error, locale)),
  });

  const endMutation = useMutation({
    mutationFn: async (chat: SupportChat) =>
      chat.origin === "guest" ? endGuestChatRequest(chat.id) : endChatRequest(chat.id),
    onSuccess: ({ chat, deleted }) => {
      if (deleted) {
        if (chat.origin === "guest") {
          queryClient.removeQueries({
            queryKey: ["chat", "guest", chat.id],
            exact: true,
          });
          setGuestChat(null);
        } else {
          queryClient.setQueryData<SupportChat[]>(["chat", "own"], (current = []) =>
            current.filter((item) => item.id !== chat.id),
          );
          setSelectedId(null);
        }
      } else {
        if (chat.origin === "guest") updateGuestChat(chat);
        else updateChatCache(chat);
      }
      setInput("");
      setPendingUserMessage(null);
      setEndIntent(null);
      toast.success(t.endedDone);
    },
    onError: (error) => toast.error(getErrorMessage(error, locale)),
  });

  const rateMutation = useMutation({
    mutationFn: ({ id, score, reason }: { id: string; score: number; reason: string }) =>
      rateChatRequest(id, score, reason),
    onSuccess: (chat) => {
      updateChatCache(chat);
      setRatingReason("");
      toast.success(t.rated);
    },
    onError: (error) => toast.error(getErrorMessage(error, locale)),
  });

  const submitMessage = () => {
    const message = input.trim();
    if (!message || disabledInput || sendMutation.isPending) return;
    const createdAt = new Date().toISOString();
    setPendingUserMessage({
      content: message,
      createdAt,
      previousMatchingMessages: messages.filter(
        (item) => item.sender === "user" && item.content === message,
      ).length,
    });
    setInput("");
    sendMutation.mutate({ message, createdAt });
  };

  const messages = activeChat?.messages ?? draftMessages;
  const visibleMessages = messages.filter(
    (message) =>
      message.sender !== "system" || !isInternalSupportTransferMessage(message.content),
  );
  const pendingMessagePersisted =
    pendingUserMessage !== null &&
    messages.filter(
      (message) =>
        message.sender === "user" && message.content === pendingUserMessage.content,
    ).length > pendingUserMessage.previousMatchingMessages;
  const displayMessages: ChatMessage[] = [
    ...(activeChat
      ? visibleMessages
      : [
          {
            id: "chat-welcome-message",
            sender: "ai" as const,
            senderId: null,
            senderName: t.assistant,
            content: t.welcome,
            createdAt: welcomeCreatedAt,
          },
          ...visibleMessages,
        ]),
    ...(pendingUserMessage && !pendingMessagePersisted
      ? [
          {
            id: "pending-user-message",
            sender: "user" as const,
            senderId: null,
            senderName: null,
            content: pendingUserMessage.content,
            createdAt: pendingUserMessage.createdAt,
          },
        ]
      : []),
  ];
  const disabledInput = activeChat?.status === "ended";
  const canEnd = activeChat?.status === "active";
  const hasMobileNavigation = [
    "/dashboard",
    "/tasks",
    "/assistant",
    "/account",
    "/admin",
  ].some((route) => pathname === route || pathname.startsWith(`${route}/`));
  const clearForNewChat = () => {
    if (status === "authenticated") setSelectedId(null);
    else setGuestChat(null);
    setDraftMessages([]);
    setSupportOffer(null);
    setWelcomeCreatedAt(new Date().toISOString());
    setInput("");
    setPendingUserMessage(null);
  };

  const requestNewChat = () => clearForNewChat();

  return (
    <>
      {!isDedicatedChatWorkspace && !open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t.open}
          title={t.open}
          className={cn(
            "chat-launcher focus-ring fixed z-40 grid size-12 place-items-center rounded-full border border-[color-mix(in_srgb,var(--foreground)_6%,transparent)] bg-[color-mix(in_srgb,var(--surface)_84%,transparent)] text-[var(--foreground)]/65 shadow-[0_12px_34px_rgb(26_20_65_/_0.1)] backdrop-blur-xl transition-[background-color,color,border-color,box-shadow] duration-200 hover:border-[color-mix(in_srgb,var(--primary)_28%,transparent)] hover:bg-[var(--surface)] hover:text-[var(--primary)]",
            hasMobileNavigation && "chat-launcher-above-nav",
          )}
        >
          <MessageCircle className="size-5" />
        </button>
      )}

      {!isDedicatedChatWorkspace && open && (
        <section className="chat-panel chat-workspace surface-shadow fixed z-40 flex min-h-0 flex-col overflow-hidden rounded-[var(--container-radius)]">
          <header className="chat-section-header flex h-16 shrink-0 items-center gap-3 px-3 text-[var(--foreground)]">
            <span
              className={avatarFrameClassName("text-[var(--primary)]")}
              aria-label={t.title}
            >
              <Bot className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-semibold">{t.title}</h2>
              <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                {activeChat?.status === "active" && activeChat.assignedToName
                  ? t.active(firstNameOnly(activeChat.assignedToName))
                  : activeChat?.status === "open"
                    ? t.waiting
                    : status === "anonymous"
                      ? t.guestSubtitle
                      : t.subtitle}
              </p>
            </div>
            <button
              type="button"
              className="focus-ring grid size-10 shrink-0 place-items-center rounded-full border bg-[var(--surface)] text-[var(--foreground)] transition-colors hover:border-[var(--primary)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary)]"
              onClick={() => setOpen(false)}
              aria-label={t.close}
              title={t.close}
            >
              <X className="size-4" />
            </button>
          </header>

          {status === "authenticated" && (
            <div className="flex shrink-0 items-center gap-2 border-b bg-[var(--surface-muted)] p-2">
              <History className="ml-1 size-4 text-[var(--muted)]" />
              <select
                value={selectedId ?? ""}
                onChange={(event) => {
                  const nextId = event.target.value;
                  if (!nextId) requestNewChat();
                  else setSelectedId(nextId);
                }}
                aria-label={t.history}
                className="focus-ring min-w-0 flex-1 rounded-xl border bg-[var(--surface)] px-2 py-2 text-xs font-bold"
              >
                <option value="">{t.newChat}</option>
                {chats.map((chat) => (
                  <option key={chat.id} value={chat.id}>
                    {chat.subject.slice(0, 34)} · {statusLabel(chat, t)}
                  </option>
                ))}
              </select>
              <ChatIconButton
                bare
                onClick={requestNewChat}
                aria-label={t.newChat}
                title={t.newChat}
              >
                <Plus className="size-4" />
              </ChatIconButton>
            </div>
          )}
          {status !== "authenticated" && (
            <div className="flex shrink-0 justify-end border-b bg-[var(--surface-muted)] p-2">
              <ChatIconButton
                bare
                onClick={requestNewChat}
                aria-label={t.newChat}
                title={t.newChat}
              >
                <Plus className="size-4" />
              </ChatIconButton>
            </div>
          )}

          <div className="chat-message-stream flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 pb-4">
            <DateGroupedMessageList
              items={displayMessages}
              formatDate={formatMessageDate}
              renderItem={(message) => (
                <ChatMessageBubble
                  direction={
                    message.sender === "user"
                      ? "outgoing"
                      : message.sender === "system"
                        ? "system"
                        : "incoming"
                  }
                  content={
                    message.sender === "system"
                      ? getLocalizedSupportSystemMessage(message.content, locale)
                      : message.content
                  }
                  markdown={message.sender === "ai"}
                  createdAt={message.createdAt}
                  name={
                    message.sender === "ai" && message.senderName
                      ? getAssistantAgentLabel(message.senderName, locale)
                      : message.sender === "staff"
                        ? firstNameOnly(message.senderName)
                        : null
                  }
                />
              )}
            />
            {sendMutation.isPending && (
              <ChatMessageBubble direction="incoming" content="•••" />
            )}
            <div ref={endRef} />
          </div>

          {selectedChat?.status === "ended" && !selectedChat.rating && (
            <div className="shrink-0 space-y-2 border-t bg-[var(--surface-muted)] p-3">
              <p className="text-xs font-black">{t.rate}</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((score) => (
                  <button
                    key={score}
                    type="button"
                    onClick={() => setRating(score)}
                    className="focus-ring grid size-11 place-items-center rounded-full"
                    aria-label={`${score}`}
                  >
                    <Star
                      className={cn(
                        "size-5",
                        score <= rating && "fill-current text-amber-500",
                      )}
                    />
                  </button>
                ))}
              </div>
              <Textarea
                value={ratingReason}
                onChange={(event) => setRatingReason(event.target.value)}
                placeholder={t.reason}
                className="min-h-16 text-xs"
              />
              <Button
                size="sm"
                loading={rateMutation.isPending}
                onClick={() =>
                  rateMutation.mutate({
                    id: selectedChat.id,
                    score: rating,
                    reason: ratingReason,
                  })
                }
              >
                {t.submitRating}
              </Button>
            </div>
          )}

          <footer className="shrink-0 bg-[var(--surface)] p-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
            {!activeChat && supportOffer?.available && (
              <div className="mb-3">
                <Button
                  className="w-full"
                  size="sm"
                  loading={transferMutation.isPending}
                  disabled={transcriptHistory.length === 0}
                  onClick={() => transferMutation.mutate()}
                >
                  <Headset className="size-4" />
                  {t.liveChat}
                </Button>
              </div>
            )}
            {canEnd && (
              <div className="mb-2 flex justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={endMutation.isPending}
                  onClick={() => setEndIntent("end")}
                  aria-label={t.end}
                  title={t.end}
                >
                  <CircleStop className="size-4" />
                  {t.end}
                </Button>
              </div>
            )}
            <div className="chat-composer-shell flex gap-2">
              <Input
                value={input}
                disabled={disabledInput}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submitMessage();
                  }
                }}
                placeholder={
                  disabledInput ? t.ended : isAdmin ? t.staffPlaceholder : t.placeholder
                }
                className="min-w-0 border-0 bg-transparent shadow-none focus:border-transparent focus:shadow-none"
                dir="auto"
              />
              <Button
                size="icon"
                disabled={disabledInput}
                loading={sendMutation.isPending}
                onClick={submitMessage}
                className="size-12 shrink-0 rounded-full"
                aria-label={t.send}
                title={t.send}
              >
                <Send className="size-4" />
              </Button>
            </div>
          </footer>
        </section>
      )}

      <ConfirmDialog
        open={endIntent !== null}
        onOpenChange={(dialogOpen) => !dialogOpen && setEndIntent(null)}
        title={t.endTitle}
        description={t.endDescription}
        confirmLabel={t.end}
        loading={endMutation.isPending}
        onConfirm={() => {
          if (activeChat) endMutation.mutate(activeChat);
        }}
      />
    </>
  );
}
