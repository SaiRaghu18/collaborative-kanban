import { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { sendSuccess, sendCreated } from '../utils/apiResponse';

export async function register(req: Request, res: Response): Promise<void> {
  const { user, token } = await authService.registerUser(req.body);
  sendCreated(res, { user, token }, 'Account created successfully');
}

export async function login(req: Request, res: Response): Promise<void> {
  const { user, token } = await authService.loginUser(req.body);
  sendSuccess(res, { user, token }, 'Login successful');
}

export async function logout(_req: Request, res: Response): Promise<void> {
  // JWT is stateless — the client discards the token.
  // In a production system, you would add the token to a denylist here.
  sendSuccess(res, null, 'Logged out successfully');
}

export async function getCurrentUser(req: Request, res: Response): Promise<void> {
  const user = await authService.getUserById(req.user!.id);
  sendSuccess(res, { user });
}
