import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { sendUnauthorized } from '../utils/apiResponse';
import { prisma } from '../config/database';

// Augment Express Request to carry authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
      };
    }
  }
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendUnauthorized(res, 'No token provided');
      return;
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    const payload = verifyToken(token);

    // Verify the user still exists and is active in the database
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        // passwordHash is deliberately excluded
      },
    });

    if (!user || !user.isActive) {
      sendUnauthorized(res, 'User account not found or deactivated');
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    next();
  } catch {
    sendUnauthorized(res, 'Invalid or expired token');
  }
}
