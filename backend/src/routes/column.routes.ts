import { Router } from 'express';
import * as kanbanController from '../controllers/kanban.controller';
import { authenticate } from '../middleware/authenticate';
import { requireColumnAccess } from '../middleware/authorization';
import { validate } from '../middleware/validate';
import {
  updateColumnSchema,
  createTaskSchema,
} from '../validators/kanban.validator';

const router = Router();

router.use(authenticate);

// GET    /api/columns/:columnId
router.get(
  '/:columnId',
  requireColumnAccess,
  kanbanController.getColumn
);

// PATCH  /api/columns/:columnId
router.patch(
  '/:columnId',
  requireColumnAccess,
  validate(updateColumnSchema),
  kanbanController.updateColumn
);

// DELETE /api/columns/:columnId
router.delete(
  '/:columnId',
  requireColumnAccess,
  kanbanController.deleteColumn
);

// ─── Tasks inside Column ──────────────────────────────────────────────────────

// POST   /api/columns/:columnId/tasks
router.post(
  '/:columnId/tasks',
  requireColumnAccess,
  validate(createTaskSchema),
  kanbanController.createTask
);

// GET    /api/columns/:columnId/tasks
router.get(
  '/:columnId/tasks',
  requireColumnAccess,
  kanbanController.listTasks
);

export default router;
