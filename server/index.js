import 'dotenv/config';
import os from 'os';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import storesRoutes from './routes/stores.js';
import requestsRoutes from './routes/requests.js';
import pushRoutes from './routes/push.js';
import remindersRoutes from './routes/reminders.js';
import { setIo } from './realtime.js';
import { startReminderCron } from './services/reminderCron.js';

const app = express();
const port = parseInt(process.env.PORT || '4000', 10);

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'recruitment-api',
    health: '/health',
    api: '/api',
  });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'recruitment-api' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/stores', storesRoutes);
app.use('/api/requests', requestsRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/reminders', remindersRoutes);

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('unauthorized'));
    }
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.data.user = payload;
    next();
  } catch {
    next(new Error('unauthorized'));
  }
});

io.on('connection', (socket) => {
  const uid = socket.data.user?.sub;
  if (uid) {
    socket.join(`user:${uid}`);
  }
});

setIo(io);
startReminderCron();

function lanIPv4Addresses() {
  const out = [];
  for (const nets of Object.values(os.networkInterfaces())) {
    for (const n of nets || []) {
      if (n.family === 'IPv4' && !n.internal) out.push(n.address);
    }
  }
  return out;
}

httpServer.listen(port, '0.0.0.0', () => {
  console.log(`Recruitment API listening on port ${port} (all interfaces).`);
  console.log(`  Browser / health check: http://127.0.0.1:${port}/health`);
  console.log(`  Do not open http://0.0.0.0:${port} in a browser — that address is invalid.`);
  const lan = lanIPv4Addresses();
  if (lan.length) {
    console.log(`  Phone / LAN (set EXPO_PUBLIC_API_URL to one of these):`);
    for (const ip of lan) console.log(`    http://${ip}:${port}`);
  }
});
