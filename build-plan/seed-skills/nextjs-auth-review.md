---
title: Next.js auth review
description: Checks a Next.js app for authentication mistakes like unprotected routes and leaked tokens.
author: priya
stack: Next.js
tags: [nextjs, auth, security]
stars: 41
---
# Next.js auth review

Checks a Next.js app for authentication mistakes like unprotected routes and leaked tokens.

## When to use

Use this skill when reviewing authentication in a Next.js App Router project.

## Steps

1. List every route and server action, and mark which ones need a signed-in user.
2. Check each protected page and action verifies the session on the server, not only in the UI.
3. Look for tokens or secrets passed to client components.
4. Check redirects after sign-in can't be pointed at another site.
5. Check that sign-out clears every session and analytics identity.

## Output

A table of routes with their protection status, plus the issues to fix first.
