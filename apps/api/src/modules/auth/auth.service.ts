// src/modules/auth/auth.service.ts

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';

export interface LoginDto {
  username: string;
  password: string;
}

const VALID_USERS = ['me', 'wife'] as const;
type ValidUser = typeof VALID_USERS[number];

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto): Promise<{ access_token: string; user: ValidUser }> {
    const { username, password } = dto;

    if (!VALID_USERS.includes(username as ValidUser)) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const storedPassword = this.config.get<string>(`users.${username}.password`);
    if (!storedPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Support both plain-text (dev) and bcrypt-hashed (prod) passwords
    let valid: boolean;
    if (storedPassword.startsWith('$2')) {
      valid = await bcrypt.compare(password, storedPassword);
    } else {
      valid = password === storedPassword;
    }

    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: username, username };
    const token = this.jwtService.sign(payload);

    return { access_token: token, user: username as ValidUser };
  }

  verifyToken(token: string) {
    return this.jwtService.verify(token);
  }
}
