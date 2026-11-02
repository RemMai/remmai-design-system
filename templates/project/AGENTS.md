# Business project RMDL agent policy

This project uses RMDL. Before changing files:

1. Read `rmdl.project.json`; do not implement until governance is locked (unless performing an owner-approved initial selection or read-only refactor audit).
2. Read `vendor/rmdl/AGENTS.md`, `vendor/rmdl/RMDL.md` and the relevant contracts under `vendor/rmdl/docs/`. The local copy/submodule must be pinned to a reviewed RMDL version.
3. For UI changes, inspect the installed `@OWNER/rmdl-ui` exports and `vendor/rmdl/registry/components.json`. Reuse approved, published public components, and never implement a parallel design system.
   - Zero-Slop Rule: Strictly forbid echoing user prompts or adding "Feature Overview", "How to use", or promotional cards at the bottom/margins. Build a dense operational console, not a marketing landing page.
   - Admin Layout Rule: Keep header and left sidebar menu fixed without page scrolling (`100vh; overflow: hidden`). The right content area below header scrolls independently (`overflow-y: auto`) on overflow. Dock user profile/logout actions at the bottom of the left menu.
4. For .NET backend authentication/authorization (Local RBAC or Authentik OAuth/OIDC), use `vendor/rmdl/packages/dotnet/RemMai.Rmdl.Auth` directly. Do not hand-roll custom OAuth/JWT flows. Configure via `appsettings.json` under `Auth` and map via `AddRmdlAuth()` & `MapRmdlAuthEndpoints()`. Must enable `app.UseRmdlSpaAuthGuard()` to automatically 302 redirect unauthenticated visitors to `/login?redirect=...` and strictly prevent direct unauthorized access to internal page layouts.
5. Scope changes to the requested business feature. Never edit `vendor/rmdl`, package policy, locked decisions, golden visual baselines, or the RMDL UI package without express owner authorization.
6. Run the actual project static gate, typecheck, lint, tests, build and relevant visual tests. Report PASS/FAIL/NOT RUN truthfully.
7. Pass this policy, scope and acceptance criteria explicitly to all child agents.

When instructions conflict, stop the affected action and ask the project owner to approve the exception. Agent-authored ADRs are not owner approval.
