'use strict';
const dbModule = require('./dbModule')
const validationModule = require('./validationModule')

const { v4: uuidv4 } = require('uuid');



module.exports.postOrganization = async (event) => {
  try {
    let body = extractBody(event)
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

    return getResponseObject(200, item)
  } catch (error) {
    return handleError(error);
  }
};

module.exports.postUser = async (event) => {
  try {
    const orgId = event.pathParameters.orgId;

    if (!(await dbModule.orgExistsById(orgId))) {
      throw new RequestException(400, "Organization not found");
    }

    let body = extractBody(event)

    let user = validationModule.validatePostUser(body);

    if (user.errorMessage) {
      throw new RequestException(400, user.errorMessage);
    }

    if (await dbModule.userExistsByEmail(user.email)) {
      throw new RequestException(400, "User with this email already exists");
    }

    let item = {
      userId: uuidv4(),
      orgId: orgId,
      ...user
    }

    await dbModule.saveUser(item)

    return getResponseObject(200, item)
  } catch (error) {
    return handleError(error)
  }
}

module.exports.putOrganization = async (event) => {
  try {
    let body = extractBody(event)
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

    return getResponseObject(200, result.Attributes);
  } catch (error) {
    return handleError(error)
  }
}

module.exports.putUser = async (event) => {
  try {
    const orgId = event.pathParameters.orgId;
    const body = extractBody(event);
    const user = validationModule.validatePutUser(body);

    if (user.errorMessage) {
      throw new RequestException(400, user.errorMessage);
    }

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

    return getResponseObject(200, result.Attributes);
  } catch (error) {
    return handleError(error)
  }
}

function getResponseObject(code, body) {
  return {
    statusCode: code,
    body: JSON.stringify(body)
  }
}

function extractBody(event) {
  try {
    return JSON.parse(event.body)
  } catch (error) {
    throw new RequestException(400, "Invalid Json body");
  }
}

function handleError(error) {
  if (error instanceof RequestException) {
    return getResponseObject(error.code, {
      message: error.message
    })
  }
  console.log(error);
  return getResponseObject(500, {
    message: error.message
  })
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