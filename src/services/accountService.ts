import { supabase } from './supabase';

export interface DeletionBlocker {
  code: string;
  message: string;
}

export interface EligibilityResult {
  can_delete: boolean;
  blockers: DeletionBlocker[];
}

export const accountService = {
  async checkEligibility(): Promise<EligibilityResult> {
    const { data, error } = await supabase.rpc('check_account_deletion_eligibility');
    
    if (error) {
      // LOG DETALHADO PARA DESCOBRIR A CAUSA DO ERRO:
      console.error("🔍 [RPC ERROR] Detalhes do Supabase:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      // Lança o erro real para o frontend tratar no Toast/Feedback
      throw error; 
    }
    
    return data as EligibilityResult;
  }
};