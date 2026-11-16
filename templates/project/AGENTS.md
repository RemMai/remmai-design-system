# Business project RMDL agent policy

This project uses RMDL. Before changing files:

Repeat these checks in every new session and after context recovery. Read `vendor/rmdl/policy/session-baseline.md`, `VERSION`, `CHANGELOG.md` and the actual Git status; conversation memory is not the source of truth. Keep `opencode.json` from this template at the business project root so OpenCode loads the baseline explicitly.

1. Read `rmdl.project.json`; do not implement until governance is locked (unless performing an owner-approved initial selection or read-only refactor audit).
2. Read `vendor/rmdl/AGENTS.md`, `vendor/rmdl/RMDL.md` and the relevant contracts under `vendor/rmdl/docs/`. The local copy/submodule must be pinned to a reviewed RMDL version.
   - Engineered JavaScript projects use Node.js LTS + npm, not Bun. Pin Node.js/npm versions, commit one `package-lock.json` per npm workspace and use `npm ci` in CI; run scripts with `npm run`. A locked `static-html` tool does not require a JavaScript build toolchain.
3. For UI changes, inspect the installed `@OWNER/rmdl-ui` exports and `vendor/rmdl/registry/components.json`. Reuse approved, published public components, and never implement a parallel design system.
   - Zero-Slop Rule: Strictly forbid echoing user prompts or adding "Feature Overview", "How to use", or promotional cards at the bottom/margins. Build a dense operational console, not a marketing landing page.
   - Admin Layout Rule: Keep header and left sidebar menu fixed without page scrolling (`100vh; overflow: hidden`). The right content area below header scrolls independently (`overflow-y: auto`) on overflow. Dock user profile/logout actions at the bottom of the left menu.
4. For .NET backend authentication/authorization (Local RBAC or Authentik OAuth/OIDC), use `vendor/rmdl/packages/dotnet/RemMai.Rmdl.Auth` directly. Do not hand-roll custom OAuth/JWT flows. Configure via `appsettings.json` under `Auth` and map via `AddRmdlAuth()` & `MapRmdlAuthEndpoints()`. Must enable `app.UseRmdlSpaAuthGuard()` to automatically 302 redirect unauthenticated visitors to `/login?redirect=...` and strictly prevent direct unauthorized access to internal page layouts.
5. Scope changes to the requested business feature. Never edit `vendor/rmdl`, package policy, locked decisions, golden visual baselines, or the RMDL UI package without express owner authorization.
6. Run the actual project static gate, typecheck, lint, tests, build and relevant visual tests. Report PASS/FAIL/NOT RUN truthfully.
7. Pass this policy, scope and acceptance criteria explicitly to all child agents.

8. .NET applications target **net11.0** with an exact stable 11.x SDK pinned in root `global.json`. Frontend and backend bind the product version from root `VERSION` (MAJOR.MINOR.PATCH), and each build embeds its real full Git commit. Follow `vendor/rmdl/docs/16-产品版本与构建标识.md`; generate metadata with `node vendor/rmdl/scripts/rmdl.mjs version --root .` (`--release` for clean release builds).
9. Display `Version x.y.z` using this priority: **Footer > left Menu bottom > Header right > dedicated changelog menu page**. Keep user/logout actions at the sidebar bottom. The changelog page must show the current version and real changelog; verify placement and metadata binding in browser/artifact tests.

When instructions conflict, stop the affected action and ask the project owner to approve the exception. Agent-authored ADRs are not owner approval.
