// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";

// server/storage.ts
import { randomUUID } from "crypto";
var MemStorage = class {
  sessions;
  bankrollTransactions;
  settings;
  constructor() {
    this.sessions = /* @__PURE__ */ new Map();
    this.bankrollTransactions = /* @__PURE__ */ new Map();
    this.settings = /* @__PURE__ */ new Map();
    this.setSetting("bankroll", "15000");
    this.setSetting("stopLossLimit", "500");
    this.setSetting("winGoal", "1000");
  }
  async getSessions(limit = 50, offset = 0) {
    const allSessions = Array.from(this.sessions.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return allSessions.slice(offset, offset + limit);
  }
  async getSession(id) {
    return this.sessions.get(id);
  }
  async createSession(insertSession) {
    const id = randomUUID();
    const profit = insertSession.cashOut - insertSession.buyIn;
    const hourlyRate = insertSession.hours > 0 ? profit / insertSession.hours : 0;
    const session = {
      ...insertSession,
      id,
      profit,
      hourlyRate,
      createdAt: /* @__PURE__ */ new Date()
    };
    this.sessions.set(id, session);
    await this.createBankrollTransaction({
      type: "session",
      amount: profit,
      description: `${insertSession.gameType} session at ${insertSession.location}`,
      sessionId: id
    });
    return session;
  }
  async updateSession(id, updateData) {
    const session = this.sessions.get(id);
    if (!session) return void 0;
    const updatedSession = {
      ...session,
      ...updateData,
      profit: updateData.cashOut !== void 0 && updateData.buyIn !== void 0 ? updateData.cashOut - updateData.buyIn : updateData.cashOut !== void 0 ? updateData.cashOut - session.buyIn : updateData.buyIn !== void 0 ? session.cashOut - updateData.buyIn : session.profit
    };
    if (updateData.hours !== void 0 || updateData.cashOut !== void 0 || updateData.buyIn !== void 0) {
      const hours = updateData.hours ?? session.hours;
      updatedSession.hourlyRate = hours > 0 ? updatedSession.profit / hours : 0;
    }
    this.sessions.set(id, updatedSession);
    return updatedSession;
  }
  async deleteSession(id) {
    return this.sessions.delete(id);
  }
  async searchSessions(query, filters) {
    let sessions2 = Array.from(this.sessions.values());
    if (query) {
      const lowerQuery = query.toLowerCase();
      sessions2 = sessions2.filter(
        (session) => session.location.toLowerCase().includes(lowerQuery) || session.gameType.toLowerCase().includes(lowerQuery) || session.stakes.toLowerCase().includes(lowerQuery) || session.notes?.toLowerCase().includes(lowerQuery) || session.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
      );
    }
    if (filters) {
      if (filters.location) {
        sessions2 = sessions2.filter((session) => session.location.toLowerCase().includes(filters.location.toLowerCase()));
      }
      if (filters.gameType) {
        sessions2 = sessions2.filter((session) => session.gameType === filters.gameType);
      }
      if (filters.tableType) {
        sessions2 = sessions2.filter((session) => session.tableType === filters.tableType);
      }
      if (filters.dateFrom) {
        sessions2 = sessions2.filter((session) => new Date(session.date) >= filters.dateFrom);
      }
      if (filters.dateTo) {
        sessions2 = sessions2.filter((session) => new Date(session.date) <= filters.dateTo);
      }
      if (filters.result) {
        sessions2 = sessions2.filter(
          (session) => filters.result === "win" ? session.profit > 0 : session.profit <= 0
        );
      }
    }
    return sessions2.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
  async getBankrollTransactions(limit = 50, offset = 0) {
    const allTransactions = Array.from(this.bankrollTransactions.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return allTransactions.slice(offset, offset + limit);
  }
  async createBankrollTransaction(insertTransaction) {
    const id = randomUUID();
    const transaction = {
      ...insertTransaction,
      id,
      date: /* @__PURE__ */ new Date()
    };
    this.bankrollTransactions.set(id, transaction);
    return transaction;
  }
  async getSetting(key) {
    return Array.from(this.settings.values()).find((setting) => setting.key === key);
  }
  async setSetting(key, value) {
    const existing = Array.from(this.settings.values()).find((setting) => setting.key === key);
    if (existing) {
      existing.value = value;
      this.settings.set(existing.id, existing);
      return existing;
    } else {
      const id = randomUUID();
      const setting = { id, key, value };
      this.settings.set(id, setting);
      return setting;
    }
  }
  async getStats(dateFrom, dateTo) {
    let sessions2 = Array.from(this.sessions.values());
    if (dateFrom || dateTo) {
      sessions2 = sessions2.filter((session) => {
        const sessionDate = new Date(session.date);
        if (dateFrom && sessionDate < dateFrom) return false;
        if (dateTo && sessionDate > dateTo) return false;
        return true;
      });
    }
    const totalSessions = sessions2.length;
    const totalHours = sessions2.reduce((sum, session) => sum + session.hours, 0);
    const netProfit = sessions2.reduce((sum, session) => sum + session.profit, 0);
    const wins = sessions2.filter((session) => session.profit > 0).length;
    const winRate = totalSessions > 0 ? wins / totalSessions * 100 : 0;
    const hourlyRate = totalHours > 0 ? netProfit / totalHours : 0;
    const profits = sessions2.map((session) => session.profit);
    const biggestWin = profits.length > 0 ? Math.max(...profits) : 0;
    const biggestLoss = profits.length > 0 ? Math.min(...profits) : 0;
    const sortedSessions = sessions2.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let currentStreakType = "win";
    let currentStreakCount = 0;
    let longestWinStreak = 0;
    let longestLossStreak = 0;
    let tempWinStreak = 0;
    let tempLossStreak = 0;
    for (let i = sortedSessions.length - 1; i >= 0; i--) {
      const session = sortedSessions[i];
      const isWin = session.profit > 0;
      if (i === sortedSessions.length - 1) {
        currentStreakType = isWin ? "win" : "loss";
        currentStreakCount = 1;
      } else {
        if (currentStreakType === "win" && isWin || currentStreakType === "loss" && !isWin) {
          currentStreakCount++;
        } else {
          break;
        }
      }
      if (isWin) {
        tempWinStreak++;
        tempLossStreak = 0;
        longestWinStreak = Math.max(longestWinStreak, tempWinStreak);
      } else {
        tempLossStreak++;
        tempWinStreak = 0;
        longestLossStreak = Math.max(longestLossStreak, tempLossStreak);
      }
    }
    return {
      totalSessions,
      totalHours,
      netProfit,
      winRate,
      hourlyRate,
      biggestWin,
      biggestLoss,
      currentStreak: { type: currentStreakType, count: currentStreakCount },
      longestWinStreak,
      longestLossStreak
    };
  }
};
var storage = new MemStorage();

// shared/schema.ts
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, real, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  location: text("location").notNull(),
  gameType: text("game_type").notNull(),
  // 'cash', 'tournament', 'sit-n-go'
  tableType: text("table_type").notNull(),
  // 'live', 'online', 'home'
  stakes: text("stakes").notNull(),
  date: timestamp("date").notNull().defaultNow(),
  hours: real("hours").notNull(),
  buyIn: real("buy_in").notNull(),
  cashOut: real("cash_out").notNull(),
  profit: real("profit").notNull(),
  // calculated field
  hourlyRate: real("hourly_rate").notNull(),
  // calculated field
  hands: integer("hands"),
  tags: text("tags").array().default([]),
  notes: text("notes"),
  rating: integer("rating"),
  // 1-5 star rating
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var bankrollTransactions = pgTable("bankroll_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(),
  // 'session', 'deposit', 'withdrawal'
  amount: real("amount").notNull(),
  description: text("description").notNull(),
  sessionId: varchar("session_id").references(() => sessions.id),
  date: timestamp("date").notNull().defaultNow()
});
var settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull()
});
var insertSessionSchema = createInsertSchema(sessions).omit({
  id: true,
  profit: true,
  hourlyRate: true,
  createdAt: true
});
var insertBankrollTransactionSchema = createInsertSchema(bankrollTransactions).omit({
  id: true,
  date: true
});
var insertSettingsSchema = createInsertSchema(settings).omit({
  id: true
});

// server/routes.ts
import { z } from "zod";
async function registerRoutes(app2) {
  app2.get("/api/sessions", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset) : 0;
      const sessions2 = await storage.getSessions(limit, offset);
      res.json(sessions2);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sessions" });
    }
  });
  app2.get("/api/sessions/search", async (req, res) => {
    try {
      const query = req.query.q || "";
      const filters = {
        location: req.query.location,
        gameType: req.query.gameType,
        tableType: req.query.tableType,
        dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom) : void 0,
        dateTo: req.query.dateTo ? new Date(req.query.dateTo) : void 0,
        result: req.query.result
      };
      const sessions2 = await storage.searchSessions(query, filters);
      res.json(sessions2);
    } catch (error) {
      res.status(500).json({ error: "Failed to search sessions" });
    }
  });
  app2.get("/api/sessions/:id", async (req, res) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch session" });
    }
  });
  app2.post("/api/sessions", async (req, res) => {
    try {
      const validatedData = insertSessionSchema.parse(req.body);
      const session = await storage.createSession(validatedData);
      res.status(201).json(session);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid session data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create session" });
    }
  });
  app2.put("/api/sessions/:id", async (req, res) => {
    try {
      const validatedData = insertSessionSchema.partial().parse(req.body);
      const session = await storage.updateSession(req.params.id, validatedData);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid session data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update session" });
    }
  });
  app2.delete("/api/sessions/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteSession(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete session" });
    }
  });
  app2.get("/api/bankroll/transactions", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset) : 0;
      const transactions = await storage.getBankrollTransactions(limit, offset);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });
  app2.post("/api/bankroll/transactions", async (req, res) => {
    try {
      const validatedData = insertBankrollTransactionSchema.parse(req.body);
      const transaction = await storage.createBankrollTransaction(validatedData);
      res.status(201).json(transaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid transaction data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create transaction" });
    }
  });
  app2.get("/api/settings/:key", async (req, res) => {
    try {
      const setting = await storage.getSetting(req.params.key);
      if (!setting) {
        return res.status(404).json({ error: "Setting not found" });
      }
      res.json(setting);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch setting" });
    }
  });
  app2.put("/api/settings/:key", async (req, res) => {
    try {
      const { value } = req.body;
      if (typeof value !== "string") {
        return res.status(400).json({ error: "Value must be a string" });
      }
      const setting = await storage.setSetting(req.params.key, value);
      res.json(setting);
    } catch (error) {
      res.status(500).json({ error: "Failed to update setting" });
    }
  });
  app2.get("/api/stats", async (req, res) => {
    try {
      const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom) : void 0;
      const dateTo = req.query.dateTo ? new Date(req.query.dateTo) : void 0;
      const stats = await storage.getStats(dateFrom, dateTo);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
  });
})();
