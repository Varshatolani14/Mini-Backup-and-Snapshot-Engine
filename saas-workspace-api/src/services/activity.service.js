'use strict';

const prisma = require('../config/database');
const logger = require('../utils/logger');

async function createActivityLog({
  actionType,
  userId,
  organizationId,
  resourceType,
  resourceId,
  metadata = {},
}) {
  const activity = await prisma.activityLog.create({
    data: {
      actionType,
      userId,
      organizationId,
      resourceType,
      resourceId,
      metadata,
    },
  });

  logger.info(
    {
      activityId: activity.id,
      actionType,
      userId,
      organizationId,
    },
    'Activity log created'
  );

  return activity;
}

module.exports = {
  createActivityLog,
};