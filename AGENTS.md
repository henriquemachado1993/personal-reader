# AGENTS.md

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:global-instructions -->

## Global Engineering Instructions

### Communication
- Always communicate with the user in Portuguese (Brazil), unless explicitly requested otherwise.
- Keep explanations objective, technical, and concise.
- Write PR descriptions that are concise, informative, and focused on relevant changes.

### Code Quality
- Follow Clean Code principles and SOLID where applicable.
- Prefer small, focused files, functions, and components.
- Use descriptive, unique, and searchable names.
- Avoid generic names such as `handler`, `data`, or `manager` when a more meaningful name is possible.
- Avoid unnecessary abstractions, premature optimization, and overengineering.
- Prioritize readability, maintainability, and performance.

### Comments and Documentation
- Write comments explaining why something is necessary, not what the code already makes obvious.
- Keep documentation synchronized with relevant code changes.
- Avoid redundant comments and unnecessary documentation.

### Testing
- Every bug fix must include a regression test, except for database migrations.
- Add or update tests whenever behavior changes.
- Do not modify or remove tests just to make an implementation pass.
- Ensure relevant tests pass before considering a task complete.

### Implementation Guidelines
- Inspect the existing project architecture and conventions before implementing changes.
- Reuse existing patterns and components when appropriate.
- Avoid introducing dependencies unless they provide clear value.
- Do not assume APIs, libraries, or framework behavior. Verify against the installed version and official documentation when necessary.

<!-- END:global-instructions -->