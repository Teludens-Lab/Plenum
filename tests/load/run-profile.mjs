import { Pool } from "pg";

import globalSetup from "../e2e/global-setup.mjs";
import { writeReport } from "./load-support.mjs";

const runners = {
  application: () => import("./application-profile.mjs").then(({ runApplicationProfile }) => runApplicationProfile),
  voting: () => import("./voting-profile.mjs").then(({ runVotingProfile }) => runVotingProfile),
  voice: () => import("./voice-profile.mjs").then(({ runVoiceProfile }) => runVoiceProfile),
  extensions: () => import("./extensions-profile.mjs").then(({ runExtensionsProfile }) => runExtensionsProfile)
};

const profile = process.argv[2];
if (!(profile in runners)) throw new Error("Unknown PS-540 load profile");
await globalSetup();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 60 });
try {
  const report = await (await runners[profile]())(pool);
  const target = await writeReport(report);
  console.log(`${report.testId} ${report.status}; evidence: ${target}`);
  if (report.status === "FAIL") process.exitCode = 1;
} finally {
  await pool.end();
}
