---
title: Server Actions review
description: Reviews Next.js Server Actions for auth checks, validation and safe error handling.
author: kenji
stack: Next.js
tags: [nextjs, server-actions, security]
stars: 24
---
# Server Actions review

Reviews Next.js Server Actions for auth checks, validation and safe error handling.

## When to use

Use this skill when adding or reviewing Server Actions in a Next.js app.

## Steps

1. Check every action verifies the user before doing anything.
2. Check input is validated on the server with a schema, never trusted from the form.
3. Check the action can't change data the user doesn't own.
4. Check errors return a friendly message without leaking internals.
5. Check the right paths are revalidated after a successful change.

## Output

A list of actions with pass or fail per check, and fixes.
