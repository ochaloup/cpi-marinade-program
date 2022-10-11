import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { SdkMarinade } from "../target/types/sdk_marinade";

describe("sdk-marinade", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.SdkMarinade as Program<SdkMarinade>;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });
});
