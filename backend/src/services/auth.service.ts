import { prisma } from '../config/database';
import { hashPassword, comparePassword } from '../utils/password';
import { signToken } from '../utils/jwt';
import { ConflictError, UnauthorizedError } from '../utils/errors';
import type { RegisterInput, LoginInput } from '../validators/auth.validator';

// Safe user type — NEVER includes passwordHash
export type SafeUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

// Prisma select clause that always excludes passwordHash
const safeUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function registerUser(
  input: RegisterInput
): Promise<{ user: SafeUser; token: string }> {
  // Check for duplicate email
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  if (existing) {
    throw new ConflictError('An account with this email already exists');
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      passwordHash,
    },
    select: safeUserSelect,
  });

  const token = signToken({ sub: user.id, email: user.email });

  return { user, token };
}

export async function loginUser(
  input: LoginInput
): Promise<{ user: SafeUser; token: string }> {
  // Fetch with passwordHash for comparison only
  const userWithPassword = await prisma.user.findUnique({
    where: { email: input.email },
  });

  // Use a constant-time comparison even when user doesn't exist
  // to prevent user enumeration via timing attacks
  if (!userWithPassword) {
    await comparePassword('dummy', '$2a$12$dummyHashToPreventTimingAttacks00000000000000000');
    throw new UnauthorizedError('Invalid email or password');
  }

  const isValid = await comparePassword(input.password, userWithPassword.passwordHash);

  if (!isValid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  if (!userWithPassword.isActive) {
    throw new UnauthorizedError('Account is deactivated');
  }

  const token = signToken({ sub: userWithPassword.id, email: userWithPassword.email });

  // Fetch safe user without passwordHash
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userWithPassword.id },
    select: safeUserSelect,
  });

  return { user, token };
}

export async function getUserById(userId: string): Promise<SafeUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: safeUserSelect,
  });

  if (!user) {
    throw new UnauthorizedError('User not found');
  }

  return user;
}
