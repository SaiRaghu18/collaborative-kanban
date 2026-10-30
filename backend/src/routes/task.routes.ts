import { Router } from 'express';
import * as kanbanController from '../controllers/kanban.controller';
import { authenticate } from '../middleware/authenticate';
import { requireTaskAccess } from '../middleware/authorization';
import { validate } from '../middleware/validate';
import {
  updateTaskSchema,
  moveTaskSchema,
  reorderTasksSchema,
} from '../validators/kanban.validator';

const router = Router();

router.use(authenticate);

// PATCH  /api/tasks/reorder — Note: Placed before /:taskId to prevent route collision
router.patch(
  '/reorder',
  validate(reorderTasksSchema),
  kanbanController.reorderTasks
);

// GET    /api/tasks/:taskId
router.get(
  '/:taskId',
  requireTaskAccess,
  kanbanController.getTask
);

// PATCH  /api/tasks/:taskId
router.patch(
  '/:taskId',
  requireTaskAccess,
  validate(updateTaskSchema),
  kanbanController.updateTask
);

// PATCH  /api/tasks/:taskId/move
router.patch(
  '/:taskId/move',
  requireTaskAccess,
  validate(moveTaskSchema),
  kanbanController.moveTask
);

// DELETE /api/tasks/:taskId
router.delete(
  '/:taskId',
  requireTaskAccess,
  kanbanController.deleteTask
);

export default router;
