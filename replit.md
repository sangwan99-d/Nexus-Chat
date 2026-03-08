# NexusChat: AI-Hybrid Messenger

A full-stack mobile-first chat application built with Expo React Native and Express.

## Architecture

**Frontend:** Expo Router (React Native) — file-based routing
**Backend:** Express + Socket.io — real-time messaging
**Database:** PostgreSQL via Drizzle ORM
**AI:** OpenAI GPT-5.2 via Replit AI Integrations (no API key needed)

## Features

- **Phone-based Auth** — Register/login with mobile number + password (sessions via express-session + connect-pg-simple)
- **AI Girlfriend "Aria"** — Streaming chat with a human-like AI persona (GPT-5.2, remembers full conversation history)
- **P2P Messaging** — Real-time chat via Socket.io with typing indicators and online status
- **Location Sharing** — Share GPS location in chat (expo-location)
- **Multi-Theme** — Dark, Light, Midnight, Forest, Sunset themes (persisted in AsyncStorage)
- **Profile Editing** — Change display name and avatar (image picker)
- **User Discovery** — Search registered users by phone number

## Project Structure

```
app/
  _layout.tsx         — Root layout with all context providers
  index.tsx           — Auth gate (redirects to login or tabs)
  (auth)/             — Login & Register screens (modal)
  (tabs)/             — Main tab screens (Chats + Settings)
  chat/[id].tsx       — Chat screen (P2P or AI)
  
components/
  MessageBubble.tsx   — Chat message with location support
  TypingIndicator.tsx — Animated typing dots (regular + AI variant)
  ChatInput.tsx       — Message input with location share
  ChatListItem.tsx    — Conversation list row

context/
  AuthContext.tsx     — Auth state + user operations
  ThemeContext.tsx    — Theme engine (5 themes)
  SocketContext.tsx   — Socket.io connection management

server/
  index.ts            — Express server setup
  routes.ts           — All API routes + Socket.io handlers
  storage.ts          — Database operations (DatabaseStorage)
  db.ts               — Drizzle + PostgreSQL connection

shared/
  schema.ts           — Database schema (users, messages, aiMessages)
```

## Running

- **Backend:** `npm run server:dev` (port 5000)
- **Frontend:** `npm run expo:dev` (port 8081)

## Environment

- `DATABASE_URL` — PostgreSQL connection string (auto-provisioned)
- `SESSION_SECRET` — Express session secret
- `AI_INTEGRATIONS_OPENAI_API_KEY` / `AI_INTEGRATIONS_OPENAI_BASE_URL` — Replit AI Integrations (auto-set)
