import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

import { UsersService, SafeUser } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { UserStatus } from '../../database/entities/user.entity';

const JWT_EXPIRY = '15m';
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret';

export interface AuthResponse {
  user: SafeUser;
  accessToken: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService, private readonly jwtService: JwtService) {}

  async register(dto: CreateUserDto): Promise<AuthResponse> {
    const user = await this.usersService.createUser(dto);
    const accessToken = this.signAccessToken(user.id, user.role);
    return { user, accessToken };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.usersService.findForAuth(dto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('Account is suspended');
    }

    const safeUser = this.usersService.sanitizeUser(user);
    const accessToken = this.signAccessToken(user.id, user.role);
    return { user: safeUser, accessToken };
  }

  private signAccessToken(userId: string, role: string): string {
    return this.jwtService.sign(
      { sub: userId, role },
      {
        secret: JWT_SECRET,
        expiresIn: JWT_EXPIRY,
      },
    );
  }
}
