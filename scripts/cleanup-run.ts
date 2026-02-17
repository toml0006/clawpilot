import { runCleanup } from "../src/lib/cleanup/cleanupService";

async function main() {
  const dryRun = process.argv.includes("--dry-run") || process.env.DRY_RUN === "1";
  const result = await runCleanup(dryRun);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
