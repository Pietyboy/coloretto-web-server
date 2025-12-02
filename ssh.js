import fs from "fs";
import { config as loadEnv } from "dotenv";
import { createTunnel } from "tunnel-ssh";

loadEnv();

async function createSSHTunnel() {
  const tunnelOptions = {
    autoClose: false
  };

  const serverOptions = {
    host: "127.0.0.1",
    port: Number(process.env.LOCAL_TUNNEL_PORT)
  };

  const sshPassword = process.env.SSH_PASSWORD;

  const sshOptions = {
    host: process.env.SSH_HOST,
    port: Number(process.env.SSH_PORT) || 22,
    username: process.env.SSH_USER,
    password: sshPassword,
    tryKeyboard: true,
    keepaliveInterval: 10000,
    keepaliveCountMax: 3,
    readyTimeout: 30000
  };

  // Fallback to key auth only if no password provided
  if (!sshPassword && process.env.SSH_PRIVATE_KEY_PATH) {
    sshOptions.privateKey = fs.readFileSync(process.env.SSH_PRIVATE_KEY_PATH);
  }

  if (sshPassword) {
    sshOptions.authHandler = [
      {
        type: "keyboard-interactive",
        username: sshOptions.username,
        prompt: (_name, _instructions, _lang, prompts, finish) => {
          // Respond to all prompts with the password (server advertises only keyboard-interactive)
          finish(prompts.map(() => sshPassword));
        }
      },
      "password"
    ];
  }

  const forwardOptions = {
    srcAddr: serverOptions.host,
    srcPort: serverOptions.port,
    dstAddr: process.env.DB_HOST || "127.0.0.1",
    dstPort: Number(process.env.DB_PORT)
  };

  try {
    const [server, connection] = await createTunnel(
      tunnelOptions,
      serverOptions,
      sshOptions,
      forwardOptions
    );

    connection.on("error", err => {
      console.error("SSH connection error:", err);
    });

    server.on("error", err => {
      console.error("Local tunnel server error:", err);
    });

    console.log(
      `SSH tunnel active: ${forwardOptions.srcAddr}:${forwardOptions.srcPort} → ${forwardOptions.dstAddr}:${forwardOptions.dstPort}`
    );

    return server;
  } catch (err) {
    console.error("SSH tunnel error:", err);
    throw err;
  }
}

export default createSSHTunnel;
