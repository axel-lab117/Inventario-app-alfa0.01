import { Controller, Post, Body, Get, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { z } from 'zod';

const LoginDto = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  rememberMe: z.boolean().optional(),
});

const RegisterDto = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  tenantName: z.string().min(2),
  tenantSlug: z.string().min(2).regex(/^[a-z0-9-]+$/),
});

const RefreshDto = z.object({
  refreshToken: z.string(),
});

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('login')
  @UseGuards(LocalAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión' })
  async login(@Body() body: z.infer<typeof LoginDto>, @Req() req: any) {
    return this.auth.login(body.email, body.password, body.rememberMe);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar nuevo tenant y usuario owner' })
  async register(@Body() body: z.infer<typeof RegisterDto>) {
    return this.auth.register(body);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar access token' })
  async refresh(@Body() body: z.infer<typeof RefreshDto>) {
    return this.auth.refresh(body.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cerrar sesión' })
  async logout(@CurrentUser('id') userId: string) {
    return this.auth.logout(userId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener usuario actual' })
  async me(@CurrentUser() user: any) {
    return this.auth.me(user.id);
  }
}