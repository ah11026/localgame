import express from "express";
import http from "node:http";
import { Server } from "socket.io";
import QRCode from "qrcode";
import { randomInt, randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const appOrigin = (() => {
  try {
    return process.env.PUBLIC_BASE_URL ? new URL(process.env.PUBLIC_BASE_URL).origin : "http://localhost:3000";
  } catch {
    return "http://localhost:3000";
  }
})();
const allowedOrigins = new Set([
  appOrigin,
  "http://localhost:3000",
  "http://127.0.0.1:3000"
]);

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed by CORS"));
    },
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ["websocket", "polling"],
  pingInterval: 10000,
  pingTimeout: 20000,
  maxHttpBufferSize: 16 * 1024
});

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "1mb" }));
app.use("/api", rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false
}));

app.use(express.static(path.join(__dirname, "../public"), {
  index: false,
  maxAge: "1h",
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".js") || filePath.endsWith(".css") || filePath.endsWith(".json")) {
      res.setHeader("Cache-Control", "public, max-age=3600");
    }
  }
}));

const rooms = new Map();
const socketRooms = new Map();
const MAX_PLAYERS = 4;
const ALLOWED_BUTTONS = new Set([
  "up", "down", "left", "right",
  "a", "b", "x", "y",
  "start", "select", "l1", "r1",
  "l2", "r2", "l3", "r3"
]);
const PLAYER_GRACE_PERIOD_MS = Number(process.env.PLAYER_GRACE_PERIOD_MS || 120000);

function createRoomCode() {
  let code;
  do {
    code = String(randomInt(100000, 1000000));
  } while (rooms.has(code));
  return code;
}

function roomState(room) {
  return {
    code: room.code,
    players: [...room.tokens.values()].map((p) => ({
      id: p.id,
      player: p.player,
      name: p.name,
      connected: !!p.connected
    }))
  };
}

function allocatePlayerNumber(room) {
  const used = new Set([...room.tokens.values()].map((m) => m.player));
  for (let i = 1; i <= MAX_PLAYERS; i++) {
    if (!used.has(i)) return i;
  }
  return null;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, status: "healthy" });
});

app.get("/api/rooms/:code/qr", async (req, res) => {
  const room = rooms.get(req.params.code);
  if (!room) return res.status(404).json({ error: "Room not found" });

  const base = process.env.PUBLIC_BASE_URL;
  if (!base) {
    return res.status(500).json({
      error: "PUBLIC_BASE_URL is not configured"
    });
  }

  const joinUrl = `${base}/controller.html?room=${encodeURIComponent(room.code)}`;

  try {
    res.json({
      url: joinUrl,
      qr: await QRCode.toDataURL(joinUrl)
    });
  } catch (error) {
    console.error("QR generation error:", error);
    res.status(500).json({ error: "Unable to generate QR" });
  }
});

io.on("connection", (socket) => {
  socket.on("room:create", (ack) => {
    const code = createRoomCode();

    const room = {
      code,
      hostId: socket.id,
      players: new Map(),
      tokens: new Map(),
      pressed: new Map(),
      cleanupTimeouts: new Map()
    };

    rooms.set(code, room);
    socket.join(code);
    socketRooms.set(socket.id, code);

    ack?.({ ok: true, ...roomState(room) });
  });

  socket.on("room:join", ({ code, name, token }, ack) => {
    const room = rooms.get(String(code ?? ""));
    if (!room) return ack?.({ ok: false, error: "غرفة غير موجودة" });

    if (token) {
      const member = room.tokens.get(String(token));
      if (!member) {
        return ack?.({ ok: false, error: "توكن الجلسة غير صالح أو منتهي" });
      }
      if (member.connected) {
        return ack?.({ ok: false, error: "هذا التوكن مستخدم حالياً" });
      }

      const timer = room.cleanupTimeouts.get(member.token);
      if (timer) {
        clearTimeout(timer);
        room.cleanupTimeouts.delete(member.token);
      }

      member.id = socket.id;
      member.name = String(name ?? member.name).slice(0, 24);
      member.connected = true;
      member.lastSeen = Date.now();

      room.players.set(socket.id, member);
      socketRooms.set(socket.id, room.code);
      if (!room.pressed.has(member.token)) room.pressed.set(member.token, new Set());

      ack?.({
        ok: true,
        player: member.player,
        code: room.code,
        token: member.token,
        reconnected: true
      });

      io.to(room.hostId).emit("room:state", roomState(room));
      return;
    }

    if (room.tokens.size >= MAX_PLAYERS) {
      return ack?.({ ok: false, error: "الغرفة ممتلئة" });
    }

    const player = allocatePlayerNumber(room);
    if (player === null) {
      return ack?.({ ok: false, error: "لا مقاعد متاحة" });
    }

    const newToken = randomUUID();
    const member = {
      id: socket.id,
      player,
      name: String(name ?? `لاعب ${player}`).slice(0, 24),
      token: newToken,
      connected: true,
      lastSeen: Date.now()
    };

    room.tokens.set(newToken, member);
    room.players.set(socket.id, member);
    room.pressed.set(newToken, new Set());
    socket.join(room.code);
    socketRooms.set(socket.id, room.code);

    ack?.({ ok: true, player, code: room.code, token: newToken });
    io.to(room.hostId).emit("room:state", roomState(room));
  });

  socket.on("input", ({ button, pressed }, ack) => {
    const code = socketRooms.get(socket.id);
    const room = rooms.get(code);
    const member = room?.players.get(socket.id);

    if (!room || !member) {
      return ack?.({ ok: false, error: "غير مسجل كلاعب" });
    }

    if (!ALLOWED_BUTTONS.has(button) || typeof pressed !== "boolean") {
      return ack?.({ ok: false, error: "مدخل غير صالح" });
    }

    const token = member.token;
    const set = room.pressed.get(token) ?? new Set();
    room.pressed.set(token, set);

    if (set.has(button) === pressed) {
      return ack?.({ ok: true });
    }

    if (pressed) set.add(button);
    else set.delete(button);

    io.to(room.hostId).emit("game:input", {
      player: member.player,
      button,
      pressed,
      at: Date.now()
    });

    ack?.({ ok: true });
  });

  socket.on("disconnect", () => {
    const code = socketRooms.get(socket.id);
    socketRooms.delete(socket.id);

    const room = rooms.get(code);
    if (!room) return;

    const member = room.players.get(socket.id);

    if (member) {
      const token = member.token;
      const pressedSet = room.pressed.get(token) ?? new Set();
      for (const button of pressedSet) {
        io.to(room.hostId).emit("game:input", {
          player: member.player,
          button,
          pressed: false,
          at: Date.now()
        });
      }

      member.connected = false;
      member.disconnectedAt = Date.now();
      room.players.delete(socket.id);
      io.to(room.hostId).emit("room:state", roomState(room));

      const cleanup = setTimeout(() => {
        const current = room.tokens.get(token);
        if (!current) return;
        if (current.connected) return;
        room.tokens.delete(token);
        room.pressed.delete(token);
        room.cleanupTimeouts.delete(token);
        io.to(room.hostId).emit("room:state", roomState(room));
      }, PLAYER_GRACE_PERIOD_MS);

      room.cleanupTimeouts.set(token, cleanup);
    }

    if (room.hostId === socket.id) {
      for (const member of room.tokens.values()) {
        io.sockets.sockets.get(member.id)?.emit("room:closed");
        socketRooms.delete(member.id);
      }
      io.in(code).socketsLeave(code);
      rooms.delete(code);
    }
  });
});

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = Number(process.env.PORT || 3000);
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Game server listening on port ${PORT}`);
});

process.on("SIGTERM", () => {
  console.log("Received SIGTERM. Shutting down gracefully.");
  server.close(() => process.exit(0));
});
