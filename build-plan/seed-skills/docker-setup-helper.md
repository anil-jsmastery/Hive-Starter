---
title: Docker setup helper
description: Creates a Dockerfile and compose file for a Node or Python app, with small images.
author: nora
stack: Any
tags: [docker, devops]
stars: 31
---
# Docker setup helper

Creates a Dockerfile and compose file for a Node or Python app, with small images.

## When to use

Use this skill when containerizing an app for local development or deployment.

## Steps

1. Detect the language, package manager and start command.
2. Write a multi-stage Dockerfile that installs dependencies before copying source.
3. Run as a non-root user and add a .dockerignore.
4. Add a compose file with the app and any database it needs.
5. Document the build and run commands in three lines.

## Output

A Dockerfile, a .dockerignore, a docker-compose.yml and run instructions.
