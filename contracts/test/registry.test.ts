import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { deployWorld, humanIdOf, LEVEL } from "./helpers";

const fx = () => deployWorld();

describe("HumanRegistry", () => {
  async function expiryIn(seconds = 1000) {
    return (await time.latest()) + seconds;
  }

  it("attest stores the attestation and exposes it via humanOf, attestationOf and walletOfHuman", async () => {
    const w = await loadFixture(fx);
    const wallet = w.others[0].address;
    const human = humanIdOf("reg-a");
    const exp = await expiryIn();
    await expect(w.registry.connect(w.attester).attest(wallet, human, LEVEL.DOCUMENT, exp))
      .to.emit(w.registry, "Attested")
      .withArgs(wallet, human, LEVEL.DOCUMENT, exp);
    const [id, level] = await w.registry.humanOf(wallet);
    expect(id).to.equal(human);
    expect(level).to.equal(LEVEL.DOCUMENT);
    const a = await w.registry.attestationOf(wallet);
    expect(a.humanId).to.equal(human);
    expect(a.level).to.equal(LEVEL.DOCUMENT);
    expect(a.expiresAt).to.equal(exp);
    expect(await w.registry.walletOfHuman(human)).to.equal(wallet);
  });

  it("an unattested wallet reads as (0, 0)", async () => {
    const w = await loadFixture(fx);
    const [id, level] = await w.registry.humanOf(w.others[3].address);
    expect(id).to.equal(ethers.ZeroHash);
    expect(level).to.equal(0);
    expect((await w.registry.attestationOf(w.others[3].address)).humanId).to.equal(ethers.ZeroHash);
  });

  it("only the ATTESTER role can attest", async () => {
    const w = await loadFixture(fx);
    const role = await w.registry.ATTESTER_ROLE();
    await expect(
      w.registry.connect(w.others[1]).attest(w.others[0].address, humanIdOf("x"), LEVEL.ORB, await expiryIn()),
    )
      .to.be.revertedWithCustomError(w.registry, "AccessControlUnauthorizedAccount")
      .withArgs(w.others[1].address, role);
    // even the admin has no attester powers unless granted
    await expect(
      w.registry.connect(w.admin).attest(w.others[0].address, humanIdOf("x"), LEVEL.ORB, await expiryIn()),
    ).to.be.revertedWithCustomError(w.registry, "AccessControlUnauthorizedAccount");
  });

  it("only the ATTESTER role can revoke", async () => {
    const w = await loadFixture(fx);
    await expect(w.registry.connect(w.others[1]).revoke(w.jurors[0].address))
      .to.be.revertedWithCustomError(w.registry, "AccessControlUnauthorizedAccount")
      .withArgs(w.others[1].address, await w.registry.ATTESTER_ROLE());
  });

  it("rejects level 0", async () => {
    const w = await loadFixture(fx);
    await expect(w.registry.connect(w.attester).attest(w.others[0].address, humanIdOf("x"), 0, await expiryIn()))
      .to.be.revertedWithCustomError(w.registry, "InvalidLevel")
      .withArgs(0);
  });

  it("rejects level 4", async () => {
    const w = await loadFixture(fx);
    await expect(w.registry.connect(w.attester).attest(w.others[0].address, humanIdOf("x"), 4, await expiryIn()))
      .to.be.revertedWithCustomError(w.registry, "InvalidLevel")
      .withArgs(4);
  });

  it("rejects the zero wallet", async () => {
    const w = await loadFixture(fx);
    await expect(
      w.registry.connect(w.attester).attest(ethers.ZeroAddress, humanIdOf("x"), LEVEL.ORB, await expiryIn()),
    ).to.be.revertedWithCustomError(w.registry, "ZeroWallet");
  });

  it("rejects the zero humanId", async () => {
    const w = await loadFixture(fx);
    await expect(
      w.registry.connect(w.attester).attest(w.others[0].address, ethers.ZeroHash, LEVEL.ORB, await expiryIn()),
    ).to.be.revertedWithCustomError(w.registry, "ZeroHumanId");
  });

  it("rejects an expiry that is already in the past", async () => {
    const w = await loadFixture(fx);
    const past = (await time.latest()) - 5;
    await expect(w.registry.connect(w.attester).attest(w.others[0].address, humanIdOf("x"), LEVEL.ORB, past))
      .to.be.revertedWithCustomError(w.registry, "AlreadyExpired")
      .withArgs(past);
  });

  it("rejects expiresAt equal to the block timestamp", async () => {
    const w = await loadFixture(fx);
    const t = (await time.latest()) + 50;
    await time.setNextBlockTimestamp(t);
    await expect(
      w.registry.connect(w.attester).attest(w.others[0].address, humanIdOf("x"), LEVEL.ORB, t),
    ).to.be.revertedWithCustomError(w.registry, "AlreadyExpired");
  });

  it("accepts expiresAt one second after the block timestamp", async () => {
    const w = await loadFixture(fx);
    const t = (await time.latest()) + 50;
    await time.setNextBlockTimestamp(t);
    await w.registry.connect(w.attester).attest(w.others[0].address, humanIdOf("x"), LEVEL.ORB, t + 1);
    expect((await w.registry.humanOf(w.others[0].address))[1]).to.equal(LEVEL.ORB);
  });

  it("humanOf returns (0, 0) after the attestation expires, while attestationOf keeps the raw record", async () => {
    const w = await loadFixture(fx);
    const wallet = w.others[0].address;
    const human = humanIdOf("expiring");
    const exp = await expiryIn(100);
    await w.registry.connect(w.attester).attest(wallet, human, LEVEL.ORB, exp);
    expect((await w.registry.humanOf(wallet))[0]).to.equal(human);
    await time.increaseTo(exp + 5);
    const [id, level] = await w.registry.humanOf(wallet);
    expect(id).to.equal(ethers.ZeroHash);
    expect(level).to.equal(0);
    expect((await w.registry.attestationOf(wallet)).humanId).to.equal(human);
  });

  it("re-attesting a human to a new wallet revokes the old wallet", async () => {
    const w = await loadFixture(fx);
    const [oldW, newW] = [w.others[0].address, w.others[1].address];
    const human = humanIdOf("mover");
    await w.registry.connect(w.attester).attest(oldW, human, LEVEL.ORB, await expiryIn());
    await expect(w.registry.connect(w.attester).attest(newW, human, LEVEL.ORB, await expiryIn()))
      .to.emit(w.registry, "Revoked")
      .withArgs(oldW, human)
      .and.to.emit(w.registry, "Attested");
    expect(await w.registry.walletOfHuman(human)).to.equal(newW);
    expect((await w.registry.humanOf(oldW))[0]).to.equal(ethers.ZeroHash);
    expect((await w.registry.attestationOf(oldW)).humanId).to.equal(ethers.ZeroHash);
    expect((await w.registry.humanOf(newW))[0]).to.equal(human);
  });

  it("a revoked old wallet can later be attested as a different human", async () => {
    const w = await loadFixture(fx);
    const [oldW, newW] = [w.others[0].address, w.others[1].address];
    await w.registry.connect(w.attester).attest(oldW, humanIdOf("h1"), LEVEL.ORB, await expiryIn());
    await w.registry.connect(w.attester).attest(newW, humanIdOf("h1"), LEVEL.ORB, await expiryIn());
    await w.registry.connect(w.attester).attest(oldW, humanIdOf("h2"), LEVEL.DEVICE, await expiryIn());
    expect((await w.registry.humanOf(oldW))[0]).to.equal(humanIdOf("h2"));
  });

  it("a wallet bound to human X cannot be attested as human Y", async () => {
    const w = await loadFixture(fx);
    const wallet = w.others[0].address;
    await w.registry.connect(w.attester).attest(wallet, humanIdOf("X"), LEVEL.ORB, await expiryIn());
    await expect(w.registry.connect(w.attester).attest(wallet, humanIdOf("Y"), LEVEL.ORB, await expiryIn()))
      .to.be.revertedWithCustomError(w.registry, "WalletBoundToOtherHuman")
      .withArgs(wallet, humanIdOf("X"));
    expect((await w.registry.humanOf(wallet))[0]).to.equal(humanIdOf("X"));
    expect(await w.registry.walletOfHuman(humanIdOf("Y"))).to.equal(ethers.ZeroAddress);
  });

  it("revoke clears the wallet and the human mapping and emits Revoked", async () => {
    const w = await loadFixture(fx);
    const wallet = w.jurors[0].address;
    await expect(w.registry.connect(w.attester).revoke(wallet))
      .to.emit(w.registry, "Revoked")
      .withArgs(wallet, humanIdOf("juror0"));
    expect((await w.registry.humanOf(wallet))[0]).to.equal(ethers.ZeroHash);
    expect(await w.registry.walletOfHuman(humanIdOf("juror0"))).to.equal(ethers.ZeroAddress);
  });

  it("revoking an unattested wallet reverts NotAttested", async () => {
    const w = await loadFixture(fx);
    await expect(w.registry.connect(w.attester).revoke(w.others[2].address))
      .to.be.revertedWithCustomError(w.registry, "NotAttested")
      .withArgs(w.others[2].address);
  });

  it("revoking twice reverts NotAttested the second time", async () => {
    const w = await loadFixture(fx);
    await w.registry.connect(w.attester).revoke(w.jurors[1].address);
    await expect(w.registry.connect(w.attester).revoke(w.jurors[1].address)).to.be.revertedWithCustomError(
      w.registry,
      "NotAttested",
    );
  });

  it("a replaced wallet can no longer be revoked (already revoked by the re-attestation)", async () => {
    const w = await loadFixture(fx);
    await w.registry.connect(w.attester).attest(w.others[0].address, humanIdOf("juror2"), LEVEL.ORB, await expiryIn());
    await expect(w.registry.connect(w.attester).revoke(w.jurors[2].address)).to.be.revertedWithCustomError(
      w.registry,
      "NotAttested",
    );
  });

  it("a level upgrade on the same wallet and human is allowed and keeps one wallet", async () => {
    const w = await loadFixture(fx);
    const wallet = w.creator.address; // DEVICE in the fixture
    expect((await w.registry.humanOf(wallet))[1]).to.equal(LEVEL.DEVICE);
    const exp = await expiryIn(5000);
    await expect(w.registry.connect(w.attester).attest(wallet, humanIdOf("creator"), LEVEL.ORB, exp)).to.not.emit(
      w.registry,
      "Revoked",
    );
    const a = await w.registry.attestationOf(wallet);
    expect(a.level).to.equal(LEVEL.ORB);
    expect(a.expiresAt).to.equal(exp);
    expect(await w.registry.walletOfHuman(humanIdOf("creator"))).to.equal(wallet);
  });

  it("the constructor grants the attester role and admin role", async () => {
    const w = await loadFixture(fx);
    expect(await w.registry.hasRole(await w.registry.ATTESTER_ROLE(), w.attester.address)).to.equal(true);
    expect(await w.registry.hasRole(await w.registry.DEFAULT_ADMIN_ROLE(), w.admin.address)).to.equal(true);
    expect(await w.registry.MAX_LEVEL()).to.equal(3);
  });

  it("constructor with a zero attester grants no attester role", async () => {
    const [admin] = await ethers.getSigners();
    const r = await (await ethers.getContractFactory("HumanRegistry")).deploy(admin.address, ethers.ZeroAddress);
    expect(await r.hasRole(await r.ATTESTER_ROLE(), ethers.ZeroAddress)).to.equal(false);
    expect(await r.hasRole(await r.DEFAULT_ADMIN_ROLE(), admin.address)).to.equal(true);
  });
});
