import { Inject, Injectable } from '@nestjs/common';
import { GLOBAL_CONFIG } from '../../common/providers/global-config.provider';
import type { GlobalConfig } from 'types/globalConfig';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

export interface AuthServicePort {
  sendOtp(payload: SendOtpDto): Promise<{ message: string }>;
  verifyOtp(payload: VerifyOtpDto): Promise<{ message: string; token: string }>;
}

@Injectable()
export class AuthService implements AuthServicePort {
  constructor(@Inject(GLOBAL_CONFIG) private readonly config: GlobalConfig) {}

  async sendOtp(payload: SendOtpDto) {
    // TODO: hook into SMS gateway listed in env + config
    return {
      message: this.config.notifications.templates.thirtyMinReminder.replace(
        '{{matchCode}}',
        payload.channel,
      ),
    };
  }

  async verifyOtp(payload: VerifyOtpDto) {
    // TODO: validate OTP, issue JWT using config.security values
    return {
      message: this.config.textContent.welcomeBanner,
      token: 'stub-token',
    };
  }
}
