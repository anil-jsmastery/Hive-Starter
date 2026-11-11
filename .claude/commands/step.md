---
description: Build one Hive step from build-plan/, exactly as written
argument-hint: <step number or file name> [extra instructions]
---

Arguments: $ARGUMENTS

The first word of the arguments is the step to build: a number such as `07`, or a file name such as `07-landing.md`. Use the one file in `build-plan/` whose name starts with that number (`07` means `build-plan/07-landing.md`). Everything after the first word is extra instructions from the user: follow them as well, after the instructions below. If there are no arguments, or no file matches, ask which step to build and stop.

**If the step is 00:** Read build-plan/00-project-setup.md and do Step 00 exactly as written, from start to finish. Copy every block marked VERBATIM without changes. If a step needs a login, a dashboard or a choice only I can make, stop and tell me exactly what to do, then wait. When you're done, run the checks, report each one as pass or fail, and commit if every check passes.

**For every other step:** Read that step's file in build-plan/. Implement that step exactly as written: every file path, component name, label, piece of copy and rule. Copy every block marked VERBATIM without changes. Use the Clerk, Supabase and PostHog MCP servers and skills only for what this step asks. Do not start any other step, do not add or upgrade packages, and do not change files from earlier steps unless this step says so. When you finish, run this step's checks, report each one as pass or fail, append this step's memory block to MEMORY.md, and commit if every check passes.
