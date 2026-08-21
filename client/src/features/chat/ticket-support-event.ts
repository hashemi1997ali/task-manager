export const TICKET_SUPPORT_EVENT = "karino:ticket-support";
export const ASSISTANT_SUPPORT_EVENT = "karino:assistant-support";

export interface TicketSupportRequest {
  id: string;
  ticketNumber: string;
  title: string;
}

export interface AssistantSupportRequest {
  conversationId: string;
  history: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}

export const requestTicketSupport = (ticket: TicketSupportRequest): void => {
  window.dispatchEvent(
    new CustomEvent<TicketSupportRequest>(TICKET_SUPPORT_EVENT, { detail: ticket }),
  );
};

export const requestAssistantSupport = (request: AssistantSupportRequest): void => {
  window.dispatchEvent(
    new CustomEvent<AssistantSupportRequest>(ASSISTANT_SUPPORT_EVENT, {
      detail: request,
    }),
  );
};
