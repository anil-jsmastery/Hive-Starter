---
title: Structured logging for Node
description: Sets up structured JSON logging in a Node service with request ids and log levels.
author: sam
stack: Node.js
tags: [node, logging, observability]
stars: 10
---
# Structured logging for Node

Sets up structured JSON logging in a Node service with request ids and log levels.

## When to use

Use this skill when a Node service logs plain strings that are hard to search.

## Steps

1. Replace console calls with a structured logger that writes JSON.
2. Add a request id to every log line in a request.
3. Use levels consistently: error for failures, info for key events, debug for detail.
4. Never log secrets, tokens or full request bodies.
5. Show how to read the logs locally in a readable format.

## Output

A logger module, the changes to use it, and a short usage guide.
