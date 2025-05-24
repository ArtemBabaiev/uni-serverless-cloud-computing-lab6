'use strict';
const dbModule = require('./dbModule')
const validationModule = require('./validationModule')

const { v4: uuidv4 } = require('uuid');

const eventHandlers = {
  'create.organization': postOrganization,
  'create.user': postUser,
  'update.organization': putOrganization,
  'update.user': putUser
};

module.exports.sqsHandler = async (event) => {
  for (const record of event.Records) {
    console.log(`Processing ${record.messageId}`);

    let payload;

    try {
      payload = JSON.parse(record.body);
    } catch {
      console.error('Invalid JSON in SQS message');
      continue;
    }

    const eventType = payload.eventType;

    if (!eventType) {
      console.warn('Missing eventType in message body');
      continue;
    }

    console.log(`Event Type: ${eventType}`)

    try {
      const handler = eventHandlers[eventType];
      if (!handler) {
        console.warn(`Unknown eventType: ${eventType}`);
        continue;
      }
      await handler(payload);
    } catch (err) {
      console.error(`Failed to process ${record.messageId} - ${eventType}:`, err);
    }
  }
};

async function postOrganization(body) {
  let organization = validationModule.validatePostOrganization(body);

  if (organization.errorMessage) {
    throw new RequestException(400, organization.errorMessage);
  }

  if (await dbModule.orgExistsByName(organization.name)) {
    throw new RequestException(400, "Organization with this name already exists");
  }

  let item = {
    orgId: uuidv4(),
    ...organization
  }

  await dbModule.saveOrganization(item)
  console.log(`Created Organization id=${item.orgId}`);
}

async function postUser(body) {
  let user = validationModule.validatePostUser(body);

  if (user.errorMessage) {
    throw new RequestException(400, user.errorMessage);
  }

  if (!(await dbModule.orgExistsById(user.orgId))) {
    throw new RequestException(400, "Organization not found");
  }

  if (await dbModule.userExistsByEmail(user.email)) {
    throw new RequestException(400, "User with this email already exists");
  }

  let item = {
    userId: uuidv4(),
    ...user
  }

  await dbModule.saveUser(item)

  console.log(`Created User id=${item.userId}`);
}

async function putOrganization(body) {
  let organization = validationModule.validatePutOrganization(body);

  if (organization.errorMessage) {
    throw new RequestException(400, organization.errorMessage);
  }

  if (!(await dbModule.orgExistsById(organization.orgId))) {
    throw new RequestException(404, 'Organization not found');
  }

  let updates = {};
  if (organization.name !== undefined) {
    updates.name = organization.name
    if (await dbModule.orgExistsByName(organization.name)) {
      throw new RequestException(400, "Organization with this name already exists");
    }
  };
  if (organization.description !== undefined) updates.description = organization.description;

  if (isEmpty(updates)) {
    throw new RequestException(400, 'At least one of name or description must be provided');
  }

  let result = await dbModule.updateOrganization(organization.orgId, updates)

  console.log(`Updated organization ${result.Attributes}`);

}

async function putUser(body) {
  const user = validationModule.validatePutUser(body);
  if (user.errorMessage) {
    throw new RequestException(400, user.errorMessage);
  }

  const orgId = user.orgId;

  if (!(await dbModule.orgExistsById(orgId))) {
    throw new RequestException(400, "Organization not found");
  }

  const userResult = await dbModule.getUserById(user.userId);

  if (!userResult.Item) {
    throw new RequestException(404, 'User not found');
  }

  if (userResult.Item.orgId !== orgId) {
    throw new RequestException(403, 'User does not belong to the specified organization');
  }

  let updates = {};
  if (user.name !== undefined) updates.name = user.name;
  if (user.email !== undefined) {
    updates.email = user.email
    if (await dbModule.userExistsByEmail(user.email, user.userId)) {
      throw new RequestException(400, "User with this email already exists");
    }
  };

  if (isEmpty(updates)) {
    throw new RequestException(400, 'At least one of name or email must be provided');
  }

  const result = await dbModule.updateUser(user.userId, updates);
  console.log(`Updated user ${result.Attributes}`);

}

function isEmpty(obj) {
  return !obj || Object.keys(obj).length === 0;
}

class RequestException extends Error {
  constructor(code, message) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }
}