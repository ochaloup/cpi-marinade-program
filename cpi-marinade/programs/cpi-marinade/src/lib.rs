use anchor_lang::prelude::*;
use marinade_cpi::{
    program::MarinadeFinance,
    cpi::accounts::Deposit,
    cpi::deposit,
};

declare_id!("Em26cSRXE9fxSPNnkHUh8Wmvqh279Jo7StWuCDTCLLSe");

#[program]
pub mod cpi_marinade {
    use super::*;

    pub fn call_deposit(ctx: Context<CallDeposit>, lamports: u64) -> Result<()> {
        deposit(ctx.accounts.set_data_ctx(), lamports)
    }
}

#[derive(Accounts)]
pub struct CallDeposit<'info> {
    pub marinade_program: Program<'info, MarinadeFinance>,

    // to pass all these data further
    /// CHECK:
    #[account(mut)]
    pub state: AccountInfo<'info>, // marinade state
    /// CHECK:
    #[account(mut)]
    pub msol_mint: AccountInfo<'info>,
    /// CHECK:
    #[account(mut)]
    pub liq_pool_sol_leg_pda: AccountInfo<'info>,
    /// CHECK:
    #[account(mut)]
    pub liq_pool_msol_leg: AccountInfo<'info>,
    /// CHECK:
    pub liq_pool_msol_leg_authority: AccountInfo<'info>,
    /// CHECK:
    #[account(mut)]
    pub reserve_pda: AccountInfo<'info>,
    /// CHECK:
    #[account(mut, signer)]
    pub transfer_from: AccountInfo<'info>,
    /// CHECK:
    #[account(mut)]
    pub mint_to: AccountInfo<'info>,
    /// CHECK:
    pub msol_mint_authority: AccountInfo<'info>,
    /// CHECK:
    pub system_program: AccountInfo<'info>,
    /// CHECK:
    pub token_program: AccountInfo<'info>,
}

impl<'info> CallDeposit<'info> {
    pub fn set_data_ctx(&self) -> CpiContext<'_, '_, '_, 'info, Deposit<'info>> {
        let cpi_program = self.marinade_program.to_account_info();
        let cpi_accounts = Deposit {
            state: self.state.clone(),
            msol_mint: self.msol_mint.clone(),
            liq_pool_sol_leg_pda: self.liq_pool_sol_leg_pda.clone(),
            liq_pool_msol_leg: self.liq_pool_msol_leg.clone(),
            liq_pool_msol_leg_authority: self.liq_pool_msol_leg_authority.clone(),
            reserve_pda: self.reserve_pda.clone(),
            transfer_from: self.transfer_from.clone(),
            mint_to: self.mint_to.clone(),
            msol_mint_authority: self.msol_mint_authority.clone(),
            system_program: self.system_program.clone(),
            token_program: self.token_program.clone(),
        };
        CpiContext::new(cpi_program, cpi_accounts)
    }
}
