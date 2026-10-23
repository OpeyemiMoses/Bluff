import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

export interface SuiTransactionBlockResponse {
  digest: string;
  confirmedLocalExecution?: boolean;
  checkpoint?: string;
  status?: string;
  raw?: any;
}

export class TatumSuiService {
  private static getRpcUrl(): string {
    const network = process.env.SUI_NETWORK || 'mainnet';
    if (network === 'testnet') {
      return 'https://sui-testnet.gateway.tatum.io';
    }
    return 'https://sui-mainnet.gateway.tatum.io';
  }

  private static getHeaders() {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    if (process.env.TATUM_API_KEY) {
      headers['x-api-key'] = process.env.TATUM_API_KEY;
    }
    return headers;
  }

  /**
   * Execute JSON-RPC call against Tatum Sui Gateway
   */
  static async rpcCall(method: string, params: any[] = []): Promise<any> {
    const url = this.getRpcUrl();
    const headers = this.getHeaders();

    try {
      const response = await axios.post(
        url,
        {
          jsonrpc: '2.0',
          id: Date.now(),
          method,
          params
        },
        { headers, timeout: 10000 }
      );

      if (response.data?.error) {
        throw new Error(response.data.error.message || 'Tatum Sui RPC Error');
      }

      return response.data?.result;
    } catch (err: any) {
      // If Tatum key is not yet set or returns auth error, provide informative diagnosis
      if (err.response?.status === 401) {
        console.warn('[TatumSuiService] 401 Unauthorized from Tatum gateway. Set TATUM_API_KEY in .env for production gateway access.');
      }
      throw err;
    }
  }

  /**
   * Query the latest checkpoint on Sui via Tatum
   */
  static async getLatestCheckpoint(): Promise<string> {
    return await this.rpcCall('sui_getLatestCheckpointSequenceNumber', []);
  }

  /**
   * Verify an on-chain transaction digest
   * Confirms payment settlement for x402 wagers
   */
  static async verifyTransaction(digest: string): Promise<{
    valid: boolean;
    status: string;
    sender?: string;
    details?: any;
  }> {
    try {
      const tx = await this.rpcCall('sui_getTransactionBlock', [
        digest,
        {
          showInput: true,
          showEffects: true,
          showEvents: true
        }
      ]);

      if (!tx) {
        return { valid: false, status: 'not_found' };
      }

      const executionStatus = tx.effects?.status?.status;
      const sender = tx.transaction?.data?.sender;

      return {
        valid: executionStatus === 'success',
        status: executionStatus || 'unknown',
        sender,
        details: tx
      };
    } catch (error: any) {
      console.error(`[TatumSuiService] Failed to verify transaction ${digest}:`, error.message);
      // For development/mock test transactions, if digest starts with 'sim_' allow simulation
      if (digest.startsWith('sim_')) {
        return {
          valid: true,
          status: 'simulated_success',
          sender: '0x_simulated_agent_sui_address'
        };
      }
      return { valid: false, status: 'verification_failed' };
    }
  }

  /**
   * Get balance for a Sui address
   */
  static async getBalance(address: string, coinType = '0x2::sui::SUI'): Promise<string> {
    const res = await this.rpcCall('suix_getBalance', [address, coinType]);
    return res?.totalBalance || '0';
  }
}
