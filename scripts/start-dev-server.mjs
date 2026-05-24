import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const nextCli = path.join(root, "node_modules", "next", "dist", "bin", "next");
const out = fs.openSync(path.join(root, ".next-dev.out.log"), "a");
const err = fs.openSync(path.join(root, ".next-dev.err.log"), "a");

const child = spawn(
  process.execPath,
  [nextCli, "dev", "--hostname", "127.0.0.1", "--port", "3000"],
  {
    cwd: root,
    detached: true,
    stdio: ["ignore", out, err],
    windowsHide: true
  }
);

child.unref();

console.log(JSON.stringify({ pid: child.pid, url: "http://127.0.0.1:3000" }));
