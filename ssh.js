import { config as loadEnv } from "dotenv";
import fs from "fs";
import { createTunnel } from "tunnel-ssh";

loadEnv();

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const RECONNECT_DELAYS_MS = [1000, 2000, 5000, 10000, 30000];

let activeTunnel = null;
let reconnectAttempt = 0;
let reconnecting = false;

const closeTunnel = async (tunnel) => {
  if (!tunnel) return;
  const { connection, server, sockets } = tunnel;

  try {
    if (connection) {
      connection.isBroken = true;
    }
  } catch (_err) {
    // ignore
  }

  for (const socket of sockets ?? []) {
    try {
      socket.destroy();
    } catch (_err) {
      // ignore
    }
  }

  await new Promise(resolve => {
    if (!server) return resolve();
    if (!server.listening) return resolve();
    server.close(() => resolve());
  });

  try {
    connection?.end();
  } catch (_err) {
    // ignore
  }
};

const scheduleReconnect = () => {
  if (reconnecting) return;
  reconnecting = true;

  void (async () => {
    while (reconnecting) {
      const delayMs = RECONNECT_DELAYS_MS[Math.min(reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)];
      reconnectAttempt += 1;
      console.warn(`SSH tunnel disconnected. Reconnecting in ${delayMs}ms (attempt ${reconnectAttempt})...`);

      const oldTunnel = activeTunnel;
      activeTunnel = null;
      await closeTunnel(oldTunnel);

      await sleep(delayMs);

      try {
        activeTunnel = await openTunnel();
        reconnectAttempt = 0;
        reconnecting = false;
        console.log("SSH tunnel reconnected");
        return;
      } catch (err) {
        console.error("SSH tunnel reconnect failed:", err);
      }
    }
  })();
};

const openTunnel = async () => {
  const tunnelOptions = {
    autoClose: false,
  };

  const serverOptions = {
    host: "127.0.0.1",
    port: Number(process.env.LOCAL_TUNNEL_PORT),
  };

  const sshPassword = process.env.SSH_PASSWORD;

  const sshOptions = {
    host: process.env.SSH_HOST,
    port: Number(process.env.SSH_PORT) || 22,
    username: process.env.SSH_USER,
    password: sshPassword,
    tryKeyboard: true,
    keepaliveInterval: 10000,
    keepaliveCountMax: 12,
    readyTimeout: 30000,
  };

  if (!sshPassword && process.env.SSH_PRIVATE_KEY_PATH) {
    sshOptions.privateKey = fs.readFileSync(process.env.SSH_PRIVATE_KEY_PATH);
  }

  if (sshPassword) {
    sshOptions.authHandler = [
      {
        type: "keyboard-interactive",
        username: sshOptions.username,
        prompt: (_name, _instructions, _lang, prompts, finish) => {
          finish(prompts.map(() => sshPassword));
        },
      },
      "password",
    ];
  }

  const forwardOptions = {
    srcAddr: serverOptions.host,
    srcPort: serverOptions.port,
    dstAddr: process.env.DB_HOST || "127.0.0.1",
    dstPort: Number(process.env.DB_PORT),
  };

  const [server, connection] = await createTunnel(tunnelOptions, serverOptions, sshOptions, forwardOptions);

  const sockets = new Set();
  server.on("connection", socket => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });

  const markBrokenAndReconnect = (reason, err) => {
    try {
      connection.isBroken = true;
    } catch (_e) {
      // ignore
    }

    if (err) {
      console.error(`SSH tunnel ${reason}:`, err);
    } else {
      console.warn(`SSH tunnel ${reason}`);
    }

    try {
      server.close();
    } catch (_e) {
      // ignore
    }

    scheduleReconnect();
  };

  connection.on("error", err => markBrokenAndReconnect("connection error", err));
  connection.on("close", () => markBrokenAndReconnect("connection closed"));
  connection.on("end", () => markBrokenAndReconnect("connection ended"));

  server.on("error", err => {
    console.error("Local tunnel server error:", err);
    scheduleReconnect();
  });

  console.log(
    `SSH tunnel active: ${forwardOptions.srcAddr}:${forwardOptions.srcPort} → ${forwardOptions.dstAddr}:${forwardOptions.dstPort}`,
  );

  return { connection, server, sockets };
};

async function createSSHTunnel() {
  try {
    activeTunnel = await openTunnel();
    return activeTunnel.server;
  } catch (err) {
    console.error("SSH tunnel error:", err);
    throw err;
  }
}

export default createSSHTunnel;
