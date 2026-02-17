import { execSync } from "child_process";
import { existsSync, rmSync, writeFileSync } from "fs";
import path from "path";

export default async function globalSetup() {
  const rootDir = path.resolve(__dirname, "..");
  const dbPath = path.join(rootDir, "e2e.db");
  const databaseUrl = `file:${dbPath}`;
  const journalPath = `${dbPath}-journal`;

  if (existsSync(dbPath)) {
    rmSync(dbPath);
  }

  if (existsSync(journalPath)) {
    rmSync(journalPath);
  }

  // Prisma/libsql expects the sqlite file to exist before db push in this repo setup.
  writeFileSync(dbPath, "");

  execSync("pnpm exec prisma db push", {
    cwd: rootDir,
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      NODE_ENV: "test",
    },
  });
}
