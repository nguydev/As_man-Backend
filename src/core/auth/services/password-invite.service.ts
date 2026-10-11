import { Injectable } from '@nestjs/common';
import { AUTH_POLICY } from '@/configs/auth.policy';
import { TokenType } from '@/core/auth/helpers/otp-generator.helper';
import { OtpSessionService } from '@/core/auth/services/otp-session.service';
import { AuthMailType } from '@/core/auth/transporters/auth-otp.transporter';

@Injectable()
export class PasswordInviteService {
  constructor(private readonly otpSession: OtpSessionService) {}

  issue(userId: string, email: string): Promise<void> {
    return this.otpSession.issue({
      userId,
      purpose: 'set-password',
      channel: 'email',
      destination: email,
      mailType: AuthMailType.SET_PASSWORD,
      tokens: [TokenType.TOKEN],
      ttlSeconds: AUTH_POLICY.passwordResetTtlSeconds,
    });
  }
}
