# Bkper In-App Calculator

## Overview

A small client-side Bkper app that opens from a Book's More menu in the Bkper sidebar. It authenticates the user, reads the current Book's decimal separator and fraction digits, and provides an exact-decimal calculator without writing to the Book.

The server Worker only serves built client assets, provides `/health`, and explicitly rejects `/api/*` and `/events`. There are no transactions, accounts, events, custom API routes, KV services, or persistent app data.

## Domain rules

- Never write accounting data for this app.
- Treat Book number-format settings as required; do not calculate without them.
- Use exact decimal arithmetic, not JavaScript floating-point arithmetic.
- Use the Book's decimal separator as the authoritative locale for grouped input.
- Match Bkper output formatting: configured fraction digits and decimal separator, without thousands grouping.
- Preserve full precision during one expression and round only the final displayed result.
- A chained calculation starts from the visible rounded result.

## Client structure

```text
client/src/
├── index.ts                  — Browser entrypoint
├── web-awesome.ts            — Registered Web Awesome components
├── components/my-app.ts      — Calculator UI and user interactions
├── app/                      — Authentication and Book-loading lifecycle
├── auth/                     — @bkper/web-auth boundary
├── calculator/               — Safe parser, exact arithmetic, formatting, history
└── services/book-service.ts  — Read current Book settings through bkper-js
```

Use `@bkper/web-auth` for authentication and `bkper-js` for Bkper reads. Do not implement custom OAuth, token refresh, or direct REST calls.

## UI

The calculator is a sidebar panel, not a full `<wa-page>` application shell. Use Web Awesome components and `@bkper/web-design` tokens. The UI must work with both light and dark Bkper themes. Before UI changes, read:

- `.agents/skills/webawesome/SKILL.md`
- `.agents/skills/webawesome-design/SKILL.md`

Use accessible labels, real headings, `<wa-icon>` instead of emojis, and documented Web Awesome component styling APIs.

## Testing and verification

Write focused unit tests first for parser behavior, locale parsing, exact arithmetic, formatting, Book-loading states, history, and key UI states. Avoid tests that touch real Bkper data.

Run the deterministic check before considering changes complete:

```bash
bun run check
```

The check typechecks client and server, runs unit tests, builds the Vite client and Worker, verifies UI baseline requirements, and checks formatting.

## Development and deployment

```bash
bun install
bun run dev
bun run build
bun run deploy:preview
```

The app is initially restricted in `bkper.yaml` to `*@bkper.com`; production publication can be considered after preview testing.
