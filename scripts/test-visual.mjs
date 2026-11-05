import { spawnSync } from "node:child_process";

const containerName = "plenum-ps800-visual-db";
const databaseName = "plenum_ps800_visual";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: process.cwd(), encoding: "utf8", stdio: options.capture ? "pipe" : "inherit", env: options.env ?? process.env });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    const detail = options.capture ? `${result.stdout ?? ""}${result.stderr ?? ""}`.trim() : "";
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}${detail.length > 0 ? `\n${detail}` : ""}`);
  }
  return result;
}

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const runPackageTool = (name, args, options) => process.platform === "win32"
  ? run(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", `${name} ${args.join(" ")}`], options)
  : run(name, args, options);

try {
  const existing = run("docker", ["ps", "--all", "--filter", `name=^/${containerName}$`, "--format", "{{.Names}}"], { capture: true }).stdout.trim();
  if (existing === containerName) run("docker", ["rm", "--force", containerName]);
  run("docker", ["run", "--detach", "--name", containerName, "--publish", "127.0.0.1::5432",
    "--env", "POSTGRES_PASSWORD=plenum_test", "--env", `POSTGRES_DB=${databaseName}`, "postgres:18.6-alpine"]);

  let ready = false;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const probe = run("docker", ["exec", containerName, "pg_isready", "--username", "postgres", "--dbname", databaseName], { allowFailure: true, capture: true });
    if (probe.status === 0) { ready = true; break; }
    await pause(500);
  }
  if (!ready) throw new Error("The PS-800 visual PostgreSQL container did not become ready.");

  const binding = run("docker", ["port", containerName, "5432/tcp"], { capture: true }).stdout.trim();
  const match = binding.match(/:(\d+)$/u);
  if (match === null) throw new Error("The PS-800 visual PostgreSQL port binding is unavailable.");
  const environment = { ...process.env, DATABASE_URL: `postgresql://postgres:plenum_test@127.0.0.1:${match[1]}/${databaseName}` };

  runPackageTool("npm", ["run", "build", "--silent"], { env: environment });
  runPackageTool("npx", ["playwright", "test", "--config", "tests/e2e/product/playwright.config.mjs", "--grep", "PS-800"], { env: environment });
  run(process.execPath, ["scripts/verify-ps800-visual.mjs"], { env: environment });
} finally {
  run("docker", ["rm", "--force", containerName], { allowFailure: true });
}
