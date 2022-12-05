import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { MarinadeFinance } from "../idl/marinade_finance";
import {
  PublicKey,
} from "@solana/web3.js"
import path from "path"
import { readFile } from "fs/promises"

const MARINADE_FINANCE_JSON_PATH = "../idl/marinade_finance.json"

// see Test.toml, program id where the Marinade liquid-staking-program is deployed under
// https://github.com/marinade-finance/liquid-staking-program/blob/447f9607a8c755cac7ad63223febf047142c6c8f/programs/marinade-finance/src/lib.rs#L29
const MARINADE_PROGRAM_ID = new PublicKey("MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD");

describe("raw-marinade", () => {
  let marinadeFinance: Program<MarinadeFinance>

  before(async function() {
   // Configure the client to use the local cluster.
    anchor.setProvider(anchor.AnchorProvider.env());

    const idlPath = path.join(__dirname, MARINADE_FINANCE_JSON_PATH)
    const idlFile = await readFile(idlPath, "utf8")
    const idlJson = JSON.parse(idlFile)
    marinadeFinance = new Program(idlJson, MARINADE_PROGRAM_ID) as Program<MarinadeFinance>
  })

  it("Deposit call over raw Solana CPI", async () => {
    // Init instruction definition
    // https://github.com/marinade-finance/liquid-staking-program/blob/447f9607a8c755cac7ad63223febf047142c6c8f/programs/marinade-finance/src/lib.rs#L343
    // Admin CLI
    // https://github.com/marinade-finance/marinade-anchor/blob/b894dbb4605417adc17e32abfb21b62459255688/cli/admin-init/src/init.rs#L68
    const tx = await marinadeFinance.methods.initialize().accounts({}).rpc()
  });
});
