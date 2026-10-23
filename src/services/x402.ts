import { Request, Response, NextFunction } from 'express';
import { TatumSuiService } from './tatum_sui.js';
import dotenv from 'dotenv';
dotenv.config();

export interface X402PaymentRequirement {
  x402Version: string;
  scheme: 'x402-sui';
  network: string;
  recipient: string;
  amount: string;
  token: 'SUI';
  nonce: string;
  expiresAt: string;
  purpose: string;
  metadata?: Record<string, any>;
}

export class X402Service {
  public static getArbiterRecipientAddress(): string {
    return process.env.ARBITER_SUI_ADDRESS || '0x68ca62935f09c2ccc0d8dfb99d1806c3dab9d394922d3d9dcd4a48952ea4427a';
  }

  /**
   * Create an x402 payment challenge payload
   */
  static createChallenge(params: {
    amountSui: number;
    purpose: string;
    metadata?: Record<string, any>;
  }): X402PaymentRequirement {
    const network = process.env.SUI_NETWORK || 'mainnet';
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins expiry
    const nonce = `nonce-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    return {
      x402Version: '2.0',
      scheme: 'x402-sui',
      network: `sui-${network}`,
      recipient: this.getArbiterRecipientAddress(),
      amount: params.amountSui.toFixed(4),
      token: 'SUI',
      nonce,
      expiresAt,
      purpose: params.purpose,
      metadata: params.metadata
    };
  }

  /**
   * Express middleware to enforce x402 payment requirements on an endpoint
   */
  static requirePayment(amountSui: number, purpose: string) {
    return async (req: Request, res: Response, next: NextFunction): Promise<any> => {
      const paymentSignature = req.headers['payment-signature'] as string || req.headers['x-payment-signature'] as string;

      if (!paymentSignature) {
        const challenge = X402Service.createChallenge({
          amountSui,
          purpose,
          metadata: { path: req.path, body: req.body }
        });

        const encodedChallenge = Buffer.from(JSON.stringify(challenge)).toString('base64');

        res.setHeader('PAYMENT-REQUIRED', encodedChallenge);
        res.setHeader('Access-Control-Expose-Headers', 'PAYMENT-REQUIRED, PAYMENT-RESPONSE');

        return res.status(402).json({
          error: 'Payment Required',
          message: `This action requires an x402 micro-stake of ${amountSui} SUI settled on Sui.`,
          challenge
        });
      }

      // Parse payment signature
      let txDigest = paymentSignature;
      try {
        if (paymentSignature.startsWith('{') || paymentSignature.startsWith('ey')) {
          const raw = paymentSignature.startsWith('ey')
            ? Buffer.from(paymentSignature, 'base64').toString('utf-8')
            : paymentSignature;
          const parsed = JSON.parse(raw);
          txDigest = parsed.txDigest || parsed.digest || paymentSignature;
        }
      } catch {
        // use raw string
      }

      // Verify on Sui via Tatum RPC Gateway
      const verification = await TatumSuiService.verifyTransaction(txDigest);
      if (!verification.valid) {
        return res.status(402).json({
          error: 'Payment Verification Failed',
          message: `The provided Sui transaction digest (${txDigest}) could not be verified on Sui.`,
          details: verification
        });
      }

      // Attach payment verification metadata to request object
      (req as any).x402Payment = {
        txDigest,
        sender: verification.sender,
        amountSui,
        verifiedAt: new Date().toISOString()
      };

      res.setHeader('PAYMENT-RESPONSE', Buffer.from(JSON.stringify({
        status: 'settled',
        txDigest,
        verifiedAt: new Date().toISOString()
      })).toString('base64'));

      next();
    };
  }
}
