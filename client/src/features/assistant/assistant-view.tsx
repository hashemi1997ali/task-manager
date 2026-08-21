"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  Check,
  CheckCircle2,
  Clock3,
  Headset,
  Inbox,
  ListTodo,
  MessageSquarePlus,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TaskPriorityBadge, TicketCategoryBadge } from "@/components/ui/domain-badge";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { avatarFrameClassName } from "@/components/user-avatar";
import {
  confirmAssistantTaskRequest,
  createAssistantConversationRequest,
  dismissAssistantTaskRequest,
  listAssistantConversationsRequest,
  sendAssistantMessageRequest,
} from "@/features/assistant/api";
import { ChatMessageBubble } from "@/features/chat/chat-message-bubble";
import { ChatHistoryItem } from "@/features/chat/chat-history-item";
import { ChatIconButton } from "@/features/chat/chat-icon-button";
import { ChatSuggestionPanel } from "@/features/chat/chat-suggestion-panel";
import { ChatThreadHeader } from "@/features/chat/chat-thread-header";
import { DateGroupedMessageList } from "@/features/chat/date-grouped-message-list";
import { getErrorMessage } from "@/lib/api-error";
import { getTaskPriorityLabel, getTicketCategoryLabel } from "@/lib/domain-labels";
import type {
  AssistantConversation,
  AssistantMessage,
  AssistantTaskProposal,
} from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";
import { usePreferences } from "@/providers/preferences-provider";

const copy = {
  en: {
    eyebrow: "Private AI workspace",
    title: "AI Assistant",
    subtitle: "Private request guidance, ticket triage, and confirmed ticket creation.",
    conversations: "Conversations",
    newConversation: "New conversation",
    back: "Back to conversations",
    empty: "Describe an issue, ask about an existing request, or draft a new ticket.",
    noConversations: "No private conversations yet.",
    placeholder: "Message AI…",
    context: "Ticket context",
    total: "Total tickets",
    overdue: "Overdue",
    done: "Completed",
    quick: "Quick prompts",
    hideQuick: "Hide quick prompts",
    prompts: [
      "Summarize my open requests",
      "Which ticket needs attention first?",
      "Help me describe a technical issue",
      "Create a ticket for an account access problem",
    ],
    assistant: "AI Assistant",
    you: "You",
    privateLabel: "Private to you",
    privateDescription:
      "These conversations are separate from support and cannot be viewed by staff.",
    scope: "Requests and support only",
    ready: "Ready for a request",
    composerHint: "Enter to send · Shift + Enter for a new line",
    contextDescription: "Live context from your own request queue.",
    draft: "Ticket draft",
    description: "Description",
    due: "Requested resolution",
    confirm: "Confirm & create",
    dismiss: "Dismiss",
    creating: "Creating…",
    created: "Ticket created",
    dismissed: "Draft dismissed",
    openTask: "Open tickets",
    taskCreated: "Ticket created successfully.",
    draftDismissed: "Ticket draft dismissed.",
    send: "Send",
    thinking: "AI is thinking…",
    liveSupport: "Continue with live support",
    supportOpened: "Live support opened",
    unavailable: "AI assistance is currently disabled.",
  },
  de: {
    eyebrow: "Privater KI-Arbeitsbereich",
    title: "AI Assistant",
    subtitle: "Private Anfragehilfe, Ticket-Triage und bestätigte Ticketerstellung.",
    conversations: "Unterhaltungen",
    newConversation: "Neue Unterhaltung",
    back: "Zurück zu Unterhaltungen",
    empty: "Beschreibe ein Problem, frage nach einer Anfrage oder entwirf ein Ticket.",
    noConversations: "Noch keine privaten Unterhaltungen.",
    placeholder: "Nachricht…",
    context: "Ticketkontext",
    total: "Tickets gesamt",
    overdue: "Überfällig",
    done: "Erledigt",
    quick: "Schnellaktionen",
    hideQuick: "Schnellaktionen ausblenden",
    prompts: [
      "Fasse meine offenen Anfragen zusammen",
      "Welches Ticket braucht zuerst Aufmerksamkeit?",
      "Hilf mir, ein technisches Problem zu beschreiben",
      "Erstelle ein Ticket für ein Problem beim Kontozugriff",
    ],
    assistant: "AI Assistant",
    you: "Du",
    privateLabel: "Nur für dich",
    privateDescription:
      "Diese Unterhaltungen sind vom Support getrennt und für Mitarbeitende nicht sichtbar.",
    scope: "Nur Anfragen und Support",
    ready: "Bereit für eine Anfrage",
    composerHint: "Enter zum Senden · Umschalt + Enter für eine neue Zeile",
    contextDescription: "Live-Kontext aus deiner eigenen Anfrage-Warteschlange.",
    draft: "Ticketentwurf",
    description: "Beschreibung",
    due: "Gewünschte Lösung",
    confirm: "Bestätigen & erstellen",
    dismiss: "Verwerfen",
    creating: "Wird erstellt…",
    created: "Ticket erstellt",
    dismissed: "Entwurf verworfen",
    openTask: "Tickets öffnen",
    taskCreated: "Ticket wurde erstellt.",
    draftDismissed: "Ticketentwurf wurde verworfen.",
    send: "Senden",
    thinking: "KI denkt nach…",
    liveSupport: "Mit Live-Support fortfahren",
    supportOpened: "Live-Support geöffnet",
    unavailable: "Die AI-Unterstützung ist derzeit deaktiviert.",
  },
} as const;

type Copy = (typeof copy)["en"] | (typeof copy)["de"];

const unavailableMessages = new Set<string>([copy.en.unavailable, copy.de.unavailable]);

type PendingUserMessage = {
  content: string;
  createdAt: string;
  conversationId: string | null;
  previousMatchingMessages: number;
};

function ProgressiveAssistantMessage({
  message,
  name,
  reveal,
  onRevealComplete,
  children,
}: {
  message: AssistantMessage;
  name: string;
  reveal: boolean;
  onRevealComplete: () => void;
  children?: ReactNode;
}) {
  const [visibleLength, setVisibleLength] = useState(() => {
    if (!reveal) return message.content.length;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return message.content.length;
    }
    return Math.min(1, message.content.length);
  });
  const onRevealCompleteRef = useRef(onRevealComplete);

  useEffect(() => {
    onRevealCompleteRef.current = onRevealComplete;
  }, [onRevealComplete]);

  const complete = visibleLength >= message.content.length;

  useEffect(() => {
    if (!reveal) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onRevealCompleteRef.current();
      return;
    }
    const step = Math.max(1, Math.ceil(message.content.length / 100));
    const timer = window.setInterval(() => {
      setVisibleLength((current) => {
        const next = Math.min(message.content.length, current + step);
        if (next >= message.content.length) {
          window.clearInterval(timer);
          onRevealCompleteRef.current();
        }
        return next;
      });
    }, 24);

    return () => window.clearInterval(timer);
  }, [message.content.length, reveal]);

  return (
    <div>
      <ChatMessageBubble
        direction="incoming"
        content={message.content.slice(0, visibleLength)}
        markdown
        typing={!complete}
        createdAt={message.createdAt}
        name={name}
      />
      {complete && children}
    </div>
  );
}

function ProposalCard({
  proposal,
  t,
  locale,
  intlLocale,
  busy,
  onConfirm,
  onDismiss,
}: {
  proposal: AssistantTaskProposal;
  t: Copy;
  locale: "en" | "de";
  intlLocale: string;
  busy: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const pending = proposal.status === "pending";
  return (
    <Card
      spotlight
      className="mt-2 max-w-[32rem] border-[var(--primary)]/20 bg-[var(--primary-soft)]/35 p-3 shadow-none"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <ListTodo className="size-4 text-[var(--primary)]" />
          {t.draft}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {proposal.category && (
            <TicketCategoryBadge category={proposal.category}>
              {getTicketCategoryLabel(proposal.category, locale)}
            </TicketCategoryBadge>
          )}
          <TaskPriorityBadge priority={proposal.priority}>
            {getTaskPriorityLabel(proposal.priority, locale)}
          </TaskPriorityBadge>
        </div>
      </div>
      <div className="p-4">
        <h3 className="text-base font-semibold tracking-[-0.015em]">{proposal.title}</h3>
        <div className="desk-panel-soft mt-3 rounded-2xl border bg-[var(--surface-muted)]/70 p-3.5">
          <p className="text-[0.625rem] font-bold tracking-[0.12em] text-[var(--muted)] uppercase">
            {t.description}
          </p>
          <p className="mt-1.5 text-sm leading-6 text-[var(--foreground)]">
            {proposal.description || "—"}
          </p>
        </div>
        <p className="mt-3 flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
          <Clock3 className="size-3.5 text-[var(--primary)]" />
          {t.due}: {proposal.dueDate ? formatDateTime(proposal.dueDate, intlLocale) : "—"}
        </p>
        {pending ? (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button size="sm" loading={busy} onClick={onConfirm}>
              <Check className="size-4" />
              {t.confirm}
            </Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={onDismiss}>
              <X className="size-4" />
              {t.dismiss}
            </Button>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--muted)]">
            {proposal.status === "created" ? (
              <>
                <CheckCircle2 className="size-4 text-[var(--success)]" />
                {t.created}
                <Link
                  href="/tickets"
                  className="focus-ring rounded text-[var(--primary)] hover:underline"
                >
                  {t.openTask}
                </Link>
              </>
            ) : proposal.status === "creating" ? (
              <>
                <Clock3 className="size-4 text-[var(--primary)]" />
                {t.creating}
              </>
            ) : (
              <>
                <X className="size-4" />
                {t.dismissed}
              </>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

export function AssistantView() {
  const { locale, intlLocale } = usePreferences();
  const t = copy[locale];
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [pendingUserMessage, setPendingUserMessage] = useState<PendingUserMessage | null>(
    null,
  );
  const [latestResponseId, setLatestResponseId] = useState<string | null>(null);
  const [unavailableConversationIds, setUnavailableConversationIds] = useState(
    () => new Set<string>(),
  );
  const [supportRequestedConversationIds, setSupportRequestedConversationIds] = useState(
    () => new Set<string>(),
  );
  const revealedResponseIdsRef = useRef(new Set<string>());
  const messagesRef = useRef<HTMLDivElement>(null);

  const conversationsQuery = useQuery({
    queryKey: ["assistant", "conversations"],
    queryFn: listAssistantConversationsRequest,
  });
  const conversations = useMemo(
    () =>
      [...(conversationsQuery.data ?? [])].sort(
        (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
      ),
    [conversationsQuery.data],
  );
  const selected =
    selectedId === "__new__"
      ? null
      : (conversations.find((item) => item.id === selectedId) ??
        conversations[0] ??
        null);

  useLayoutEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const messages = messagesRef.current;
      if (messages) {
        messages.scrollTo({
          top: messages.scrollHeight,
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
        });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mobileThreadOpen, pendingUserMessage, selected?.id, selected?.messages.length]);

  const replaceConversation = (conversation: AssistantConversation) => {
    queryClient.setQueryData<AssistantConversation[]>(
      ["assistant", "conversations"],
      (current = []) => [
        conversation,
        ...current.filter((item) => item.id !== conversation.id),
      ],
    );
    setSelectedId(conversation.id);
  };

  const sendMutation = useMutation({
    mutationFn: async (content: string) =>
      selected
        ? sendAssistantMessageRequest(selected.id, content, locale)
        : createAssistantConversationRequest(content, locale),
    onSuccess: ({ conversation, provider }) => {
      const responseMessage = conversation.messages.at(-1);
      if (responseMessage?.sender === "assistant") {
        setLatestResponseId(responseMessage.id);
      }
      setUnavailableConversationIds((current) => {
        const next = new Set(current);
        if (provider === "unavailable") next.add(conversation.id);
        else next.delete(conversation.id);
        return next;
      });
      setPendingUserMessage(null);
      replaceConversation(conversation);
      setSuggestionsOpen(false);
      setMobileThreadOpen(true);
    },
    onError: (error, content) => {
      setPendingUserMessage(null);
      setMessage((current) => current || content);
      toast.error(getErrorMessage(error, locale));
    },
  });

  const confirmMutation = useMutation({
    mutationFn: ({
      conversationId,
      messageId,
    }: {
      conversationId: string;
      messageId: string;
    }) => confirmAssistantTaskRequest(conversationId, messageId),
    onSuccess: ({ conversation }) => {
      replaceConversation(conversation);
      void queryClient.invalidateQueries({ queryKey: ["tickets"] });
      toast.success(t.taskCreated);
    },
    onError: (error) => toast.error(getErrorMessage(error, locale)),
  });

  const dismissMutation = useMutation({
    mutationFn: ({
      conversationId,
      messageId,
    }: {
      conversationId: string;
      messageId: string;
    }) => dismissAssistantTaskRequest(conversationId, messageId),
    onSuccess: (conversation) => {
      replaceConversation(conversation);
      toast.success(t.draftDismissed);
    },
    onError: (error) => toast.error(getErrorMessage(error, locale)),
  });

  if (conversationsQuery.isPending) return <LoadingState />;
  if (conversationsQuery.isError) {
    return (
      <ErrorState message={getErrorMessage(conversationsQuery.error, locale)} />
    );
  }

  const submit = (value = message) => {
    const content = value.trim();
    if (!content || sendMutation.isPending) return;

    const currentMessages = selected?.messages ?? [];
    setPendingUserMessage({
      content,
      createdAt: new Date().toISOString(),
      conversationId: selected?.id ?? null,
      previousMatchingMessages: currentMessages.filter(
        (item) => item.sender === "user" && item.content === content,
      ).length,
    });
    setMessage("");
    setSuggestionsOpen(false);
    setMobileThreadOpen(true);
    sendMutation.mutate(content);
  };

  const proposalBusy = confirmMutation.isPending || dismissMutation.isPending;
  const threadOpen = mobileThreadOpen || conversations.length === 0;
  const selectedMessages = selected?.messages ?? [];
  const pendingBelongsToSelected =
    pendingUserMessage?.conversationId === (selected?.id ?? null);
  const pendingMessagePersisted = Boolean(
    pendingUserMessage &&
    selectedMessages.filter(
      (item) => item.sender === "user" && item.content === pendingUserMessage.content,
    ).length > pendingUserMessage.previousMatchingMessages,
  );
  const displayMessages: AssistantMessage[] = [
    ...selectedMessages,
    ...(pendingUserMessage && pendingBelongsToSelected && !pendingMessagePersisted
      ? [
          {
            id: "pending-assistant-user-message",
            sender: "user" as const,
            content: pendingUserMessage.content,
            taskProposal: null,
            createdAt: pendingUserMessage.createdAt,
          },
        ]
      : []),
  ];
  const lastSelectedMessage = selectedMessages.at(-1);
  const assistantUnavailable = Boolean(
    selected &&
    lastSelectedMessage?.sender === "assistant" &&
    (unavailableConversationIds.has(selected.id) ||
      unavailableMessages.has(lastSelectedMessage.content.trim())),
  );
  const supportRequested = Boolean(
    selected && supportRequestedConversationIds.has(selected.id),
  );

  return (
    <div className="md:flex md:h-[calc(100dvh-3rem)] md:min-h-0 md:flex-col md:overflow-hidden lg:h-[calc(100dvh-4rem)]">
      <PageHeading title={t.title} description={t.subtitle} />

      <div
        className={cn(
          "chat-workspace mt-5 grid min-h-[38rem] overflow-hidden rounded-[var(--container-radius)] md:min-h-0 md:flex-1 xl:grid-cols-[18rem_minmax(0,1fr)]",
          threadOpen &&
            "max-md:fixed max-md:inset-0 max-md:z-50 max-md:mt-0 max-md:h-dvh max-md:min-h-0 max-md:rounded-none max-md:border-0",
        )}
      >
        <aside
          className={cn(
            "min-h-0 min-w-0 flex-col border-r bg-[color-mix(in_srgb,var(--surface-muted)_52%,var(--surface))]",
            threadOpen ? "max-xl:hidden xl:flex" : "flex",
          )}
        >
          <div className="chat-section-header flex h-16 shrink-0 items-center justify-between px-4">
            <h2 className="text-sm font-semibold">{t.conversations}</h2>
            <ChatIconButton
              aria-label={t.newConversation}
              title={t.newConversation}
              onClick={() => {
                setSelectedId("__new__");
                setSuggestionsOpen(false);
                setMobileThreadOpen(true);
              }}
            >
              <MessageSquarePlus className="size-4" />
            </ChatIconButton>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {conversations.length ? (
              conversations.map((conversation) => (
                <ChatHistoryItem
                  key={conversation.id}
                  selected={selected?.id === conversation.id}
                  title={conversation.subject || t.assistant}
                  date={new Intl.DateTimeFormat(intlLocale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(conversation.updatedAt))}
                  dateTime={conversation.updatedAt}
                  onClick={() => {
                    setSelectedId(conversation.id);
                    setSuggestionsOpen(false);
                    setMobileThreadOpen(true);
                  }}
                  aria-label={`Open chat: ${conversation.subject || t.assistant}`}
                  aria-current={selected?.id === conversation.id ? "true" : undefined}
                />
              ))
            ) : (
              <div className="grid min-h-52 place-items-center p-5 text-center">
                <div>
                  <MessageSquarePlus className="mx-auto size-6 text-[var(--primary)]" />
                  <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                    {t.noConversations}
                  </p>
                </div>
              </div>
            )}
          </div>
        </aside>

        <section
          className={cn(
            "min-h-0 min-w-0 flex-col",
            threadOpen ? "flex" : "max-xl:hidden xl:flex",
          )}
        >
          <ChatThreadHeader
            backLabel={t.back}
            onBack={() => {
              setSuggestionsOpen(false);
              setMobileThreadOpen(false);
            }}
            hideBack={conversations.length === 0}
            avatar={
              <span
                className={avatarFrameClassName("text-[var(--primary)]")}
                aria-label={t.assistant}
              >
                <Bot className="size-5" />
              </span>
            }
            title={t.assistant}
            subtitle={t.ready}
            meta={
              <span className="inline-flex items-center gap-1.5 rounded-full border bg-[var(--surface)] px-2.5 py-1 text-[0.625rem] font-semibold text-[var(--muted)]">
                <ShieldCheck className="size-3.5 text-[var(--success)]" />
                {t.scope}
              </span>
            }
          />

          <div className="chat-message-stream relative isolate min-h-0 flex-1 overflow-hidden">
            <div
              ref={messagesRef}
              className="absolute inset-0 overflow-y-auto overscroll-contain px-3 pb-5 sm:px-6 lg:px-8"
            >
              {displayMessages.length ? (
                <>
                  <DateGroupedMessageList
                    items={displayMessages}
                    formatDate={(value) =>
                      new Intl.DateTimeFormat(intlLocale, {
                        dateStyle: "medium",
                      }).format(new Date(value))
                    }
                    renderItem={(item: AssistantMessage) =>
                      item.sender === "user" ? (
                        <ChatMessageBubble
                          direction="outgoing"
                          content={item.content}
                          createdAt={item.createdAt}
                          name={t.you}
                        />
                      ) : (
                        <ProgressiveAssistantMessage
                          message={item}
                          name={t.assistant}
                          reveal={
                            item.id === latestResponseId &&
                            !revealedResponseIdsRef.current.has(item.id)
                          }
                          onRevealComplete={() =>
                            revealedResponseIdsRef.current.add(item.id)
                          }
                        >
                          {item.taskProposal && selected && (
                            <ProposalCard
                              proposal={item.taskProposal}
                              t={t}
                              locale={locale}
                              intlLocale={intlLocale}
                              busy={proposalBusy}
                              onConfirm={() =>
                                confirmMutation.mutate({
                                  conversationId: selected.id,
                                  messageId: item.id,
                                })
                              }
                              onDismiss={() =>
                                dismissMutation.mutate({
                                  conversationId: selected.id,
                                  messageId: item.id,
                                })
                              }
                            />
                          )}
                        </ProgressiveAssistantMessage>
                      )
                    }
                  />
                  {sendMutation.isPending && pendingBelongsToSelected && (
                    <div className="mt-3" role="status" aria-label={t.thinking}>
                      <ChatMessageBubble
                        direction="incoming"
                        content=""
                        typing
                        name={t.assistant}
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="grid h-full place-items-center px-4 py-8 text-center">
                  <div className="max-w-lg">
                    <span className="desk-icon-well mx-auto grid size-14 place-items-center rounded-2xl border bg-[color-mix(in_srgb,var(--primary-soft)_72%,var(--surface))] text-[var(--primary)] shadow-sm">
                      <Sparkles className="size-6" />
                    </span>
                    <h2 className="mt-4 text-lg font-semibold tracking-[-0.02em]">
                      {t.ready}
                    </h2>
                    <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--muted)]">
                      {t.empty}
                    </p>
                    <div className="mt-5 grid gap-2 text-left sm:grid-cols-2">
                      {t.prompts.slice(0, 4).map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => submit(prompt)}
                          disabled={sendMutation.isPending}
                          className="focus-ring rounded-2xl border bg-[color-mix(in_srgb,var(--surface)_90%,var(--surface-muted))] px-3.5 py-3 text-xs font-medium leading-5 text-[var(--foreground)] shadow-sm transition-[border-color,transform] hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--primary)_35%,var(--border))] disabled:opacity-50"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <ChatSuggestionPanel
              suggestions={suggestionsOpen ? t.prompts : []}
              onSelect={(prompt) => {
                setSuggestionsOpen(false);
                submit(prompt);
              }}
            />
          </div>

          <footer className="shrink-0 bg-[var(--surface)] p-3 max-md:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="mb-2 flex flex-wrap gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={sendMutation.isPending}
                aria-expanded={suggestionsOpen}
                onClick={() => setSuggestionsOpen((current) => !current)}
              >
                <Sparkles className="size-4" />
                {suggestionsOpen ? t.hideQuick : t.quick}
              </Button>
            </div>
            <form
              className="chat-composer-shell flex items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
            >
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submit();
                  }
                }}
                placeholder={t.placeholder}
                aria-label={t.placeholder}
                rows={1}
                className="max-h-32 min-h-11 min-w-0 flex-1 resize-none bg-transparent px-2 py-2.5 text-base leading-6 outline-none placeholder:text-[var(--muted)] disabled:opacity-50 sm:text-sm"
                dir="auto"
              />
              <Button
                size="icon"
                loading={sendMutation.isPending}
                disabled={!message.trim()}
                aria-label={t.send}
                title={t.send}
                className="size-11 shrink-0 rounded-xl"
              >
                <Send className="size-4" />
              </Button>
            </form>
            <p className="mt-2 px-1 text-[0.625rem] font-medium text-[var(--muted)]">
              {t.composerHint}
            </p>
          </footer>
        </section>

      </div>
    </div>
  );
}
