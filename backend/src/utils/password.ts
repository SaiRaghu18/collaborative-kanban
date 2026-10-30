import bcrypt from 'bcryptjs';
import { config } from '../config/env';

export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, config.bcrypt.saltRounds);
}

export async function comparePassword(
  plainText: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}
