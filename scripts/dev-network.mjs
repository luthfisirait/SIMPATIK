import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import os from "node:os";

const require = createRequire(import.meta.url);
const port = process.env.PORT || "3000";
const bindHost = "0.0.0.0";
const lanIp = process.env.SIMPATIK_DEV_IP || getLanIp();
const nextCli = require.resolve("next/dist/bin/next");

if (lanIp) {
  console.log(`[SIMPATIK] IP LAN: http://${lanIp}:${port}`);
}

const child = spawn(process.execPath, [nextCli, "dev", "-H", bindHost, "-p", port], {
  env: process.env,
  stdio: ["inherit", "pipe", "pipe"],
  windowsHide: true,
});

child.stdout.on("data", (chunk) => {
  process.stdout.write(rewriteOutput(chunk));
});

child.stderr.on("data", (chunk) => {
  process.stderr.write(rewriteOutput(chunk));
});

child.on("error", (error) => {
  console.error(`Gagal menjalankan Next.js: ${error.message}`);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

function rewriteOutput(chunk) {
  const text = chunk.toString();

  if (!lanIp) {
    return text;
  }

  return text
    .replaceAll(`http://${bindHost}:${port}`, `http://${lanIp}:${port}`)
    .replaceAll(bindHost, lanIp);
}

function getLanIp() {
  const candidates = [];

  for (const [name, addresses] of Object.entries(os.networkInterfaces())) {
    for (const address of addresses ?? []) {
      const family =
        typeof address.family === "string"
          ? address.family
          : `IPv${address.family}`;

      if (family !== "IPv4" || address.internal) {
        continue;
      }

      if (address.address.startsWith("169.254.")) {
        continue;
      }

      candidates.push({
        address: address.address,
        score: scoreAddress(name, address.address),
      });
    }
  }

  candidates.sort((left, right) => right.score - left.score);
  return candidates[0]?.address;
}

function scoreAddress(name, address) {
  let score = 0;

  if (isPrivateAddress(address)) {
    score += 10;
  }

  if (/wi-?fi|wlan|ethernet/i.test(name)) {
    score += 5;
  }

  if (/vethernet|wsl|virtualbox|vmware|docker|loopback|teredo|bluetooth/i.test(name)) {
    score -= 20;
  }

  return score;
}

function isPrivateAddress(address) {
  return (
    address.startsWith("10.") ||
    address.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(address)
  );
}
