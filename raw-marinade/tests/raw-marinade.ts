import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { RawMarinade } from "../target/types/raw_marinade";

describe("raw-marinade", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.RawMarinade as Program<RawMarinade>;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });
});
