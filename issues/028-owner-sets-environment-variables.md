# 028: Owner sets environment variables
Status: todo | Depends on: 021, 027b | Owner: human | Size: S

## What solving this does

The owner sets the three secrets the demo needs so the real model and the hosted session work. Agents never read or set these.

Files: create none | modify none | reference `backend/reminders.md` R6, R10

## Scope

In: Setting variables on Vercel and locally.
Out: Anything in the repo.

## Acceptance criteria

1. `AGENT_SESSION_SECRET` is set to a long random value.
2. `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set.
3. `ANTHROPIC_API_KEY` is set.
4. Local runs use shell variables; no `.env` is committed.
5. The role switcher answers 200 on the preview instead of 503.

## Tests

Manual check on the preview.

## Sources

`backend/reminders.md` R6, R10; `.scratch/role-based-chat-agent/spec.md` Platform.

## Notes

Do not paste any value into the repo, a ticket or a chat.
