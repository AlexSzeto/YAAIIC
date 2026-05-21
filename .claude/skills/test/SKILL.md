---
name: test
description: Runs the vitest suite and reports pass/fail counts plus any failure output. USE FOR: verifying tests pass after code changes; checking test health before a PR; running tests on demand.
---

# Run Tests

Run `npx vitest run` from the project root and capture the output.

1. Execute: `npx vitest run`
2. Parse the output to find pass/fail counts and any failure messages.
3. Report a concise summary:
   - Total tests run, how many passed, how many failed.
   - For each failure: the test name, the file it lives in, and the assertion that failed.
4. If all tests pass, say so and stop.
5. If any tests fail, display the failure output and ask the user how to proceed.
