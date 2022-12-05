//! Program entrypoint definitions
#![cfg(all(target_os = "solana", not(feature = "no-entrypoint")))]

use solana_program::{
    msg,
    borsh::try_from_slice_unchecked,
    entrypoint, entrypoint::ProgramResult,
    pubkey::Pubkey,
    instruction::{AccountMeta, Instruction},
    account_info::{next_account_info, AccountInfo},
    system_program,
    program::invoke,
};

entrypoint!(process_instruction);
fn process_instruction(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();

    let marinade_program = next_account_info(account_info_iter)?; // 0

    let state = next_account_info(account_info_iter)?; // 1
    let msol_mint = next_account_info(account_info_iter)?; // 2
    let liq_pool_sol_leg_pda = next_account_info(account_info_iter)?; // 3
    let liq_pool_msol_leg = next_account_info(account_info_iter)?; // 4
    let liq_pool_msol_leg_authority = next_account_info(account_info_iter)?; // 5
    let reserve_pda = next_account_info(account_info_iter)?; // 6
    let transfer_from = next_account_info(account_info_iter)?; // 7
    let mint_to = next_account_info(account_info_iter)?; // 8
    let msol_mint_authority = next_account_info(account_info_iter)?; // 9
    let system_program = next_account_info(account_info_iter)?; // 10
    let token_program = next_account_info(account_info_iter)?; // 11

    // see
    let pub_keys = vec![
        AccountMeta::new(*state.key, false),
        AccountMeta::new(*msol_mint.key, false),
        AccountMeta::new(*liq_pool_sol_leg_pda.key, false),
        AccountMeta::new(*liq_pool_msol_leg.key, false),
        AccountMeta::new_readonly(*liq_pool_msol_leg_authority.key, false),
        AccountMeta::new(*reserve_pda.key, false),
        AccountMeta::new(*transfer_from.key, true),
        AccountMeta::new(*mint_to.key, false),
        AccountMeta::new_readonly(*msol_mint_authority.key, false),
        AccountMeta::new_readonly(system_program::id(), false),
        AccountMeta::new_readonly(*token_program.key, false),
    ];

    // data we need to know the anchor instruction identifier
    let anchor_sighash_deposit_op: [u8;8] = [242, 35, 198, 137, 82, 225, 242, 182];
    let lamports: u64 = try_from_slice_unchecked(instruction_data)?;
    let data = [anchor_sighash_deposit_op, lamports.to_le_bytes()].concat();

    let ix = Instruction {
        program_id: *marinade_program.key,
        accounts: pub_keys,
        data,
    };

    let ais = &[
        state.clone(),
        msol_mint.clone(),
        liq_pool_sol_leg_pda.clone(),
        liq_pool_msol_leg.clone(),
        liq_pool_msol_leg_authority.clone(),
        reserve_pda.clone(),
        transfer_from.clone(),
        mint_to.clone(),
        msol_mint_authority.clone(),
        system_program.clone(),
        token_program.clone(),
    ];
    invoke(&ix, ais)?;

    msg!(">>>>>>>>>>>>>>> OK");
    Ok(())
}
