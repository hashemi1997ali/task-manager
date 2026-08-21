# Karino Desk

Karino Desk is an AI-first customer-support workspace for receiving requests, keeping response commitments visible, and handing conversations to a human without losing context.

It combines a customer request portal, a time-aware support queue, a private AI Request Assistant, live support, role-based operations, and account administration in one responsive English/German application.

## Product workflow

1. A customer submits a request in the portal, confirms a draft prepared by the AI Request Assistant, or asks to move an authenticated assistant conversation to live support.
2. Karino assigns a human-readable reference and calculates first-response and resolution targets from the request priority.
3. A Support Agent reviews the queue, claims the request, responds, waits for the customer when necessary, and resolves it.
4. The customer continues to see the exact requested deadline, support SLA, ownership, and current state.
5. A Supervisor can handle escalations and the operations that require broader authority.

The repository is an npm workspace with two deployable applications:

```text
karino/
├── client/   # Next.js web application
├── server/   # Express REST API
├── package-lock.json
├── package.json
└── README.md
```

## Features

### Ticket queue and customer requests

- Create, edit, close, reopen, delete, search, filter, sort, and paginate requests
- Human-readable references such as `KRN-20260805-4F29A10C`
- Statuses: Open, In progress, Waiting on customer, and Resolved
- Priorities: Low, Medium, High, and Urgent
- Categories: General, Account, Technical, Billing, and Feature request
- Source context for requests created in the portal, by the assistant, or from authenticated live-support handoff
- Customer-requested resolution date and time kept separate from internal SLA targets
- Assignee, live first-response/resolution countdowns, completion time, and exact last-update timestamps
- Responsive cards on smaller screens and dense operational tables on desktop

### Time and SLA

Time is an operational part of Karino Desk, not a decorative statistic:

- The application shell shows a real locale-aware clock and date.
- Ticket cards, tables, forms, and dashboards show exact date-times rather than date-only placeholders.
- Live countdowns distinguish an on-track SLA, an at-risk target, and a breached target.
- The dashboard accepts the browser's IANA time zone and builds its daily schedule in that zone.
- Queue summaries report open, urgent, waiting, unassigned, first-response-breached, resolution-breached, and resolved-today counts from stored data.
- A customer's requested deadline remains independent from the first-response and resolution commitments.

Current SLA targets are wall-clock durations calculated from ticket creation. When a resolved ticket is reopened, its resolution target restarts from the reopen time using the current priority; an already recorded first human response is preserved:

| Priority | First response | Resolution |
| -------- | -------------- | ---------- |
| Urgent   | 1 hour         | 4 hours    |
| High     | 4 hours        | 24 hours   |
| Medium   | 12 hours       | 72 hours   |
| Low      | 24 hours       | 120 hours  |

These values are currently defined in the server code rather than environment configuration. The customer-facing requested deadline remains editable, while SLA targets are shown as read-only operational commitments in the current interface.

### AI Request Assistant and live support

- A private Request Assistant helps a signed-in customer describe, categorise, and prioritise a support request.
- The assistant can read a scoped summary of that customer's tickets through `get_ticket_context`.
- It can return a structured draft through `propose_ticket`, but it cannot create the ticket by itself. Creation requires a separate explicit confirmation from the customer.
- A site-guidance agent answers verified Karino questions and routes sensitive or unresolved cases toward human support.
- Authenticated live-support handoff can link to an owned ticket or create a new chat-sourced ticket with the conversation transcript.
- Guest live support remains a conversation only and does not create a customer ticket.
- The support queue supports claim, transfer, provider-backed response suggestions, provider-backed draft rewriting, rating, and closure. Suggestion and rewrite endpoints return `503` when AI is unavailable instead of fabricating local output.
- Account lookup and account changes are available only through the normal administrative UI and API. The AI assistant has no account-read or account-mutation commands.
- English and German guardrails keep assistant replies within the supported product scope.

Karino currently runs one configured AI provider. Supported values for `AI_PROVIDER` are `openrouter`, `openai`, `anthropic`, `gemini`, `ollama`, and `none`. If the selected provider or model is unavailable or cannot produce a valid answer, Karino does not run an offline replacement agent. Chat orchestration returns the localised “AI assistance is currently disabled.” message with `available: false`, the private Request Assistant reports `provider: "unavailable"`, and staff suggestion/rewrite endpoints return `503`; the live-support path remains available.

#### Chat-to-ticket state synchronisation

For an authenticated linked conversation:

| Support event          | Ticket effect                           |
| ---------------------- | --------------------------------------- |
| Agent claims chat      | Assign agent and move to In progress    |
| First staff response   | Record first response; wait on customer |
| Customer replies       | Move Waiting on customer to In progress |
| Agent transfers chat   | Unassign and return to Open             |
| Customer or staff ends | Resolve the ticket                      |

### Roles

| Product role  | Stored role   | Scope                                                                                         |
| ------------- | ------------- | --------------------------------------------------------------------------------------------- |
| Customer      | `user`        | Own requests, private assistant, live support, profile, security, and sessions                |
| Support Agent | `admin`       | Regular-customer queue, self-assignment, customer account controls, and support conversations |
| Supervisor    | `super_admin` | Cross-agent assignment, staff-role management, protected deletion, and escalated support      |

Every sensitive server operation re-checks the current stored role and active session. UI visibility is not treated as authorisation.

### Aurora Focus interface

- Aurora-inspired visual system with light, dark, and system appearance modes
- Persisted theme and locale preferences
- Responsive sidebar, tablet navigation, and mobile bottom navigation
- Interactive landing-page preview based on the real queue fields, timestamps, SLA, conversation context, and handoff states; sample data is explicitly labelled
- Purposeful transitions and ambient motion with `prefers-reduced-motion` fallbacks
- Reusable loading, error, empty, form, dialog, and focus states
- English and German interface copy with locale-aware dates and numbers

### Authentication, account, and communication

- Registration, login, logout, password reset, profile editing, and account deletion
- Active-device/session list with individual, other-session, and all-session revocation
- Public contact form and staff contact inbox with stored reply history
- Transactional password-reset and contact-reply email through Brevo
- Optional JPG, PNG, and WEBP profile-image uploads through Cloudinary
- Account-based bans with a stored reason and immediate session revocation; IP addresses are not used as ban identities

## Technology stack

### Client

- Next.js 16 and React 19
- TypeScript
- Tailwind CSS 4
- TanStack Query
- React Hook Form and Zod
- Radix UI and Lucide icons

### Server

- Node.js 24 and Express 5
- TypeScript
- MongoDB and Mongoose
- JWT and bcrypt
- Zod
- Multer and Cloudinary
- Brevo transactional email

## Getting started

### Prerequisites

- Node.js `24` or later
- npm
- MongoDB locally or through MongoDB Atlas
- Optional: one supported hosted AI provider or a local Ollama installation
- Optional: Brevo for transactional email
- Optional: Cloudinary for profile-image uploads

### Install

```bash
git clone https://github.com/hashemi1997ali/karino.git
cd karino
npm install
```

Create local environment files:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env.local
```

On Windows PowerShell:

```powershell
Copy-Item server/.env.example server/.env
Copy-Item client/.env.example client/.env.local
```

At minimum, configure MongoDB and two different JWT secrets in `server/.env`:

```env
NODE_ENV=development
PORT=4000
TRUST_PROXY_HOPS=1
MONGO_URI=mongodb://127.0.0.1:27017/karino

ACCESS_JWT_SECRET=replace_with_a_long_random_access_secret
REFRESH_JWT_SECRET=replace_with_a_different_long_random_refresh_secret

APP_URL=http://localhost:3000
AI_PROVIDER=none
```

Point the Next.js server to the API in `client/.env.local`:

```env
API_SERVER_URL=http://127.0.0.1:4000
```

`API_SERVER_URL` is server-only. The browser calls `/api/*` on the Next.js origin, and the Next.js rewrite forwards that request to the Express API.

### Configure AI

Choose one provider and set its credential/model variables. For example:

```env
AI_PROVIDER=openai
AI_TIMEOUT_MS=25000
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-4.1-mini
```

For local Ollama:

```env
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:4b
```

Other supported credentials are `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`, and `GEMINI_API_KEY`, with matching model variables in `server/.env.example`. Set `AI_PROVIDER=none` when AI should be intentionally disabled.

### Optional services and operational settings

`server/.env.example` is the source of truth for all available settings. Important groups are:

| Purpose                     | Variables                                                                                                        |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Token lifetime and identity | `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL`, `JWT_ISSUER`                                                            |
| Bootstrap Supervisor        | `SUPER_ADMIN_EMAIL`                                                                                              |
| AI request metadata         | `AI_TIMEOUT_MS`, `AI_APP_NAME`, `APP_URL`                                                                        |
| Email                       | `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`                                                       |
| Image upload                | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`                                           |
| Support retention/lifecycle | `SUPPORT_CHAT_RETENTION_DAYS`, `ASSISTANT_CHAT_IDLE_TIMEOUT_MINUTES`, `ASSISTANT_CHAT_IDLE_SWEEP_INTERVAL_MS`    |
| Abuse protection            | Authentication, password-reset, chat, suggestion, and contact-form `*_RATE_LIMIT` / `*_RATE_WINDOW_MS` variables |
| Public contact details      | `CONTACT_EMAIL` and the `CONTACT_*_URL` variables                                                                |
| Contact email copy          | `CONTACT_REPLY_SUBJECT_EN`, `CONTACT_REPLY_SUBJECT_DE`, `CONTACT_REPLY_FOOTER_EN`, `CONTACT_REPLY_FOOTER_DE`     |

To create the first Supervisor, register the account normally, set its email, and restart the server:

```env
SUPER_ADMIN_EMAIL=owner@example.com
```

The matching existing account is promoted during server startup.

### Run locally

Start both workspaces:

```bash
npm run dev
```

- Web application: `http://localhost:3000`
- REST API: `http://localhost:4000`
- API health response: `http://localhost:4000/`

## Available scripts

| Command                | Description                                     |
| ---------------------- | ----------------------------------------------- |
| `npm run dev`          | Start the client and server in development mode |
| `npm run dev:client`   | Start only the Next.js client                   |
| `npm run dev:server`   | Start only the Express API                      |
| `npm run typecheck`    | Type-check both workspaces                      |
| `npm run lint`         | Run the client ESLint configuration             |
| `npm run format`       | Format the repository with Prettier             |
| `npm run format:check` | Check formatting without changing files         |
| `npm run build`        | Build the server, then the client               |
| `npm run start:client` | Start the production client build               |
| `npm run start:server` | Build and start the production API              |

For a local production run:

```bash
npm run build
```

Then start the two processes separately:

```bash
npm run start:client
npm run start:server
```

## Application routes

| Route               | Access        | Purpose                                                   |
| ------------------- | ------------- | --------------------------------------------------------- |
| `/`                 | Public        | Aurora Focus landing page and interactive product preview |
| `/login`            | Public        | Sign in                                                   |
| `/register`         | Public        | Create a customer account                                 |
| `/forgot-password`  | Public        | Request a password-reset link                             |
| `/reset-password`   | Public        | Set a new password                                        |
| `/contact`          | Public        | Contact form and public information                       |
| `/dashboard`        | Authenticated | Local-time queue brief, SLA risk, and upcoming schedule   |
| `/tickets`          | Authenticated | The signed-in account's own requests                      |
| `/assistant`        | Authenticated | Private AI Request Assistant and confirmed drafts         |
| `/account`          | Authenticated | Profile, appearance, security, and sessions               |
| `/admin`            | Staff         | Operational overview                                      |
| `/admin/tickets`    | Staff         | Cross-customer ticket queue                               |
| `/admin/users`      | Staff         | Customer and staff account management                     |
| `/admin/users/[id]` | Staff         | Account details and request history                       |
| `/admin/support`    | Staff         | Human-support queue and conversations                     |
| `/admin/contact`    | Staff         | Contact inbox and replies                                 |

## API

| Base path        | Purpose                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------- |
| `/auth`          | Authentication, profile, password, and active sessions                                      |
| `/tickets`       | Authenticated customer's ticket CRUD, filters, pagination, summary, and time-zone dashboard |
| `/admin/tickets` | Staff queue search/filter/pagination and authorised ticket operations                       |
| `/assistant`     | Private conversations, request drafts, confirmation, and dismissal                          |
| `/chat`          | Guest guidance, authenticated assistant chat, human escalation, and staff queue operations  |
| `/contact`       | Public submissions and staff replies                                                        |
| `/admin`         | Operational overview and account administration                                             |

Protected requests use the in-memory access token:

```http
Authorization: Bearer ACCESS_TOKEN
```

Successful responses generally follow:

```json
{
  "success": true,
  "data": {}
}
```

Errors generally follow:

```json
{
  "success": false,
  "message": "Request failed"
}
```

## Deployment

Karino Desk is designed for a separately deployed Next.js client and Express API while keeping browser traffic same-origin through the Next.js rewrite.

### Render API

Create a Render Web Service from the repository and keep the repository root as the service root.

- Runtime: Node
- Build command: `npm ci && npm run build --workspace server`
- Start command: `node server/dist/app.js`
- Health check path: `/`
- Node version: `24` or later

Set at least `NODE_ENV=production`, `MONGO_URI`, both JWT secrets, `APP_URL`, and `TRUST_PROXY_HOPS`. Render supplies `PORT`. Add the optional provider, Brevo, Cloudinary, retention, rate-limit, and contact variables only when those features are configured.

`APP_URL` must be the public client origin, for example `https://your-project.vercel.app`, without a trailing slash. Set `TRUST_PROXY_HOPS` to the exact number of trusted proxies in front of Express; the bundled deployment expects one trusted hop.

### Vercel client

Create a Vercel project from the same repository:

- Root Directory: `client`
- Framework: Next.js
- Node version: `24`
- Environment variable: `API_SERVER_URL=https://your-render-service.onrender.com`

Do not append `/api` to `API_SERVER_URL`; the rewrite removes the browser-side `/api` prefix before forwarding. If the Render hostname changes, update `API_SERVER_URL` in Vercel and redeploy so the new rewrite configuration is built.

## Security and production notes

- Use long, random, different access and refresh JWT secrets.
- Access tokens are short-lived and held in client memory rather than persistent browser storage.
- Refresh tokens rotate in an HTTP-only, `SameSite=Lax` cookie; production cookies are marked `Secure`.
- Refresh-token reuse detection revokes the affected session family.
- Active-session validation prevents a stale access token from bypassing logout, account bans, deletion, or role changes.
- Passwords are hashed with bcrypt; request bodies and query parameters are validated with Zod.
- Authentication, password reset, chat, AI suggestion, and contact routes have dedicated rate limits.
- The default rate-limit store is process-local. Use a shared store such as Redis before horizontally scaling the API.
- Set `TRUST_PROXY_HOPS` precisely; do not trust an arbitrary proxy chain.
- Verify the Brevo sender before enabling transactional email.
- Keep `.env`, provider keys, JWT secrets, MongoDB credentials, Brevo credentials, and Cloudinary secrets out of version control.
- Use HTTPS and a production MongoDB deployment before exposing the service publicly.
- Review `SUPPORT_CHAT_RETENTION_DAYS` and the assistant idle settings against your privacy and retention requirements.

## Compatibility note

The MongoDB collection and Mongoose model intentionally retain the internal `Task` name, and a few response keys still use `task`/`tasks`, so existing data and older clients remain valid. `/tickets` and `/admin/tickets` are the canonical API aliases; legacy `/tasks`, `/admin/tasks`, and `/admin/users/:id/tasks` endpoints remain available. In the web application, `/tasks` and `/admin/tasks` preserve the query string and redirect to `/tickets` and `/admin/tickets`.
