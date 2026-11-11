---
title: Security headers check
description: Audits HTTP security headers on a site and explains each fix.
author: priya
stack: Any
tags: [security, web]
stars: 17
---
# Security headers check

Audits HTTP security headers on a site and explains each fix.

## When to use

Use this skill when checking a web app's response headers before launch.

## Steps

1. Fetch the main pages and record their response headers.
2. Check Content-Security-Policy, Strict-Transport-Security and X-Content-Type-Options.
3. Check cookies use Secure, HttpOnly and a SameSite value.
4. Explain each missing header in one sentence: what attack it prevents.
5. Give the exact configuration to add for the app's framework.

## Output

A header report with pass or fail per header and the configuration to fix it.
