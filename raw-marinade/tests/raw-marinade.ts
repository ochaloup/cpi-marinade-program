import * as anchor from "@project-serum/anchor";
import { Program, AnchorProvider } from "@project-serum/anchor";
import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet"
// import { ProgramDerivedAddressSeed } from '@marinade.finance/marinade-ts-sdk'
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  ACCOUNT_SIZE
} from "@solana/spl-token"
import { MarinadeFinance } from "../idl/marinade_finance";
import {
  PublicKey,
  Keypair,
  Signer,
  Connection,
  SystemProgram,
  Transaction,
} from "@solana/web3.js"
import path from "path"
import { readFile } from "fs/promises"
import { encode } from '@project-serum/anchor/dist/cjs/utils/bytes/utf8';


const MARINADE_FINANCE_JSON_PATH = "../idl/marinade_finance.json"

// see Test.toml, program id where the Marinade liquid-staking-program is deployed under
// https://github.com/marinade-finance/liquid-staking-program/blob/447f9607a8c755cac7ad63223febf047142c6c8f/programs/marinade-finance/src/lib.rs#L29
const MARINADE_PROGRAM_ID = new PublicKey("MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD");

describe("raw-marinade", () => {
  let marinadeFinance: Program<MarinadeFinance>

    /**
   * Create a mint for a test token where wallet is in control over the mint.
   * Plus, minting some amount of tokens to wallet ATA.
   *
   * @param amount  how many tokens to mint (if 0 no mint happens)
   * @param decimals  created mint will work with this decimals
   * @param decimals  wallet that's the control of the mint and ATA is created for (if not set used one from class)
   * @returns [mint public key, wallet ATA public key]
   */
  async function createMintWithATA(
    connection: Connection,
    wallet: Signer,
    amount: number = 0,
    decimals: number = 0,
  ): Promise<[PublicKey, PublicKey]> {
    const mint = await createMint(
      connection,
      wallet, // Fees payer
      wallet.publicKey, // Minting control
      wallet.publicKey, // Freeze mint control
      decimals // Decimal place location
    )
    const ata = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet, // Fees payer
      mint, // Mint that the associated token account belongs to
      wallet.publicKey // Owner of the ATA account
    )
    if (amount > 0) {
      await mintTo(
        connection,
        wallet, // Fees payer
        mint, // Mint of the minting
        ata.address, // Mint to address
        wallet, // Minting authority
        amount, // Amount to be minted
      )
    }
    return [mint, ata.address]
  }

  before(async function() {
   // Configure the client to use the local cluster.
    anchor.setProvider(anchor.AnchorProvider.env());

    const idlPath = path.join(__dirname, MARINADE_FINANCE_JSON_PATH)
    const idlFile = await readFile(idlPath, "utf8")
    const idlJson = JSON.parse(idlFile)
    marinadeFinance = new Program(idlJson, MARINADE_PROGRAM_ID) as Program<MarinadeFinance>
  })

  it("Deposit call over raw Solana CPI", async () => {
    const wallet: Keypair = ((anchor.getProvider() as AnchorProvider).wallet as NodeWallet).payer
    const [msolMint, ataAddress] = await createMintWithATA(anchor.getProvider().connection, wallet, 10)
    console.log("msol mint", msolMint.toBase58(), "ata address", ataAddress.toBase58())

    const {blockhash, lastValidBlockHeight} = await anchor.getProvider().connection.getLatestBlockhash()

    const creatorAuthority = Keypair.generate()
    const marinadeState = Keypair.generate()  // as state instance
    const adminAuthority = wallet.publicKey // payer is the admin authority
    const operationalSol = wallet.publicKey // payer is the operational sol account
    const validatorManagerAuthority = adminAuthority  // validator authority is the admin authority

    const STAKE_LIST_SEED: string = "stake_list"
    const maxStakeAccounts = 1000
    const stakeRecordSize = 32 + 8 + 8 + 1 // from marinade-anchor/programs/marinade-finance/src/stake_systems.rs::StakeRecord
    const stakeListAccountSize = maxStakeAccounts * stakeRecordSize + 8  // adding discriminator space
    const stakeListAddress = await PublicKey.createWithSeed(marinadeState.publicKey, STAKE_LIST_SEED, MARINADE_PROGRAM_ID)
    const rentStakeListAccount = await anchor.getProvider().connection.getMinimumBalanceForRentExemption(stakeListAccountSize)
    const ixCreateStakeListAccount = SystemProgram.createAccountWithSeed({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: stakeListAddress,
      basePubkey: marinadeState.publicKey,
      seed: STAKE_LIST_SEED,
      lamports: rentStakeListAccount,
      space: stakeListAccountSize, // adding discriminator space
      programId: MARINADE_PROGRAM_ID // owner
    })
    const txCreateStakeListAccount = new Transaction({
      feePayer: wallet.publicKey,
      blockhash,
      lastValidBlockHeight,
    })
    txCreateStakeListAccount.add(ixCreateStakeListAccount)
    await anchor.getProvider().sendAndConfirm(txCreateStakeListAccount, [wallet, marinadeState])
    console.log("created stakeListAddress", stakeListAddress.toBase58(), "rent", rentStakeListAccount)

    const VALIDATOR_LIST_SEED: string = "validator_list"
    const validatorListAddress = await PublicKey.createWithSeed(marinadeState.publicKey, VALIDATOR_LIST_SEED, MARINADE_PROGRAM_ID)
    const maxValidatorAccounts = 1000
    const validatorRecordSize = 32 + 8 + 4 + 8 + 1 // from marinade-anchor/programs/marinade-finance/src/validator_systems.rs::ValidatorRecord
    const validatorListAccountSize = maxValidatorAccounts * validatorRecordSize + 8  // adding discriminator space
    const rentValidatorListAccount = await anchor.getProvider().connection.getMinimumBalanceForRentExemption(validatorListAccountSize)
    const ixCreateValidatorListAccount = SystemProgram.createAccountWithSeed({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: validatorListAddress,
      basePubkey: marinadeState.publicKey,
      seed: VALIDATOR_LIST_SEED,
      lamports: rentValidatorListAccount,
      space: validatorListAccountSize, // adding discriminator space
      programId: MARINADE_PROGRAM_ID // owner
    })
    const txCreateValidatorListAccount = new Transaction({
      feePayer: wallet.publicKey,
      blockhash,
      lastValidBlockHeight,
    })
    txCreateValidatorListAccount.add(ixCreateValidatorListAccount)
    await anchor.getProvider().sendAndConfirm(txCreateValidatorListAccount, [wallet, marinadeState])
    console.log("created validatorListAddress", validatorListAddress.toBase58(), "rent", rentValidatorListAccount)

    const feeReward = 2

    // init reserve address
    const RESERVE_SEED: string = "reserve"
    const [reserveAddress, reserveBump] = await PublicKey.findProgramAddress([marinadeState.publicKey.toBytes(), encode(RESERVE_SEED)], MARINADE_PROGRAM_ID)
    const rentSplStateAccount = await anchor.getProvider().connection.getMinimumBalanceForRentExemption(ACCOUNT_SIZE)
    const ixTransferToReserve = SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: reserveAddress,
      lamports:rentSplStateAccount,
      seed: RESERVE_SEED,
      programId: MARINADE_PROGRAM_ID,
    })
    const txTransferToReserve = new Transaction({
      feePayer: wallet.publicKey,
      blockhash,
      lastValidBlockHeight,
    })
    txTransferToReserve.add(ixTransferToReserve)
    await anchor.getProvider().sendAndConfirm(txTransferToReserve, [wallet])
    console.log("funded reserve address", reserveAddress, "with lamports", rentSplStateAccount)

    // Init instruction definition
    // https://github.com/marinade-finance/liquid-staking-program/blob/447f9607a8c755cac7ad63223febf047142c6c8f/programs/marinade-finance/src/lib.rs#L343
    // Admin CLI
    // https://github.com/marinade-finance/marinade-anchor/blob/b894dbb4605417adc17e32abfb21b62459255688/cli/admin-init/src/init.rs#L68
    // const tx = await marinadeFinance.methods.initialize().accounts({}).rpc()
  });
});
