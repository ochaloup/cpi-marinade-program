import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { CpiMarinade } from "../target/types/cpi_marinade";

describe("cpi-marinade", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.CpiMarinade as Program<CpiMarinade>;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });
});
