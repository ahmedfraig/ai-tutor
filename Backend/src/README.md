# Node API

Express API for non-AI application data.

## Purpose

This service owns classic app backend concerns:

- Authentication
- Users
- Lessons
- User lessons
- Stored AI generations

## Main File

- `app.js`: Express app setup and route registration.

## Subfolders

- `config`: Database connection.
- `controllers`: Request handlers.
- `middleware`: Authentication middleware.
- `routes`: Express route definitions.

## Models

This service does not load AI models. It uses PostgreSQL through the configured database connection.
