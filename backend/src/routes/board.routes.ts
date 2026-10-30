import { Router } from 'express';
import * as kanbanController from '../controllers/kanban.controller';
import { authenticate } from '../middleware/authenticate';
import { requireBoardAccess } from '../middleware/authorization';
import { validate } from '../middleware/validate';
import {
  updateBoardSchema,
  createColumnSchema,
  reorderColumnsSchema,
} from '../validators/kanban.validator';

const router = Router();

router.use(authenticate);

// GET    /api/boards/:boardId
router.get(
  '/:boardId',
  requireBoardAccess,
  kanbanController.getBoard
);

// PATCH  /api/boards/:boardId
router.patch(
  '/:boardId',
  requireBoardAccess,
  validate(updateBoardSchema),
  kanbanController.updateBoard
);

// DELETE /api/boards/:boardId
router.delete(
  '/:boardId',
  requireBoardAccess,
  kanbanController.deleteBoard
);

// ─── Columns inside Board ─────────────────────────────────────────────────────

// POST   /api/boards/:boardId/columns
router.post(
  '/:boardId/columns',
  requireBoardAccess,
  validate(createColumnSchema),
  kanbanController.createColumn
);

// GET    /api/boards/:boardId/columns
router.get(
  '/:boardId/columns',
  requireBoardAccess,
  kanbanController.listColumns
);

// PATCH  /api/boards/:boardId/columns/reorder
router.patch(
  '/:boardId/columns/reorder',
  requireBoardAccess,
  validate(reorderColumnsSchema),
  kanbanController.reorderColumns
);

export default router;
