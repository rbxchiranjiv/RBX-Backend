import { Inject, Injectable } from '@nestjs/common';
import { GLOBAL_CONFIG } from '../../common/providers/global-config.provider';
import type { GlobalConfig } from 'types/globalConfig';
import { InitiatePayoutDto } from './dto/initiate-payout.dto';

export interface PaymentsServicePort {
  initiatePayout(payload: InitiatePayoutDto): Promise<{ status: string; gateway: string }>;
  getGatewayConfig(): Promise<{ primary: string; backup: string }>;
}

@Injectable()
export class PaymentsService implements PaymentsServicePort {
  constructor(@Inject(GLOBAL_CONFIG) private readonly config: GlobalConfig) {}

  async initiatePayout(payload: InitiatePayoutDto) {
    const gateway = this.config.payments.payoutGateway;
    return {
      status: `Payout of ₹${payload.amount} queued via ${gateway}.`,
      gateway,
    };
  }

  async getGatewayConfig() {
    return {
      primary: this.config.payments.primaryGateway,
      backup: this.config.payments.backupGateway,
    };
  }
}
