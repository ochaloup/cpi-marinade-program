import * as anchor from "@project-serum/anchor";
import { Program, web3, BN, Wallet} from "@project-serum/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { ConfirmOptions } from "@solana/web3.js";
import { CpiMarinade } from "../target/types/cpi_marinade";

const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID = new web3.PublicKey(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
);

async function findAssociatedTokenAddress(
    walletAddress: web3.PublicKey,
    tokenMintAddress: web3.PublicKey
): Promise<web3.PublicKey> {
    return (await web3.PublicKey.findProgramAddress(
        [
            walletAddress.toBuffer(),
            TOKEN_PROGRAM_ID.toBuffer(),
            tokenMintAddress.toBuffer(),
        ],
        SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID
    ))[0];
}

describe("cpi-marinade", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.CpiMarinade as Program<CpiMarinade>;

  // ./target/debug/marinade -i `cat /home/chalda/marinade/marinade-anchor/keys/instance.pubkey` show
  // Instance : Pubkey(5kZPmcZHranmRWb3usuKugN9xeLQciZAotc1vrxvjshu)
  const state = new web3.PublicKey("5kZPmcZHranmRWb3usuKugN9xeLQciZAotc1vrxvjshu");
  // reserve 0.00203928 SOL (PDA) 58RZTF6YBqVFq35YYdK3s33385Er4LXeWDehRf6SvXGH
  const reservePda = new web3.PublicKey("58RZTF6YBqVFq35YYdK3s33385Er4LXeWDehRf6SvXGH");
  // mSOL supply 0 mint HKbs3nrjM4A7K6k3BBHhir1QwCpDtEYQmgarqe9bhd95 auth 4v8a6DKL4eQU72dFxArtXd3BAQGw7nLmvNDbkr6beq4P
  const msolMint = new web3.PublicKey("HKbs3nrjM4A7K6k3BBHhir1QwCpDtEYQmgarqe9bhd95");
  const msolMintAuthority = new web3.PublicKey("4v8a6DKL4eQU72dFxArtXd3BAQGw7nLmvNDbkr6beq4P");
  // -- Liq-Pool ---------------
  // mSOL-SOL-LP supply 0 mint  ...
  // mSOL  0.000000000 account F6CT9vkDwrCLVtmaAcqug47sq1N7Cf5d2E5Zhx1LTTxD auth 542TYqMNii7zRcFrEpq4p76cqDN6CsyqMd6nFWvU7HYg
  // SOL   0.00203928 account D3EcJk6c4VC7JG73SUqARKw6eZFpHdEiG3iP5T2N8YHy
  const liqPoolMsolLeg = new web3.PublicKey("F6CT9vkDwrCLVtmaAcqug47sq1N7Cf5d2E5Zhx1LTTxD");
  const liqPoolMsolLegAuthority = new web3.PublicKey("542TYqMNii7zRcFrEpq4p76cqDN6CsyqMd6nFWvU7HYg");
  const liqPoolSolLegPda = new web3.PublicKey("D3EcJk6c4VC7JG73SUqARKw6eZFpHdEiG3iP5T2N8YHy");

  it("Calling Marinade deposit", async () => {
    const mintTo = await findAssociatedTokenAddress(Wallet.local().publicKey, msolMint);
    console.log("ata for local wallet", mintTo.toBase58());

    const lamports = web3.LAMPORTS_PER_SOL;
    const tx = await program.methods.callDeposit(new BN(lamports)).accounts(
    {
        marinadeProgram: new web3.PublicKey("MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD"),
        state: state,
        msolMint: msolMint,
        liqPoolSolLegPda: liqPoolSolLegPda,
        liqPoolMsolLeg: liqPoolMsolLeg,
        liqPoolMsolLegAuthority: liqPoolMsolLegAuthority,
        reservePda: reservePda,
        transferFrom: Wallet.local().publicKey,
        mintTo: mintTo,
        msolMintAuthority: msolMintAuthority,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      }).rpc({skipPreflight: true});
    console.log("Your transaction signature", tx);
  });
});
