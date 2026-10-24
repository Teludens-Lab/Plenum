import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { Pool } from "pg";

const aliases = { app: "application", application: "application", voting: "voting", voice: "voice", extensions: "extensions" };
const profile = aliases[process.argv[2]];
if (profile === undefined) throw new Error("Profile must be app, voting, voice, or extensions");

const adminUrl = new URL(process.env.PLENUM_LOAD_DATABASE_ADMIN_URL ?? "postgres://plenum_owner:local-only@127.0.0.1:5432/postgres");
const database = `plenum_ps540_${profile}_${randomUUID().replaceAll("-", "").slice(0, 10)}`;
const databaseUrl = new URL(adminUrl); databaseUrl.pathname = `/${database}`;
const admin = new Pool({ connectionString: adminUrl.toString(), max: 1 });

try {
  try { await admin.query("CREATE ROLE plenum_app NOLOGIN"); } catch (error) { if (error?.code !== "42710") throw error; }
  await admin.query(`CREATE DATABASE ${database}`);
  const child = spawn(process.execPath, ["tests/load/run-profile.mjs", profile], {
    cwd: process.cwd(), stdio: "inherit", windowsHide: true,
    env: { ...process.env, DATABASE_URL: databaseUrl.toString(), PLENUM_LOAD_DATABASE_NAME: database }
  });
  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
  if (exitCode !== 0) process.exitCode = exitCode;
} finally {
  await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()", [database]);
  await admin.query(`DROP DATABASE IF EXISTS ${database}`);
  await admin.end();
}
