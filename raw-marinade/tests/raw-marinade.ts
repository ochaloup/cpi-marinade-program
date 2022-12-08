import * as anchor from "@project-serum/anchor";
import { Program, AnchorProvider } from "@project-serum/anchor";
import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet"
// import { ProgramDerivedAddressSeed } from '@marinade.finance/marinade-ts-sdk'
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  ACCOUNT_SIZE as SPL_ACCOUNT_SIZE,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token"
import { MarinadeFinance } from "../idl/marinade_finance";
import {
  PublicKey,
  Keypair,
  Signer,
  Connection,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js"
import path from "path"
import { readFile } from "fs/promises"
import {homedir} from "os"
import { encode } from '@project-serum/anchor/dist/cjs/utils/bytes/utf8';
import { BN } from "bn.js"
import { expect } from "chai"


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
    decimals: number = 9,
    mintAuthority: PublicKey | Signer = wallet
  ): Promise<[PublicKey, PublicKey]> {
    const mint = await createMint(
      connection,
      wallet, // Fees payer
      mintAuthority instanceof PublicKey ? mintAuthority : mintAuthority.publicKey, // Minting control
      wallet.publicKey, // Freeze mint control
      decimals // Decimal place location
    )
    console.log("mint", mint.toBase58())
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
        mintAuthority, // Minting authority
        amount, // Amount to be minted
      )
    }
    return [mint, ata.address]
  }

  async function loadKeyPair(keyPairPath: string): Promise<Keypair> {
    // const keyPairPath = homedir() + "/marinade/marinade-anchor/keys/creator.json"
    // console.log(keyPairPath)
    const loadedKeyPair = await readFile(keyPairPath)
    const loadedKeyPairJson = JSON.parse(loadedKeyPair.toString())
    const walletKeyPair = Keypair.fromSecretKey(Uint8Array.from(loadedKeyPairJson))
    console.debug("loaded pubkey of keypair", walletKeyPair.publicKey.toBase58())
    return walletKeyPair
  }

  async function printTxLogs(txSignature: string) {
    const confirmedLocalConnection =  anchor.AnchorProvider.local(undefined, {commitment: "confirmed"}).connection;
    while (!(await confirmedLocalConnection.getTransaction(txSignature))) {
      console.log("waiting one second to get logs of", txSignature)
      await new Promise(f => setTimeout(f, 1000));
    }
    console.log("log", (await confirmedLocalConnection.getTransaction(txSignature)).meta.logMessages)
  }

  before(async function() {
   // Configure the client to use the local cluster.
    anchor.setProvider(anchor.AnchorProvider.env()); // maybe it should be local()
    (anchor.getProvider() as AnchorProvider).opts.skipPreflight = true

    const idlPath = path.join(__dirname, MARINADE_FINANCE_JSON_PATH)
    const idlFile = await readFile(idlPath, "utf8")
    const idlJson = JSON.parse(idlFile)
    marinadeFinance = new Program(idlJson, MARINADE_PROGRAM_ID) as Program<MarinadeFinance>
  })

  it("Deposit call over raw Solana CPI", async () => {
    const wallet: Keypair = ((anchor.getProvider() as AnchorProvider).wallet as NodeWallet).payer

    const {blockhash, lastValidBlockHeight} = await anchor.getProvider().connection.getLatestBlockhash()

    const creatorAuthority = new PublicKey([
      130, 33, 92, 198, 248, 0, 48, 210, 221, 172, 150, 104, 107, 227, 44, 217, 3, 61, 74, 58,
      179, 76, 35, 104, 39, 67, 130, 92, 93, 25, 180, 107,
    ]) // 9kyWPBeU9RnjxnWkkYKYVeShAwQgPDmxujr77thREZtN
    // load creator authority keypair
    const keyPairPath = homedir() + "/marinade/marinade-anchor/keys/creator.json"
    const creatorAuthorityKeyPair = await loadKeyPair(keyPairPath)
    expect(creatorAuthority.equals(creatorAuthorityKeyPair.publicKey))

    const marinadeState = Keypair.generate()  // as state instance
    const adminAuthority = wallet.publicKey // payer is the admin authority
    const operationalSol = wallet.publicKey // payer is the operational sol account
    const validatorManagerAuthority = adminAuthority  // validator authority is the admin authority

    const MSOL_MINT_AUTHORITY_SEED: string = "st_mint"
    const [msolMintAuthorityAddress, msolMintAuthorityBump] = await PublicKey.findProgramAddress([marinadeState.publicKey.toBytes(), encode(MSOL_MINT_AUTHORITY_SEED)], MARINADE_PROGRAM_ID)
    console.log("msolMintAuthorityAddress", msolMintAuthorityAddress.toBase58())
    const [msolMint, msolAtaAddress] = await createMintWithATA(anchor.getProvider().connection, wallet, 0, 9, msolMintAuthorityAddress)
    console.log("msol mint", msolMint.toBase58(), "msol ata address", msolAtaAddress.toBase58())


    const STAKE_LIST_SEED: string = "stake_list"
    const maxStakeAccounts = 1000
    const stakeRecordSize = 32 + 8 + 8 + 1 // from marinade-anchor/programs/marinade-finance/src/stake_systems.rs::StakeRecord
    const additionalStakeRecordSpace = 8
    const stakeListAccountSize = maxStakeAccounts * stakeRecordSize + additionalStakeRecordSpace  // adding discriminator space
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
    const additionalValidatorRecordSpace = 8
    const validatorListAccountSize = maxValidatorAccounts * validatorRecordSize + additionalValidatorRecordSpace  // adding discriminator space
    const rentValidatorListAccount = await anchor.getProvider().connection.getMinimumBalanceForRentExemption(validatorListAccountSize)
    const ixCreateValidatorListAccount = SystemProgram.createAccountWithSeed({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: validatorListAddress,
      basePubkey: marinadeState.publicKey,
      seed: VALIDATOR_LIST_SEED,
      lamports: rentValidatorListAccount,
      space: validatorListAccountSize,
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
    const rentSplStateAccount = await anchor.getProvider().connection.getMinimumBalanceForRentExemption(SPL_ACCOUNT_SIZE)

    // init reserve address
    const RESERVE_SEED: string = "reserve"
    const [reserveAddress, reserveBump] = await PublicKey.findProgramAddress([marinadeState.publicKey.toBytes(), encode(RESERVE_SEED)], MARINADE_PROGRAM_ID)
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
    console.log("funded reserve address", reserveAddress.toBase58(), "with lamports", rentSplStateAccount)

    // init lpMint
    const LP_MINT_AUTHORITY_SEED: string = "liq_mint";
    const [lpMintAuthorityAddress, lpMintAuthorityBump] = await PublicKey.findProgramAddress([marinadeState.publicKey.toBytes(), encode(LP_MINT_AUTHORITY_SEED)], MARINADE_PROGRAM_ID)
    const [lpMint, lpAtaAddress] = await createMintWithATA(anchor.getProvider().connection, wallet, 0, 9, lpMintAuthorityAddress)
    console.log("lp mint", lpMint.toBase58(), "lp ata address", lpAtaAddress.toBase58())
    
    // Liq pool SOL leg
    const SOL_LEG_SEED: string = "liq_sol"
    const [solLegAddress, lsolLegBump] = await PublicKey.findProgramAddress([marinadeState.publicKey.toBytes(), encode(SOL_LEG_SEED)], MARINADE_PROGRAM_ID)
    const ixTransferToSolLeg = SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: solLegAddress,
      lamports:rentSplStateAccount,
      seed: SOL_LEG_SEED,
      programId: MARINADE_PROGRAM_ID,
    })
    const txTransferToSolLeg = new Transaction({
      feePayer: wallet.publicKey,
      blockhash,
      lastValidBlockHeight,
    })
    txTransferToSolLeg.add(ixTransferToSolLeg)
    await anchor.getProvider().sendAndConfirm(txTransferToSolLeg, [wallet])
    console.log("funded sol leg address", solLegAddress.toBase58(), "with lamports", rentSplStateAccount)

    // Liq pool mSOL leg
    const MSOL_LEG_SEED: string = "liq_st_sol"
    const msolLegAddress = await PublicKey.createWithSeed(marinadeState.publicKey, MSOL_LEG_SEED, TOKEN_PROGRAM_ID)
    const ixCreateLiqPoolMsolLegAccount = SystemProgram.createAccountWithSeed({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: msolLegAddress,
      basePubkey: marinadeState.publicKey,
      seed: MSOL_LEG_SEED,
      lamports: rentSplStateAccount,
      space: SPL_ACCOUNT_SIZE,
      programId: TOKEN_PROGRAM_ID // owner
    })
    const txCreateLiqPoolMsolLegAccount = new Transaction({
      feePayer: wallet.publicKey,
      blockhash,
      lastValidBlockHeight,
    })
    txCreateLiqPoolMsolLegAccount.add(ixCreateLiqPoolMsolLegAccount)
    await anchor.getProvider().sendAndConfirm(txCreateLiqPoolMsolLegAccount, [wallet, marinadeState])
    console.log("created msolLegAddress", msolLegAddress.toBase58(), "rent", rentSplStateAccount)

    // treasury mSOL account
    const treasuryMsolAuthority = wallet.publicKey
    const treasuryMsolAddress = msolAtaAddress

    const slotsForStakeDelta = 18000

    // calculated just quickly without a precision
    const marinadeStateAccountSize = 2048 + 2000 // 2048 default in marmin-init, not sure if it's ok
    const rentMarinadeState = await anchor.getProvider().connection.getMinimumBalanceForRentExemption(marinadeStateAccountSize)
    const ixInitMarinadeState = SystemProgram.createAccount({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: marinadeState.publicKey,
      lamports: rentMarinadeState,
      space: marinadeStateAccountSize,
      programId: MARINADE_PROGRAM_ID
    })
    const txInitMarinadeState = new Transaction({
      feePayer: wallet.publicKey,
      blockhash,
      lastValidBlockHeight,
    })
    txInitMarinadeState.add(ixInitMarinadeState)
    // TODO: the commitment setup for sendAndConfirm probably does not work and it works only on default configuraiton of the connection, when calling printTxLog it will need to wait pretty long
    await anchor.getProvider().sendAndConfirm(txInitMarinadeState, [wallet, marinadeState], {preflightCommitment: "confirmed", commitment: "confirmed"})
    console.log("initialized marinade state account", marinadeState.publicKey.toBase58())

    // Init instruction definition
    // https://github.com/marinade-finance/liquid-staking-program/blob/447f9607a8c755cac7ad63223febf047142c6c8f/programs/marinade-finance/src/lib.rs#L343
    // Admin CLI
    // https://github.com/marinade-finance/marinade-anchor/blob/b894dbb4605417adc17e32abfb21b62459255688/cli/admin-init/src/init.rs#L68
    try {
      let txSig = await marinadeFinance.methods
      // @ts-expect-error
      .initialize({
        adminAuthority,
        validatorManagerAuthority,
        minStake: new BN(LAMPORTS_PER_SOL),
        rewardFee: {
          basisPoints: feeReward
        },
        additionalStakeRecordSpace,
        additionalValidatorRecordSpace,
        slotsForStakeDelta: new BN(slotsForStakeDelta),
        liqPool: { // defaults from mardmin-init / marinade-anchor
          lpLiquidityTarget: new BN(10_000 * LAMPORTS_PER_SOL),
          pubLpMaxFee: {
            basisPoints: 300
          },
          lpMinFee: {
            basisPoints: 30
          },
          lpTreasuryCut: {
            basisPoints: 2500
          },
        }
      })
      .accounts({
        creatorAuthority,
        state: marinadeState.publicKey,
        reservePda: reserveAddress,
        stakeList: stakeListAddress,
        validatorList: validatorListAddress,
        msolMint,
        operationalSolAccount: operationalSol,
        treasuryMsolAccount:  treasuryMsolAddress,
        liqPool: {
          lpMint: lpMint,
          solLegPda: solLegAddress,
          msolLeg: msolLegAddress,
        },
        clock: SYSVAR_CLOCK_PUBKEY,
        rent: SYSVAR_RENT_PUBKEY
      })
      .signers([wallet, creatorAuthorityKeyPair])
      .rpc()
      printTxLogs(txSig)
    } catch (e) {
      const txsig = (e as Error).message.replace('Raw transaction ', '').split(' ')[0]
      console.log((e as Error).message)
      printTxLogs(txsig)
    }
  })

})
