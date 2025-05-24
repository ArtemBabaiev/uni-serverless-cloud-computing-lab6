'use strict';

const yup = require('yup');
const { v4: uuidv4 } = require('uuid');
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");


const postOrgSchema = yup.object({
  name: yup.string().trim().required('Name is required'),
  description: yup.string().trim().required('Description is required')
});

const postUserSchema = yup.object({
  name: yup.string().trim().required('Name is required'),
  email: yup.string().email('Invalid email').trim().required('Email is required'),
});

const putOrgSchema = yup.object({
  orgId: yup.string().required("Organization Id is required"),
  name: yup.string().trim(),
  description: yup.string().trim()
});

const putUserSchema = yup.object({
  userId: yup.string().required('User ID is required'),
  name: yup.string().trim(),
  email: yup.string().email('Invalid email').trim()
});

const ORGANIZATIONS_TABLE = 'organizationsTable';
const USERS_TABLE = 'usersTable';

const client = new DynamoDBClient({
  region: 'eu-west-1',
  endpoint: 'http://0.0.0.0:8000',
  credentials: {
    accessKeyId: 'MockAccessKeyId',
    secretAccessKey: 'MockSecretAccessKey'
  },
});

const docClient = DynamoDBDocumentClient.from(client);

module.exports.postOrganization = async (event) => {
  try {
    let body = extractBody(event)
    let organization = validate(body, postOrgSchema);

    if (await orgExistsByName(organization.name)) {
      throw new RequestException(400, "Organization with this name already exists");
    }

    let item = {
      orgId: uuidv4(),
      ...organization
    }

    await performCommand(PutCommand,
      {
        TableName: ORGANIZATIONS_TABLE,
        Item: item
      }
    )
    return getResponseObject(200, item)
  } catch (error) {
    return handleError(error);
  }
};

module.exports.postUser = async (event) => {
  try {
    const orgId = event.pathParameters.orgId;

    if (!(await orgExistsById(orgId))) {
      throw new RequestException(400, "Organization not found");
    }

    let body = extractBody(event)

    let user = validate(body, postUserSchema);

    if (await userExistsByEmail(user.email)) {
      throw new RequestException(400, "User with this email already exists");
    }

    let item = {
      userId: uuidv4(),
      orgId: orgId,
      ...user
    }

    await performCommand(PutCommand, {
      TableName: USERS_TABLE,
      Item: item
    })

    return getResponseObject(200, item)
  } catch (error) {
    return handleError(error)
  }
}

module.exports.putOrganization = async (event) => {
  try {
    let body = extractBody(event)
    let organization = validate(body, putOrgSchema);

    if (!(await orgExistsById(organization.orgId))) {
      throw new RequestException(404, 'Organization not found');
    }

    let updates = {};
    if (organization.name !== undefined) {
      updates.name = organization.name
      if (await orgExistsByName(organization.name)) {
        throw new RequestException(400, "Organization with this name already exists");
      }
    };
    if (organization.description !== undefined) updates.description = organization.description;

    if (Object.keys(updates).length === 0) {
      throw new RequestException(400, 'At least one of name or description must be provided');
    }

    let params = getUpdateParams(updates)

    let result = await performCommand(UpdateCommand, {
      TableName: ORGANIZATIONS_TABLE,
      Key: {
        orgId: organization.orgId
      },
      UpdateExpression: params.expression,
      ExpressionAttributeNames: params.attributesNames,
      ExpressionAttributeValues: params.attributesValues,
      ReturnValues: 'ALL_NEW'
    })

    return getResponseObject(200, result.Attributes);
  } catch (error) {
    return handleError(error)
  }
}

module.exports.putUser = async (event) => {
  try {
    const orgId = event.pathParameters.orgId;
    const body = extractBody(event);
    const user = validate(body, putUserSchema);

    if (!(await orgExistsById(orgId))) {
      throw new RequestException(400, "Organization not found");
    }

    const getResult = await performCommand(GetCommand, {
      TableName: USERS_TABLE,
      Key: { userId: user.userId }
    });

    if (!getResult.Item) {
      throw new RequestException(404, 'User not found');
    }

    if (getResult.Item.orgId !== orgId) {
      throw new RequestException(403, 'User does not belong to the specified organization');
    }

    let updates = {};
    if (user.name !== undefined) updates.name = user.name;
    if (user.email !== undefined) {
      updates.email = user.email
      if (await userExistsByEmail(user.email, user.userId)) {
        throw new RequestException(400, "User with this email already exists");
      }
    };

    if (Object.keys(updates).length === 0) {
      throw new RequestException(400, 'At least one of name or email must be provided');
    }

    let params = getUpdateParams(updates)

    const result = await performCommand(UpdateCommand, {
      TableName: USERS_TABLE,
      Key: { userId: user.userId },
      UpdateExpression: params.expression,
      ExpressionAttributeNames: params.attributesNames,
      ExpressionAttributeValues: params.attributesValues,
      ReturnValues: 'ALL_NEW'
    });

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

function validate(obj, schema) {
  try {
    return schema.validateSync(obj, { abortEarly: false, strict: true })
  } catch (error) {
    throw new RequestException(400, error.errors.join(" "));
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

function performCommand(CommandClass, params) {
  return docClient.send(new CommandClass(params));
}

async function orgExistsByName(nameValue) {
  const queryResult = await performCommand(QueryCommand, {
    TableName: ORGANIZATIONS_TABLE,
    IndexName: 'name-index',
    KeyConditionExpression: '#n = :name',
    ExpressionAttributeNames: {
      '#n': 'name'
    },
    ExpressionAttributeValues: {
      ':name': nameValue
    }
  });

  return queryResult.Items.length > 0;
}

async function userExistsByEmail(email, excludeUserId = null) {
  const result = await performCommand(QueryCommand, {
    TableName: USERS_TABLE,
    IndexName: 'email-index',
    KeyConditionExpression: 'email = :email',
    ExpressionAttributeValues: {
      ':email': email
    }
  });

  return result.Items.some(user => user.userId !== excludeUserId);
}

async function orgExistsById(orgId) {
  let result = await performCommand(GetCommand,
    {
      TableName: ORGANIZATIONS_TABLE,
      Key: {
        orgId: orgId
      }
    }
  );

  if (result.Item) {
    return true;
  }
  return false;
}

function getUpdateParams(updates) {
  let expression = 'SET ' + Object.keys(updates)
    .map((key, index) => `#${key} = :${key}`)
    .join(', ');
  let attributesNames = {}
  let attributesValues = {}
  Object.keys(updates).forEach((key, index) => {
    attributesNames[`#${key}`] = `${key}`;
    attributesValues[`:${key}`] = updates[`${key}`];
  });

  return { expression, attributesNames, attributesValues }
}
class RequestException extends Error {
  constructor(code, message) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }
}