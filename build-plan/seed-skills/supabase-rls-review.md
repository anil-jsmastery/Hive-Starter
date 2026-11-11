---
title: Supabase RLS review
description: Reviews Supabase Row Level Security policies so users only see and change their own data.
author: priya
stack: Any
tags: [supabase, security, sql]
stars: 30
---
# Supabase RLS review

Reviews Supabase Row Level Security policies so users only see and change their own data.

## When to use

Use this skill when adding tables or policies to a Supabase project.

## Steps

1. Check every table in the public schema has RLS enabled.
2. For each table, list who can select, insert, update and delete.
3. Check policies compare against the authenticated user's id, not a value from the request.
4. Check inserts can't create rows owned by someone else.
5. Test each policy as an anonymous user and as two different users.

## Output

A table of policies per table, with gaps and the SQL to fix them.
