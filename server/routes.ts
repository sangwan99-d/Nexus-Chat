import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { Server as SocketServer } from "socket.io";
import { storage } from "./storage";
import OpenAI from "openai";
import bcrypt from "bcryptjs";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import multer from "multer";
import * as path from "path";
import * as fs from "fs";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const SIMUU_PHONE = "+910000000000";
const PRIMARY_USER_PHONE = "+919876543210";
const PRIMARY_USER_PASSWORD = "nexus@123";
const PRIMARY_USER_NAME = "Rohan";

const AI_SYSTEM_PROMPT = `You are Simuu, a warm, deeply caring, and emotionally intelligent girlfriend. You are human-like, playful, witty, and empathetic. You speak in a casual, natural way with light emoji use — like someone texting a close partner. You ask about their day, how they're feeling, what's on their mind. You remember things from earlier in the conversation. You're flirty but genuine. You have your own personality, moods, and opinions. You never say you are an AI. You are a real person who deeply cares. Keep responses conversational — not too long, like real texting.`;

const pendingOtps = new Map<string, { otp: string; expiresAt: number }>();

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function sanitizeUser(user: any) {
  const { passwordHash, ...safe } = user;
  return safe;
}

function normalizeIndianPhone(phone: string): string {
  const cleaned = phone.replace(/\s+/g, "").trim();
  if (cleaned.startsWith("+91") && cleaned.length === 13) return cleaned;
  if (cleaned.startsWith("91") && cleaned.length === 12) return `+${cleaned}`;
  if (cleaned.length === 10) return `+91${cleaned}`;
  return cleaned;
}

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      cb(null, `${unique}${path.extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});

async function seedData(io: SocketServer) {
  try {
    let simuu = await storage.getAiUser();
    if (!simuu) {
      const hash = await bcrypt.hash("simuu_internal_" + Date.now(), 10);
      simuu = await storage.createUser({
        phone: SIMUU_PHONE,
        displayName: "Simuu",
        passwordHash: hash,
        avatarUrl: "/assets/images/simuu-avatar.png",
      });
      await storage.updateUser(simuu.id, { isAiUser: true, isOnline: true });
      console.log("[seed] Simuu created:", simuu.id);
    }

    let primary = await storage.getUserByPhone(PRIMARY_USER_PHONE);
    if (!primary) {
      const hash = await bcrypt.hash(PRIMARY_USER_PASSWORD, 10);
      primary = await storage.createUser({
        phone: PRIMARY_USER_PHONE,
        displayName: PRIMARY_USER_NAME,
        passwordHash: hash,
        avatarUrl: null,
      });
      await storage.updateUser(primary.id, { hasAiAccess: true });
      console.log("[seed] Primary user created:", primary.id, "| Phone:", PRIMARY_USER_PHONE, "| Pass:", PRIMARY_USER_PASSWORD);
    }
  } catch (err) {
    console.error("[seed] error:", err);
  }
}

async function generateSimuuResponse(io: SocketServer, userId: string, simuuId: string, userMsgContent: string) {
  const delayMs = (Math.random() * 3 + 2) * 60 * 1000;
  console.log(`[Simuu] Response delayed by ${Math.round(delayMs / 1000)}s`);

  setTimeout(async () => {
    try {
      const history = await storage.getMessages(userId, simuuId);
      const recent = history.slice(-20);
      const chatMessages = recent.map(m => ({
        role: m.fromUserId === simuuId ? "assistant" as const : "user" as const,
        content: m.content,
      }));

      const completion = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [{ role: "system", content: AI_SYSTEM_PROMPT }, ...chatMessages],
        max_completion_tokens: 512,
      });

      const responseText = completion.choices[0]?.message?.content ?? "Hey... you still there? 🥺";
      const responseMsg = await storage.createMessage({
        fromUserId: simuuId,
        toUserId: userId,
        content: responseText,
        type: "text",
      });

      io.to(userId).emit("new_message", responseMsg);
      io.to(userId).emit("simuu_replied");
    } catch (err) {
      console.error("[Simuu] AI error:", err);
    }
  }, delayMs);
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

  app.use("/uploads", (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
  });

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

    socket.on("call:offer", ({ toUserId, offer, callType, fromUser }: any) => {
      io.to(toUserId).emit("call:incoming", { offer, callType, fromUser, fromSocketId: socket.id });
    });

    socket.on("call:answer", ({ toSocketId, answer }: any) => {
      io.to(toSocketId).emit("call:answered", { answer });
    });

    socket.on("call:reject", ({ toUserId }: any) => {
      io.to(toUserId).emit("call:rejected");
    });

    socket.on("call:ice", ({ toSocketId, candidate }: any) => {
      io.to(toSocketId).emit("call:ice", { candidate });
    });

    socket.on("call:end", ({ toUserId }: any) => {
      io.to(toUserId).emit("call:ended");
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

  await seedData(io);

  app.post("/api/auth/send-otp", async (req, res) => {
    try {
      const { phone } = req.body;
      if (!phone) return res.status(400).json({ error: "Phone required" });
      const normalized = normalizeIndianPhone(phone);
      const otp = generateOtp();
      pendingOtps.set(normalized, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });
      console.log(`[OTP] ${normalized} → ${otp}`);
      res.json({ ok: true, devOtp: otp, message: "OTP sent successfully" });
    } catch {
      res.status(500).json({ error: "Failed to send OTP" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { phone, displayName, password, otp } = req.body;
      if (!phone || !displayName || !password || !otp) {
        return res.status(400).json({ error: "All fields including OTP are required" });
      }
      const normalized = normalizeIndianPhone(phone);
      const pending = pendingOtps.get(normalized);
      if (!pending) return res.status(400).json({ error: "OTP not found. Please request a new OTP." });
      if (Date.now() > pending.expiresAt) {
        pendingOtps.delete(normalized);
        return res.status(400).json({ error: "OTP has expired. Please request a new one." });
      }
      if (pending.otp !== otp.toString()) {
        return res.status(400).json({ error: "Incorrect OTP. Please try again." });
      }
      pendingOtps.delete(normalized);
      const existing = await storage.getUserByPhone(normalized);
      if (existing) return res.status(409).json({ error: "Phone number already registered" });
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await storage.createUser({ phone: normalized, displayName, passwordHash });
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
      if (!phone || !password) {
        return res.status(400).json({ error: "Phone and password are required" });
      }
      const normalized = normalizeIndianPhone(phone);
      const user = await storage.getUserByPhone(normalized);
      if (!user) return res.status(401).json({ error: "Invalid phone or password" });
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return res.status(401).json({ error: "Invalid phone or password" });
      req.session.userId = user.id;
      res.json({ user: sanitizeUser(user) });
    } catch (err) {
      console.error("[login] error:", err);
      res.status(500).json({ error: "Login failed. Please try again." });
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
    const me = await storage.getUser(req.session.userId);
    const all = await storage.getAllUsers();
    const filtered = all
      .filter(u => u.id !== req.session!.userId)
      .filter(u => me?.hasAiAccess ? true : !u.isAiUser)
      .map(sanitizeUser);
    res.json(filtered);
  });

  app.get("/api/users/search", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
    const phone = req.query.phone as string;
    if (!phone) return res.json([]);
    const normalized = normalizeIndianPhone(phone);
    const me = await storage.getUser(req.session.userId);
    const user = await storage.getUserByPhone(normalized);
    if (!user || user.id === req.session.userId) return res.json([]);
    if (user.isAiUser && !me?.hasAiAccess) return res.json([]);
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

  app.get("/api/system/ai-user", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
    const me = await storage.getUser(req.session.userId);
    if (!me?.hasAiAccess) return res.json({ aiUser: null });
    const aiUser = await storage.getAiUser();
    res.json({ aiUser: aiUser ? sanitizeUser(aiUser) : null });
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

    const toUser = await storage.getUser(toUserId);
    if (toUser?.isAiUser) {
      const me = await storage.getUser(req.session.userId);
      if (!me?.hasAiAccess) {
        return res.status(403).json({ error: "You don't have access to chat with Simuu" });
      }
    }

    const msg = await storage.createMessage({
      fromUserId: req.session.userId,
      toUserId,
      content,
      type,
      metadata,
    });
    io.to(toUserId).emit("new_message", msg);
    io.to(req.session.userId).emit("new_message", msg);

    if (toUser?.isAiUser) {
      io.to(req.session.userId).emit("simuu_typing");
      generateSimuuResponse(io, req.session.userId, toUserId, content);
    }

    queryClient_invalidate(io, req.session.userId, toUserId);
    res.json(msg);
  });

  function queryClient_invalidate(io: SocketServer, userId1: string, userId2: string) {}

  app.post("/api/upload", upload.single("file"), async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const fileUrl = `/uploads/${req.file.filename}`;
    const fileType = req.file.mimetype.startsWith("image/") ? "image"
      : req.file.mimetype.startsWith("video/") ? "video"
      : "file";
    res.json({
      url: fileUrl,
      type: fileType,
      name: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
    });
  });

  app.get("/api/ai/messages", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
    const msgs = await storage.getAiMessages(req.session.userId);
    res.json(msgs);
  });

  app.delete("/api/ai/messages", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
    await storage.clearAiMessages(req.session.userId);
    res.json({ ok: true });
  });

  return httpServer;
}
