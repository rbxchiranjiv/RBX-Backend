import { Body, Controller, Get, Post } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { InitiatePayoutDto } from './dto/initiate-payout.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('payouts')
  initiate(@Body() payload: InitiatePayoutDto) {
    return this.paymentsService.initiatePayout(payload);
  }

  @Get('gateways')
  getGateways() {
    return this.paymentsService.getGatewayConfig();
  }
}
