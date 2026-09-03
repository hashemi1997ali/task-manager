"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleStop,
  Headphones,
  Lightbulb,
  Send,
  WandSparkles,
} from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Card } from "@/components/ui/card";
import { ChatStatusBadge, UserTypeBadge } from "@/components/ui/domain-badge";
import { PageHeading } from "@/components/ui/page-heading";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useAuth } from "@/features/auth/auth-provider";
import { ChatMessageBubble } from "@/features/chat/chat-message-bubble";
import { ChatHistoryItem } from "@/features/chat/chat-history-item";
import { ChatIconButton } from "@/features/chat/chat-icon-button";
import { ChatSuggestionPanel } from "@/features/chat/chat-suggestion-panel";
import { ChatThreadHeader } from "@/features/chat/chat-thread-header";
import { DateGroupedMessageList } from "@/features/chat/date-grouped-message-list";
import {
  claimStaffChatRequest,
  endStaffChatRequest,
  getStaffSuggestionsRequest,
  listStaffChatsRequest,
  rewriteStaffMessageRequest,
  sendStaffMessageRequest,
  transferStaffChatRequest,
} from "@/features/chat/api";
import { getErrorMessage } from "@/lib/api-error";
import {
  getAssistantAgentLabel,
  getLocalizedSupportSystemMessage,
} from "@/lib/domain-labels";
import type { SupportChat, User } from "@/lib/types";
import { cn, getId } from "@/lib/utils";
import { usePreferences } from "@/providers/preferences-provider";

const copy = {
  en: {
    eyebrow: "Human support",
    title: "Support inbox",
    description: "Join and manage human support conversations.",
    empty: "There are no support conversations waiting right now.",
    loading: "Loading support conversations…",
    back: "Back to conversations",
    accept: "Join chat",
    assigned: (name: string) => `Assigned to ${name}`,
    reply: "Write a reply…",
    send: "Send reply",
    transfer: "Transfer to Super Support",
    end: "End chat",
    suggestions: "Suggested replies",
    hideSuggestions: "Hide suggested replies",
    improve: "Improve draft",
    improved: "Your draft was improved.",
    profile: "Open user profile",
    tasks: "Open this user's tasks",
    waiting: "Waiting",
    active: "Active",
    super: "Super Support required",
    userDetails: "User details",
    banned: "Banned",
    noSelection: "Select a conversation from the inbox.",
    guest: "Guest",
    guestDetails: "Guest contact",
    endTitle: "End this support chat?",
    endDescription: "The conversation will be closed for both sides.",
    allHistory: "All chat history",
    supportQueue: "Support queue",
    assistantStatus: "AI Assistant",
    endedStatus: "Ended",
    previous: "Previous",
    next: "Next",
    page: "Page",
    takeoverTitle: "Join this active chat?",
    takeoverDescription:
      "The current Support Agent will leave the conversation and you will become the assigned Super Support Agent.",
    takeoverConfirm: "Join and replace",
    superQueue: "Super",
    historyRole: {
      user: "User",
      admin: "Admin",
      super_admin: "Super Admin",
      guest: "Guest",
    },
  },
  de: {
    eyebrow: "Menschlicher Support",
    title: "Support-Posteingang",
    description: "Menschliche Support-Unterhaltungen beitreten und verwalten.",
    empty: "Momentan warten keine Support-Unterhaltungen.",
    loading: "Support-Unterhaltungen werden geladen…",
    back: "Zurück zu Unterhaltungen",
    accept: "Chat beitreten",
    assigned: (name: string) => `Zugewiesen an ${name}`,
    reply: "Antwort schreiben…",
    send: "Antwort senden",
    transfer: "An Super-Support übertragen",
    end: "Chat beenden",
    suggestions: "Antwortvorschläge",
    hideSuggestions: "Antwortvorschläge ausblenden",
    improve: "Entwurf verbessern",
    improved: "Dein Entwurf wurde verbessert.",
    profile: "Benutzerprofil öffnen",
    tasks: "Aufgaben dieses Benutzers öffnen",
    waiting: "Wartet",
    active: "Aktiv",
    super: "Super-Support erforderlich",
    userDetails: "Benutzerdaten",
    banned: "Gesperrt",
    noSelection: "Wähle eine Unterhaltung aus dem Posteingang.",
    guest: "Gast",
    guestDetails: "Gastkontakt",
    endTitle: "Diesen Support-Chat beenden?",
    endDescription: "Die Unterhaltung wird für beide Seiten geschlossen.",
    allHistory: "Gesamter Chatverlauf",
    supportQueue: "Support-Warteschlange",
    assistantStatus: "AI Assistant",
    endedStatus: "Beendet",
    previous: "Zurück",
    next: "Weiter",
    page: "Seite",
    takeoverTitle: "Diesem aktiven Chat beitreten?",
    takeoverDescription:
      "Der aktuelle Support-Agent verlässt die Unterhaltung und du wirst als Super-Support-Agent zugewiesen.",
    takeoverConfirm: "Beitreten und übernehmen",
    superQueue: "Super",
    historyRole: {
      user: "Benutzer",
      admin: "Admin",
      super_admin: "Super Admin",
      guest: "Gast",
    },
  },
} as const;

const getSupportStatusLabel = (
  status: SupportChat["status"],
  t: (typeof copy)["en"] | (typeof copy)["de"],
): string =>
  status === "assistant"
    ? t.assistantStatus
    : status === "open"
      ? t.waiting
      : status === "active"
        ? t.active
        : t.endedStatus;

const getChatUser = (
  chat: SupportChat | null,
): Pick<
  User,
  "id" | "firstName" | "lastName" | "email" | "roles" | "profileImage" | "ban"
> | null => {
  if (!chat || typeof chat.user === "string") return null;
  return chat.user;
};

export function StaffSupportView() {
  const { locale, intlLocale } = usePreferences();
  const t = copy[locale];
  const { user: currentUser, isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmTakeover, setConfirmTakeover] = useState(false);
  const [page, setPage] = useState(1);
  const messagesRef = useRef<HTMLDivElement>(null);
  const supportQueryKey = ["support", "queue", isSuperAdmin, page] as const;

  const chatsQuery = useQuery({
    queryKey: supportQueryKey,
    queryFn: () =>
      listStaffChatsRequest({
        scope: isSuperAdmin ? "all" : "queue",
        page,
        limit: 50,
      }),
    refetchInterval: 4_000,
  });
  const chats = useMemo(() => chatsQuery.data?.chats ?? [], [chatsQuery.data?.chats]);
  const effectiveSelectedId =
    selectedId && chats.some((chat) => chat.id === selectedId)
      ? selectedId
      : (chats[0]?.id ?? null);
  const selected = chats.find((chat) => chat.id === effectiveSelectedId) ?? null;
  const chatUser = getChatUser(selected);
  const selectedUserType = chatUser?.roles.includes("super_admin")
    ? "super_admin"
    : chatUser?.roles.includes("admin")
      ? "admin"
      : chatUser
        ? "user"
        : "guest";
  const assignedToMe =
    Boolean(selected?.assignedTo) &&
    selected?.assignedTo === (currentUser ? getId(currentUser) : "");
  const canReply = assignedToMe && selected?.status === "active";
  const firstNameOnly = (name: string | null | undefined) =>
    name?.trim().split(/\s+/)[0] ?? "";
  const userFullName = (user: Pick<User, "firstName" | "lastName">) =>
    `${user.firstName} ${user.lastName}`.trim();
  const formatLastMessage = (chat: SupportChat) => {
    const value = chat.messages.at(-1)?.createdAt ?? chat.updatedAt;
    return new Intl.DateTimeFormat(intlLocale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  };
  const formatMessageDate = (value: string) =>
    new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium" }).format(new Date(value));

  useLayoutEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const messages = messagesRef.current;
      if (messages) messages.scrollTop = messages.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [effectiveSelectedId, mobileThreadOpen, selected?.messages.length]);

  const updateCache = (chat: SupportChat) => {
    queryClient.setQueryData<Awaited<ReturnType<typeof listStaffChatsRequest>>>(
      supportQueryKey,
      (current) =>
        current
          ? {
              ...current,
              chats: current.chats.map((item) => (item.id === chat.id ? chat : item)),
            }
          : current,
    );
    setSelectedId(chat.id);
  };

  const mutationOptions = {
    onError: (error: Error) => toast.error(getErrorMessage(error, locale)),
  };
  const claimMutation = useMutation({
    mutationFn: claimStaffChatRequest,
    onSuccess: updateCache,
    ...mutationOptions,
  });
  const sendMutation = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      sendStaffMessageRequest(id, text),
    onSuccess: (chat) => {
      updateCache(chat);
      setMessage("");
      setSuggestions([]);
    },
    ...mutationOptions,
  });
  const transferMutation = useMutation({
    mutationFn: transferStaffChatRequest,
    onSuccess: async (chat) => {
      updateCache(chat);
      toast.success(t.transfer);
      await chatsQuery.refetch();
    },
    ...mutationOptions,
  });
  const endMutation = useMutation({
    mutationFn: endStaffChatRequest,
    onSuccess: async () => {
      toast.success(t.end);
      setConfirmEnd(false);
      setSelectedId(null);
      await chatsQuery.refetch();
    },
    ...mutationOptions,
  });
  const suggestionsMutation = useMutation({
    mutationFn: (id: string) => getStaffSuggestionsRequest(id, locale),
    onSuccess: setSuggestions,
    ...mutationOptions,
  });

  const rewriteMutation = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      rewriteStaffMessageRequest(id, text),
    onSuccess: (rewritten) => {
      setMessage(rewritten);
      toast.success(t.improved);
    },
    onError: (error) => toast.error(getErrorMessage(error, locale)),
  });

  const send = () => {
    const text = message.trim();
    if (!selected || !canReply || !text) return;
    sendMutation.mutate({ id: selected.id, text });
  };
  const threadOpen = mobileThreadOpen || chats.length === 0;

  return (
    <>
      <div className="md:flex md:h-[calc(100dvh-3rem)] md:min-h-0 md:flex-col md:overflow-hidden lg:h-[calc(100dvh-4rem)]">
        <PageHeading title={t.title} description={t.description} />

        {chatsQuery.isPending ? (
          <div className="mt-8">
            <LoadingState label={t.loading} />
          </div>
        ) : chatsQuery.isError ? (
          <div className="mt-8">
            <ErrorState
              message={getErrorMessage(chatsQuery.error, locale)}
              retry={() => void chatsQuery.refetch()}
            />
          </div>
        ) : chats.length === 0 ? (
          <Card className="mt-8 grid min-h-52 place-items-center p-8 text-center text-sm text-[var(--muted)]">
            <Headphones className="mb-3 size-8 text-[var(--primary)]" />
            {t.empty}
          </Card>
        ) : (
          <div
            className={cn(
              "chat-workspace mt-5 grid min-h-[38rem] overflow-hidden rounded-[var(--container-radius)] md:min-h-0 md:flex-1 xl:grid-cols-[18rem_minmax(0,1fr)]",
              threadOpen &&
                "max-md:fixed max-md:inset-0 max-md:z-50 max-md:mt-0 max-md:h-dvh max-md:min-h-0 max-md:rounded-none max-md:border-0",
            )}
          >
            <aside
              className={cn(
                "min-h-0 min-w-0 flex-col border-r",
                threadOpen ? "max-xl:hidden xl:flex" : "flex",
              )}
            >
              <div className="chat-section-header flex h-16 shrink-0 items-center px-4">
                <h2 className="text-sm font-semibold">
                  {isSuperAdmin ? t.allHistory : t.supportQueue}
                </h2>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {chats.map((chat) => {
                  const owner = typeof chat.user === "string" ? null : chat.user;
                  const statusText = getSupportStatusLabel(chat.status, t);
                  const ownerRole = owner?.roles.includes("super_admin")
                    ? "super_admin"
                    : owner?.roles.includes("admin")
                      ? "admin"
                      : owner
                        ? "user"
                        : "guest";
                  return (
                    <ChatHistoryItem
                      key={chat.id}
                      selected={effectiveSelectedId === chat.id}
                      title={owner ? userFullName(owner) : (chat.guest?.label ?? t.guest)}
                      date={formatLastMessage(chat)}
                      dateTime={chat.messages.at(-1)?.createdAt ?? chat.updatedAt}
                      topBadge={
                        <ChatStatusBadge
                          status={chat.status}
                          className={cn(
                            "max-w-[10rem] truncate",
                            chat.requiresSuperAdmin
                              ? "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/25 dark:bg-violet-500/15 dark:text-violet-300"
                              : null,
                          )}
                        >
                          {chat.requiresSuperAdmin
                            ? `${t.superQueue} · ${statusText}`
                            : statusText}
                        </ChatStatusBadge>
                      }
                      bottomBadge={
                        <UserTypeBadge
                          type={ownerRole}
                          className="border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted)] dark:border-[var(--border)] dark:bg-[var(--surface-muted)] dark:text-[var(--muted)]"
                        >
                          {t.historyRole[ownerRole]}
                        </UserTypeBadge>
                      }
                      onClick={() => {
                        setSelectedId(chat.id);
                        setSuggestions([]);
                        setMobileThreadOpen(true);
                      }}
                      aria-label={`Open chat: ${owner ? userFullName(owner) : (chat.guest?.label ?? t.guest)}`}
                      aria-current={effectiveSelectedId === chat.id ? "true" : undefined}
                    />
                  );
                })}
              </div>
              {chatsQuery.data && chatsQuery.data.pagination.totalPages > 1 && (
                <div className="flex shrink-0 items-center justify-between gap-2 border-t p-2 text-xs">
                  <ChatIconButton
                    disabled={!chatsQuery.data.pagination.hasPreviousPage}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    aria-label={t.previous}
                    title={t.previous}
                  >
                    <ChevronLeft className="size-4" />
                  </ChatIconButton>
                  <span className="text-[var(--muted)]">
                    {t.page} {chatsQuery.data.pagination.page} /{" "}
                    {chatsQuery.data.pagination.totalPages}
                  </span>
                  <ChatIconButton
                    disabled={!chatsQuery.data.pagination.hasNextPage}
                    onClick={() => setPage((current) => current + 1)}
                    aria-label={t.next}
                    title={t.next}
                  >
                    <ChevronRight className="size-4" />
                  </ChatIconButton>
                </div>
              )}
            </aside>

            <section
              className={cn(
                "relative min-h-0 min-w-0 flex-col",
                threadOpen ? "flex" : "max-xl:hidden xl:flex",
              )}
            >
              {!selected ? (
                <div className="grid flex-1 place-items-center text-sm text-[var(--muted)]">
                  {t.noSelection}
                </div>
              ) : (
                <>
                  <ChatThreadHeader
                    backLabel={t.back}
                    onBack={() => {
                      setSuggestions([]);
                      setMobileThreadOpen(false);
                    }}
                    avatar={
                      <UserAvatar
                        user={
                          chatUser ?? {
                            firstName: selected.guest?.label ?? t.guest,
                            lastName: "",
                            profileImage: null,
                          }
                        }
                      />
                    }
                    title={
                      chatUser
                        ? userFullName(chatUser)
                        : (selected.guest?.label ?? t.guest)
                    }
                    titleHref={chatUser ? `/admin/users/${chatUser.id}` : undefined}
                    subtitle={chatUser?.email ?? selected.guest?.email ?? undefined}
                    meta={
                      <>
                        <UserTypeBadge
                          type={selectedUserType}
                          className="border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted)] dark:border-[var(--border)] dark:bg-[var(--surface-muted)] dark:text-[var(--muted)]"
                        >
                          {t.historyRole[selectedUserType]}
                        </UserTypeBadge>
                        <ChatStatusBadge
                          status={selected.status}
                          className={cn(
                            "max-w-[10rem] truncate",
                            selected.requiresSuperAdmin
                              ? "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/25 dark:bg-violet-500/15 dark:text-violet-300"
                              : null,
                          )}
                        >
                          {selected.requiresSuperAdmin
                            ? `${t.superQueue} · ${getSupportStatusLabel(selected.status, t)}`
                            : getSupportStatusLabel(selected.status, t)}
                        </ChatStatusBadge>
                      </>
                    }
                  />

                  <div className="chat-message-stream relative isolate min-h-0 flex-1 overflow-hidden">
                    <div
                      ref={messagesRef}
                      className="absolute inset-0 overflow-y-auto px-4 pb-4"
                    >
                      <DateGroupedMessageList
                        items={selected.messages}
                        formatDate={formatMessageDate}
                        renderItem={(item) => (
                          <ChatMessageBubble
                            direction={
                              item.sender === "staff"
                                ? "outgoing"
                                : item.sender === "system"
                                  ? "system"
                                  : "incoming"
                            }
                            content={
                              item.sender === "system"
                                ? getLocalizedSupportSystemMessage(item.content, locale)
                                : item.content
                            }
                            markdown={item.sender === "ai"}
                            createdAt={item.createdAt}
                            name={
                              item.sender === "ai" && item.senderName
                                ? getAssistantAgentLabel(item.senderName, locale)
                                : firstNameOnly(item.senderName)
                            }
                            nameHref={
                              item.sender === "user" && chatUser
                                ? `/admin/users/${chatUser.id}`
                                : item.sender === "staff" && item.senderId
                                  ? `/admin/users/${item.senderId}`
                                  : null
                            }
                          />
                        )}
                      />
                    </div>
                    <ChatSuggestionPanel
                      suggestions={suggestions}
                      onSelect={(suggestion) => {
                        setMessage(suggestion);
                        setSuggestions([]);
                      }}
                    />
                  </div>

                  <footer className="chat-composer-footer shrink-0 p-3 max-md:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={!canReply}
                          loading={suggestionsMutation.isPending}
                          aria-expanded={suggestions.length > 0}
                          onClick={() => {
                            if (suggestions.length > 0) {
                              setSuggestions([]);
                              return;
                            }
                            suggestionsMutation.mutate(selected.id);
                          }}
                        >
                          <Lightbulb className="size-4" />
                          {suggestions.length > 0 ? t.hideSuggestions : t.suggestions}
                        </Button>
                      </div>
                      <div className="ml-auto flex flex-wrap justify-end gap-2">
                        {(selected.status === "open" ||
                          (isSuperAdmin &&
                            selected.status === "active" &&
                            !assignedToMe)) && (
                          <Button
                            variant="secondary"
                            size="sm"
                            loading={claimMutation.isPending}
                            onClick={() => {
                              if (selected.status === "active") {
                                setConfirmTakeover(true);
                              } else {
                                claimMutation.mutate(selected.id);
                              }
                            }}
                          >
                            <Check className="size-4" />
                            {t.accept}
                          </Button>
                        )}
                        {!isSuperAdmin && canReply && (
                          <Button
                            variant="secondary"
                            size="sm"
                            loading={transferMutation.isPending}
                            onClick={() => transferMutation.mutate(selected.id)}
                          >
                            <ArrowUpRight className="size-4" />
                            {t.transfer}
                          </Button>
                        )}
                        {canReply && (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={endMutation.isPending}
                            onClick={() => setConfirmEnd(true)}
                            aria-label={t.end}
                            title={t.end}
                          >
                            <CircleStop className="size-4" />
                            {t.end}
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="chat-composer-shell flex items-end gap-2">
                      <textarea
                        value={message}
                        disabled={!canReply}
                        onChange={(event) => setMessage(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            send();
                          }
                        }}
                        placeholder={t.reply}
                        aria-label={t.reply}
                        dir="auto"
                        rows={1}
                        className="min-h-11 max-h-32 min-w-0 flex-1 resize-none bg-transparent px-2 py-2.5 text-base leading-6 outline-none placeholder:text-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                      />
                      <Button
                        variant="secondary"
                        size="icon"
                        className="size-11 shrink-0 rounded-full"
                        disabled={!canReply || !message.trim()}
                        loading={rewriteMutation.isPending}
                        onClick={() => {
                          const text = message.trim();
                          if (selected && text) {
                            rewriteMutation.mutate({ id: selected.id, text });
                          }
                        }}
                        aria-label={t.improve}
                        title={t.improve}
                      >
                        <WandSparkles className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        className="size-11 shrink-0 rounded-full"
                        disabled={!canReply || !message.trim()}
                        loading={sendMutation.isPending}
                        onClick={send}
                        aria-label={t.send}
                      >
                        <Send className="size-4" />
                      </Button>
                    </div>
                  </footer>
                </>
              )}
            </section>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={confirmTakeover}
        onOpenChange={setConfirmTakeover}
        title={t.takeoverTitle}
        description={t.takeoverDescription}
        confirmLabel={t.takeoverConfirm}
        loading={claimMutation.isPending}
        onConfirm={() => {
          if (!selected) return;
          claimMutation.mutate(selected.id, {
            onSuccess: () => setConfirmTakeover(false),
          });
        }}
      />
      <ConfirmDialog
        open={confirmEnd}
        onOpenChange={setConfirmEnd}
        title={t.endTitle}
        description={t.endDescription}
        confirmLabel={t.end}
        loading={endMutation.isPending}
        onConfirm={() => {
          if (selected) endMutation.mutate(selected.id);
        }}
      />
    </>
  );
}
