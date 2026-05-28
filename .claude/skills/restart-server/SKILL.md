---
name: restart-server
description: Restarts the YAAIIC server via PM2 and waits for it to come back up. USE FOR: applying server-side code changes without manually killing and restarting the process; recovering from a hung state; confirming the server is healthy after a restart.
---

# Restart Server

Restart the running YAAIIC server cleanly and confirm it comes back up.

## Steps

1. **Read the port** — check `server/config.json` for `serverPort`; default to `3000` if absent or unreadable.

2. **Restart via PM2** — run `pm2 restart yaaiic`.
   - If the command fails (process not found, PM2 not running, etc.), report the error and stop.

3. **Wait for the server to come back** — poll `GET http://localhost:<port>/status` every 2 seconds for up to 30 seconds.
   - On any successful 200 response, the server is back up.
   - If 30 seconds elapse with no response, report that the server did not come back up and suggest checking `pm2 logs yaaiic`.

4. **Report the result** — one line: either "Server restarted and back up." or a clear failure message with next steps.

## Constraints

- Use `curl` for polling the status endpoint.
- Do not touch any source files.
- Do not attempt to start the server manually (e.g. `node` or `npm start`) — that is PM2's job.
