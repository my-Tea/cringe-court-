import { expect } from "chai";
import fs from "node:fs";
import path from "node:path";
import hre from "hardhat";
import { renderBindings, OUT_DIR } from "../scripts/bindings";

describe("chain-client bindings", () => {
  it("packages/chain-client/src/generated matches the compiled artifacts (run `npm run export-abis`)", function () {
    // solidity-coverage instruments bytecode, so the committed bindings can't match under `npm run coverage`.
    if ((hre as unknown as { __SOLIDITY_COVERAGE_RUNNING?: boolean }).__SOLIDITY_COVERAGE_RUNNING) this.skip();
    for (const [file, content] of Object.entries(renderBindings())) {
      const p = path.join(OUT_DIR, file);
      expect(fs.existsSync(p), `${p} missing`).to.equal(true);
      expect(fs.readFileSync(p, "utf8")).to.equal(content, `${file} is stale`);
    }
  });
});
