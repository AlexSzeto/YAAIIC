---
name: restart-server
description: Remotely restarts the YAAIIC server via the /admin/restart endpoint and waits for it to come back up. USE FOR: applying server-side code changes without manually killing and restarting the process; recovering from a hung state; confirming the server is healthy after a restart.
---

# Restart Server

Restart the running YAAIIC server cleanly and confirm it comes back up.

## Steps

1. **Read the port** — check `server/config.json` for `serverPort`; default to `3000` if absent or unreadable.

2. **Send the restart request** — POST to `http://localhost:<port>/admin/restart`.
   - If the request succeeds (200), the server will exit in ~100ms and PM2 will restart it.
   - If the request fails (connection refused, 404, etc.), the server is likely not running — tell the user and stop.

3. **Wait for the server to come back** — poll `GET http://localhost:<port>/status` every 2 seconds for up to 30 seconds.
   - On any successful 200 response, the server is back up.
   - If 30 seconds elapse with no response, report that the server did not come back up and suggest checking `pm2 logs yaaiic`.

4. **Report the result** — one line: either "Server restarted and back up." or a clear failure message with next steps.

## Constraints

- Use `curl` for all HTTP calls.
- Do not touch any source files.
- Do not attempt to start the server manually (e.g. `node` or `npm start`) — that is PM2's job.
