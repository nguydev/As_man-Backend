import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthControllerHelper } from '@/core/auth/helpers/auth-controller.helper';
import type { Request, Response } from 'express';
import type { ServiceResponse } from '@/common/core/interceptors/response.interceptor';
import { AUTH_TRANSPORT_HEADER } from '@/core/auth/auth.constants';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { Public } from '@/core/auth/decorators/public.decorator';
import { JwtAuthGuard } from '@/core/auth/guards/jwt.guard';
import { UserRepository } from '@/core/auth/repositories/user.repository';
import { ChangePasswordDto } from '@/core/auth/dto/change-password.dto';
import {
  ConfirmEmailChangeDto,
  RequestEmailChangeDto,
} from '@/core/auth/dto/email-change.dto';
import {
  ConfirmEnrollmentDto,
  EnrollEmailOtpDto,
  EnrollSmsOtpDto,
} from '@/core/auth/dto/enroll-2fa.dto';
import { SetPasswordDto } from '@/core/auth/dto/set-password.dto';
import { LoginDto } from '@/core/auth/dto/login.dto';
import { RefreshDto } from '@/core/auth/dto/refresh.dto';
import {
  OrganizationSignupDto,
  DriverSignupDto,
} from '@/core/auth/dto/signup.dto';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyPasswordResetOtpDto,
} from '@/core/auth/dto/reset-password.dto';
import {
  TwoFactorChallengeSendDto,
  TwoFactorChallengeVerifyDto,
} from '@/core/auth/dto/verify-2fa.dto';
import {
  ConfirmEmailVerificationDto,
  ConfirmEmailVerificationOtpDto,
  ResendEmailVerificationDto,
} from '@/core/auth/dto/verify-email.dto';
import { AuthCookieService } from '@/core/auth/services/auth-cookie.service';
import { ChangeContactService } from '@/core/auth/services/change-contact.service';
import { EmailVerifyService } from '@/core/auth/services/email-verify.service';
import { LoginService } from '@/core/auth/services/login.service';
import { PasswordChangeService } from '@/core/auth/services/password-change.service';
import { PasswordResetService } from '@/core/auth/services/password-reset.service';
import { RegisterService } from '@/core/auth/services/register.service';
import { TokenService } from '@/core/auth/services/token.service';
import type { AuthenticatedUser } from '@/core/auth/types/authorization.type';
import type { AuthTokens } from '@/core/auth/types/auth-tokens.type';
import { TotpService } from '@/core/auth/services/totp.service';
import { TwoFactorService } from '@/core/auth/services/two-factor.service';
import locals from '@/locals';

const ApiTransportHeader = () =>
  ApiHeader({
    name: AUTH_TRANSPORT_HEADER,
    required: false,
    description:
      "Send 'bearer' to receive tokens in the response body (mobile/API clients). " +
      'Omit to receive httpOnly auth cookies instead (web).',
  });

@Controller('auth')
export class AuthController {
  constructor(
    private readonly users: UserRepository,
    private readonly register: RegisterService,
    private readonly login: LoginService,
    private readonly tokens: TokenService,
    private readonly cookies: AuthCookieService,
    private readonly emailVerify: EmailVerifyService,
    private readonly passwordReset: PasswordResetService,
    private readonly passwordChange: PasswordChangeService,
    private readonly changeContact: ChangeContactService,
    private readonly twoFactor: TwoFactorService,
    private readonly totp: TotpService,
    private readonly helper: AuthControllerHelper,
  ) {}

  @Post('signup/organization')
  @Public()
  @ApiOperation({ summary: 'Register an organization owner account' })
  @ApiCreatedResponse({ description: 'Organization account created' })
  @ApiConflictResponse({ description: 'Email already registered' })
  @ApiTransportHeader()
  async registerOrganization(
    @Body() dto: OrganizationSignupDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.register.registerOrganization(
      dto,
      this.helper.requestContext(req),
    );
    return this.signupResponse(tokens, req, res);
  }

  @Post('signup/driver')
  @Public()
  @ApiOperation({ summary: 'Register a driver account' })
  @ApiCreatedResponse({ description: 'Driver account created' })
  @ApiConflictResponse({ description: 'Email already registered' })
  @ApiTransportHeader()
  async registerDriver(
    @Body() dto: DriverSignupDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.register.registerDriver(
      dto,
      this.helper.requestContext(req),
    );
    return this.signupResponse(tokens, req, res);
  }

  private signupResponse(tokens: AuthTokens, req: Request, res: Response) {
    const body = this.helper.deliverTokens(
      res,
      tokens,
      this.helper.wantsBearer(req),
    );
    return {
      message: locals.auth.account_created_successfully,
      ...(body && { root: body }),
    };
  }

  /** Log in with credentials */
  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in with credentials' })
  @ApiTransportHeader()
  async loginAccount(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.login.login(dto, this.helper.requestContext(req));
    if (result.kind === 'tokens') {
      const body = this.helper.deliverTokens(
        res,
        result.tokens,
        this.helper.wantsBearer(req),
      );
      return {
        message: locals.auth.logged_in_successfully,
        data: result.user,
        ...(body && { root: body }),
      };
    }
    return {
      message: locals.auth.two_factor_required,
      root: { challengeId: result.challengeId, methods: result.methods },
    };
  }

  /** Refresh access and refresh tokens */
  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access and refresh tokens',
    description:
      'Rotates tokens. Delivery follows the presented refresh token: sent in the ' +
      'body → new tokens in the body; sent via the refresh cookie → a new httpOnly ' +
      'cookie and no tokens in the body. The X-Auth-Transport header is ignored here.',
  })
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Refresh ignores the header and keys off where the token came from. A web
    // XSS payload can trigger this route (the httpOnly refresh cookie auto-sends)
    // but cannot read that cookie to present it in the body, so it can never coax
    // a body-token response. Mobile presents its refresh token in the body.
    const fromBody = dto.refreshToken != null;
    const presentedRefreshToken =
      dto.refreshToken ?? this.helper.refreshTokenFromCookie(req);
    if (!presentedRefreshToken) {
      throw new UnauthorizedException(locals.auth.refresh_token_required);
    }
    const tokens = await this.tokens.refresh(
      presentedRefreshToken,
      this.helper.requestContext(req),
    );
    const body = this.helper.deliverTokens(res, tokens, fromBody);
    return {
      message: locals.auth.token_refreshed,
      ...(body && { root: body }),
    };
  }

  /** Log out and revoke the refresh token */
  @Post('logout')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Log out and revoke the refresh token' })
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ServiceResponse<void>> {
    const presentedRefreshToken =
      dto.refreshToken ?? this.helper.refreshTokenFromCookie(req);
    await this.tokens.revoke(user, presentedRefreshToken);
    this.cookies.clearAuthCookies(res);
    return { message: locals.auth.logged_out_successfully };
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current authorization details' })
  @ApiOkResponse({
    schema: {
      example: {
        userId: 'user-id',
        role: 'USER',
        permissions: { 'system.driver': 2 },
      },
    },
  })
  me(@CurrentUser() user: AuthenticatedUser) {
    return {
      userId: user.sub,
      role: user.authorization.role,
      permissions: user.authorization.permissions,
    };
  }

  /** Verify email with a token link */
  @Post('email/verify')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email with a token link' })
  async confirmEmail(
    @Body() dto: ConfirmEmailVerificationDto,
  ): Promise<ServiceResponse<void>> {
    await this.emailVerify.confirm(dto.token);
    return { message: locals.auth.email_verified };
  }

  /** Verify email with an OTP code */
  @Post('email/verify/otp')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email with an OTP code' })
  async confirmEmailByOtp(
    @Body() dto: ConfirmEmailVerificationOtpDto,
  ): Promise<ServiceResponse<void>> {
    await this.emailVerify.confirmOtp(dto.email, dto.code);
    return { message: locals.auth.email_verified };
  }

  /** Resend email verification link/OTP */
  @Post('email/verify/resend')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend email verification link/OTP' })
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async resendEmailVerification(
    @Body() dto: ResendEmailVerificationDto,
  ): Promise<ServiceResponse<void>> {
    await this.emailVerify.issueByEmail(dto.email);
    return { message: locals.auth.email_verification_sent };
  }

  /** Send a password reset email (magic link + OTP code) */
  @Post('password/forgot')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a password reset email' })
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<ServiceResponse<void>> {
    await this.passwordReset.forgot(dto.email);
    return { message: locals.auth.password_reset_email_sent };
  }

  /** Reset password with a token */
  @Post('password/reset')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with a token' })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<ServiceResponse<void>> {
    await this.passwordReset.reset(dto.token, dto.password);
    return { message: locals.auth.password_reset_successful };
  }

  /** Verify password reset OTP code */
  @Post('password/reset/otp')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify password reset OTP code' })
  @ApiOkResponse({
    schema: {
      example: {
        message: 'Password reset code verified',
        root: { resetToken: 'reset-token' },
      },
    },
  })
  async verifyPasswordResetOtp(
    @Body() dto: VerifyPasswordResetOtpDto,
  ): Promise<ServiceResponse<{ resetToken: string }>> {
    const result = await this.passwordReset.verifyOtp(dto.email, dto.code);
    return { message: locals.auth.password_reset_code_verified, root: result };
  }

  @UseGuards(JwtAuthGuard)
  /** Change password (authenticated) */
  @Patch('password/change')
  @ApiOperation({ summary: 'Change password (authenticated)' })
  async changePassword(
    @CurrentUser('sub') userId: string,
    @Body() dto: ChangePasswordDto,
  ): Promise<ServiceResponse<void>> {
    await this.passwordChange.change(
      userId,
      dto.currentPassword,
      dto.newPassword,
    );
    return { message: locals.auth.password_changed };
  }

  @UseGuards(JwtAuthGuard)
  /** Set a password for an account without one */
  @Post('password/set')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set a password for an account without one' })
  async setPassword(
    @CurrentUser('sub') userId: string,
    @Body() dto: SetPasswordDto,
  ): Promise<ServiceResponse<void>> {
    await this.passwordChange.set(userId, dto.password);
    return { message: locals.auth.password_set };
  }

  @UseGuards(JwtAuthGuard)
  /** Request an email address change */
  @Post('email/change/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request an email address change' })
  async requestEmailChange(
    @CurrentUser('sub') userId: string,
    @Body() dto: RequestEmailChangeDto,
  ): Promise<ServiceResponse<void>> {
    await this.changeContact.requestEmailChange(userId, dto.email);
    return { message: locals.auth.email_change_requested };
  }

  /** Confirm an email address change */
  @Post('email/change/confirm')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm an email address change' })
  async confirmEmailChange(
    @Body() dto: ConfirmEmailChangeDto,
  ): Promise<ServiceResponse<{ userId: string; email: string }>> {
    const result = await this.changeContact.confirmEmailChange(dto.token);
    return { message: locals.auth.email_changed, data: result };
  }

  @UseGuards(JwtAuthGuard)
  /** List enrolled two-factor methods */
  @Get('2fa/methods')
  @ApiOperation({ summary: 'List enrolled two-factor methods' })
  listTwoFactorMethods(@CurrentUser('sub') userId: string) {
    return this.twoFactor.listMethods(userId);
  }

  @UseGuards(JwtAuthGuard)
  /** Begin TOTP authenticator enrollment */
  @Post('2fa/enroll/totp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Begin TOTP authenticator enrollment' })
  async enrollTotp(@CurrentUser('sub') userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException(locals.auth.user_not_found);
    return this.totp.enroll(user);
  }

  @UseGuards(JwtAuthGuard)
  /** Confirm TOTP enrollment with a code */
  @Post('2fa/enroll/totp/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm TOTP enrollment with a code' })
  async confirmTotp(
    @CurrentUser('sub') userId: string,
    @Body() dto: ConfirmEnrollmentDto,
  ) {
    await this.totp.confirm(userId, dto.code);
    return this.helper.firstEnrollmentBackupCodes(userId);
  }

  @UseGuards(JwtAuthGuard)
  /** Begin email OTP two-factor enrollment */
  @Post('2fa/enroll/email/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Begin email OTP two-factor enrollment' })
  async enrollEmailOtp(
    @CurrentUser('sub') userId: string,
    @Body() dto: EnrollEmailOtpDto,
  ): Promise<ServiceResponse<void>> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException(locals.auth.user_not_found);
    await this.twoFactor.enrollEmailOtp(user, dto.email);
    return { message: locals.auth.two_factor_code_sent };
  }

  @UseGuards(JwtAuthGuard)
  /** Confirm email OTP enrollment with a code */
  @Post('2fa/enroll/email/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm email OTP enrollment with a code' })
  async confirmEmailOtp(
    @CurrentUser('sub') userId: string,
    @Body() dto: ConfirmEnrollmentDto,
  ) {
    await this.twoFactor.confirmEmailOtp(userId, dto.code);
    return this.helper.firstEnrollmentBackupCodes(userId);
  }

  @UseGuards(JwtAuthGuard)
  /** Begin SMS OTP two-factor enrollment */
  @Post('2fa/enroll/sms/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Begin SMS OTP two-factor enrollment' })
  async enrollSmsOtp(
    @CurrentUser('sub') userId: string,
    @Body() dto: EnrollSmsOtpDto,
  ): Promise<ServiceResponse<void>> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException(locals.auth.user_not_found);
    await this.twoFactor.enrollSmsOtp(user, dto.phone);
    return { message: locals.auth.two_factor_code_sent };
  }

  @UseGuards(JwtAuthGuard)
  /** Confirm SMS OTP enrollment with a code */
  @Post('2fa/enroll/sms/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm SMS OTP enrollment with a code' })
  async confirmSmsOtp(
    @CurrentUser('sub') userId: string,
    @Body() dto: ConfirmEnrollmentDto,
  ) {
    await this.twoFactor.confirmSmsOtp(userId, dto.code);
    return this.helper.firstEnrollmentBackupCodes(userId);
  }

  @UseGuards(JwtAuthGuard)
  /** Disable a two-factor method */
  @Delete('2fa/methods/:methodId')
  @ApiOperation({ summary: 'Disable a two-factor method' })
  async disableTwoFactor(
    @CurrentUser('sub') userId: string,
    @Param('methodId') methodId: string,
  ): Promise<ServiceResponse<void>> {
    await this.twoFactor.disable(userId, methodId);
    return { message: locals.auth.two_factor_disabled };
  }

  @UseGuards(JwtAuthGuard)
  /** Count remaining backup codes */
  @Get('2fa/backup-codes')
  @ApiOperation({ summary: 'Count remaining backup codes' })
  countBackupCodes(@CurrentUser('sub') userId: string) {
    return this.twoFactor.countBackupCodes(userId);
  }

  @UseGuards(JwtAuthGuard)
  /** Regenerate backup codes */
  @Post('2fa/backup-codes/regenerate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Regenerate backup codes' })
  regenerateBackupCodes(@CurrentUser('sub') userId: string) {
    return this.twoFactor.regenerateBackupCodes(userId);
  }

  /** Send a two-factor challenge code */
  @Post('2fa/challenge/send')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a two-factor challenge code' })
  async sendTwoFactorChallengeCode(
    @Body() dto: TwoFactorChallengeSendDto,
  ): Promise<ServiceResponse<void>> {
    await this.twoFactor.sendChallengeCode(dto.challengeId, dto.type);
    return { message: locals.auth.two_factor_code_sent };
  }

  /** Verify a two-factor challenge code */
  @Post('2fa/challenge/verify')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify a two-factor challenge code' })
  @ApiTransportHeader()
  async verifyTwoFactorChallenge(
    @Body() dto: TwoFactorChallengeVerifyDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.twoFactor.verifyChallenge(
      dto.challengeId,
      dto.type,
      dto.code,
      this.helper.requestContext(req),
    );
    const body = this.helper.deliverTokens(
      res,
      tokens,
      this.helper.wantsBearer(req),
    );
    return {
      message: locals.auth.logged_in_successfully,
      ...(body && { root: body }),
    };
  }
}
