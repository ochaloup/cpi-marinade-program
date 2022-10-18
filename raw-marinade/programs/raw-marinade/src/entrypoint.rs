//! Program entrypoint definitions
#![cfg(all(target_os = "solana", not(feature = "no-entrypoint")))]

use anchor_lang::AnchorSerialize;
use solana_program::{
    msg,
    account_info::AccountInfo, entrypoint, entrypoint::ProgramResult,
    pubkey::Pubkey,
    instruction::{AccountMeta, Instruction},
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

    let mut accounts = vec![
        AccountMeta::new(*state, false),
        AccountMeta::new(*msol_mint, false),
        AccountMeta::new(*liq_pool_sol_leg_pda, false),
        AccountMeta::new(*liq_pool_msol_leg, false),
        AccountMeta::new_readonly(*liq_pool_msol_leg_authority, false),
        AccountMeta::new(*reserve_pda, false),
        AccountMeta::new(*transfer_from, true),
        AccountMeta::new(*mint_to, false),
        AccountMeta::new_readonly(msol_mint_authority, false),
        AccountMeta::new_readonly(system_program::id(), false),  // TODO: may I use this or need to pass the system_program from accounts
        AccountMeta::new_readonly(token_program, false),
    ];

    // data we need to know the anchor instruction identifier
    let anchor_sighash_deposit_op: [u8;8] = [242, 35, 198, 137, 82, 225, 242, 182];
    let lamports: u64 = instruction_data.try_into().unwrap();
    let data = [anchor_sighash_deposit_op, lamports.to_le_bytes()].concat();

    let ix = Instruction {
        program_id: *marinade_program.pubkey(),
        accounts,
        data,
    };

    msg!(">>>>>>>>>>>>>>> OK");
    Ok(())
}
