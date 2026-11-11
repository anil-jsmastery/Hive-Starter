---
title: Product analytics event review
description: Reviews a tracking plan so every event answers a question and informs a decision.
author: priya
stack: Any
tags: [analytics, posthog, tracking]
stars: 25
---
# Product analytics event review

Reviews a tracking plan so every event answers a question and informs a decision.

## When to use

Use this skill when adding analytics events, or auditing an app that tracks too much.

## Steps

1. List every event the app sends and where it's sent from.
2. For each event, write the question it answers and the decision it informs.
3. Flag events with no decision attached: they cost money and add noise.
4. Check names follow one pattern, for example object_action in snake_case.
5. Check important actions are sent from the server, where they can't be lost.

## Output

A tracking plan table, plus events to remove, rename or move to the server.
