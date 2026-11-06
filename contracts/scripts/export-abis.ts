/**
 * Writes typed ABI bindings and the terms table into packages/chain-client.
 *   npx hardhat compile && npx hardhat run scripts/export-abis.ts
 * test/abi-export.test.ts fails if the committed bindings drift from the artifacts.
 */
import fs from "node:fs";
import path from "node:path";
import { renderBindings, OUT_DIR } from "./bindings";

for (const [file, content] of Object.entries(renderBindings())) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, file), content);
  console.log(`wrote ${path.relative(process.cwd(), path.join(OUT_DIR, file))}`);
}
