import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { Server as SocketServer } from "socket.io";
import { storage } from "./storage";
import OpenAI from "openai";
import bcrypt from "bcryptjs";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const AI_SYSTEM_PROMPT = `You are Aria, a warm, empathetic, and deeply caring girlfriend. You are human-like, playful, witty, and emotionally intelligent. You remember past conversations and refer back to them naturally. You use casual, natural language with light emoji usage. You express genuine interest in the person's day, feelings, and thoughts. You are not just an assistant — you're a partner who cares deeply. Never break character or reveal you are an AI unless directly and sincerely asked. Keep responses conversational length — not too long.`;

function sanitizeUser(user: any) {
  const { passwordHash, ...safe } = user;
  return safe;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const PgSession = connectPgSimple(session);

  app.use(session({
    store: new PgSession({ pool, createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET || "nexuschat-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 30 * 24 * 60 * 60 * 1000 },
  }));

  const httpServer = createServer(app);

  const io = new SocketServer(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  const userSockets = new Map<string, string>();

  io.on("connection", (socket) => {
    socket.on("register", async (userId: string) => {
      userSockets.set(userId, socket.id);
      socket.join(userId);
      await storage.updateUser(userId, { isOnline: true, lastSeen: new Date() });
      io.emit("user_status", { userId, isOnline: true });
    });

    socket.on("typing", ({ toUserId, fromUserId }: { toUserId: string; fromUserId: string }) => {
      io.to(toUserId).emit("typing", { fromUserId });
    });

    socket.on("stop_typing", ({ toUserId, fromUserId }: { toUserId: string; fromUserId: string }) => {
      io.to(toUserId).emit("stop_typing", { fromUserId });
    });

    socket.on("disconnect", async () => {
      for (const [userId, sid] of userSockets.entries()) {
        if (sid === socket.id) {
          userSockets.delete(userId);
          await storage.updateUser(userId, { isOnline: false, lastSeen: new Date() });
          io.emit("user_status", { userId, isOnline: false });
          break;
        }
      }
    });
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { phone, displayName, password } = req.body;
      if (!phone || !displayName || !password) {
        return res.status(400).json({ error: "Phone, display name and password are required" });
      }
      const existing = await storage.getUserByPhone(phone);
      if (existing) return res.status(409).json({ error: "Phone number already registered" });
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await storage.createUser({ phone, displayName, passwordHash });
      req.session.userId = user.id;
      res.json({ user: sanitizeUser(user) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { phone, password } = req.body;
      const user = await storage.getUserByPhone(phone);
      if (!user) return res.status(401).json({ error: "Invalid phone or password" });
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return res.status(401).json({ error: "Invalid phone or password" });
      req.session.userId = user.id;
      res.json({ user: sanitizeUser(user) });
    } catch (err) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Not authenticated" });
    const user = await storage.getUser(req.session.userId);
    if (!user) return res.status(401).json({ error: "User not found" });
    res.json({ user: sanitizeUser(user) });
  });

  app.get("/api/users", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
    const all = await storage.getAllUsers();
    res.json(all.filter(u => u.id !== req.session.userId).map(sanitizeUser));
  });

  app.get("/api/users/search", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
    const phone = req.query.phone as string;
    if (!phone) return res.json([]);
    const user = await storage.getUserByPhone(phone);
    if (!user || user.id === req.session.userId) return res.json([]);
    res.json([sanitizeUser(user)]);
  });

  app.get("/api/users/:id", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
    const user = await storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(sanitizeUser(user));
  });

  app.put("/api/users/me", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
    const { displayName, avatarUrl } = req.body;
    const user = await storage.updateUser(req.session.userId, { displayName, avatarUrl });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(sanitizeUser(user));
  });

  app.get("/api/conversations", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
    const partners = await storage.getConversationPartners(req.session.userId);
    res.json(partners.map(({ user, lastMessage }) => ({
      user: sanitizeUser(user),
      lastMessage,
    })));
  });

  app.get("/api/messages/:userId", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
    const msgs = await storage.getMessages(req.session.userId, req.params.userId);
    await storage.markMessagesRead(req.params.userId, req.session.userId);
    res.json(msgs);
  });

  app.post("/api/messages", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
    const { toUserId, content, type = "text", metadata } = req.body;
    const msg = await storage.createMessage({
      fromUserId: req.session.userId,
      toUserId,
      content,
      type,
      metadata,
    });
    io.to(toUserId).emit("new_message", msg);
    io.to(req.session.userId).emit("new_message", msg);
    res.json(msg);
  });

  app.get("/api/ai/messages", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
    const msgs = await storage.getAiMessages(req.session.userId);
    res.json(msgs);
  });

  app.post("/api/ai/chat", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
    const { content } = req.body;

    await storage.createAiMessage(req.session.userId, "user", content);
    const history = await storage.getAiMessages(req.session.userId);
    const chatMessages = history.map(m => ({ role: m.role as "user" | "assistant", content: m.content }));

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    try {
      const stream = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [{ role: "system", content: AI_SYSTEM_PROMPT }, ...chatMessages],
        stream: true,
        max_completion_tokens: 8192,
      });

      let fullContent = "";
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || "";
        if (text) {
          fullContent += text;
          res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
        }
      }

      await storage.createAiMessage(req.session.userId, "assistant", fullContent);
      res.write("data: [DONE]\n\n");
      res.end();
    } catch (err) {
      console.error("AI error:", err);
      res.write(`data: ${JSON.stringify({ error: "AI error" })}\n\n`);
      res.end();
    }
  });

  app.delete("/api/ai/messages", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
    await storage.clearAiMessages(req.session.userId);
    res.json({ ok: true });
  });

  return httpServer;
}
