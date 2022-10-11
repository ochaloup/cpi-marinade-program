use anchor_lang::prelude::*;

declare_id!("GjVoL49VRjsSXjdG3FAfkXgdwk7VfAPpV9K23gx8C6Na");

#[program]
pub mod cpi_marinade {
    use anchor_lang::solana_program::entrypoint::ProgramResult;
    use super::*;
    pub fn initialize(ctx: Context<Initialize>) -> ProgramResult {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
