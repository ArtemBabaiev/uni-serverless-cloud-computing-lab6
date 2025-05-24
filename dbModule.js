const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");

module.exports = {
  saveOrganization,
  saveUser,
  updateOrganization,
  updateUser,
  getUserById,
  orgExistsById,
  userExistsByEmail,
  orgExistsByName
};

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

function saveOrganization(item){
    return performPut({
        TableName: ORGANIZATIONS_TABLE,
        Item: item
      }
    )
}

function saveUser(item){
    return performPut({
      TableName: USERS_TABLE,
      Item: item
    })
}

function updateOrganization(orgId, updates){
    let params = getUpdateParams(updates)
    return performUpdate({
      TableName: ORGANIZATIONS_TABLE,
      Key: {
        orgId: orgId
      },
      UpdateExpression: params.expression,
      ExpressionAttributeNames: params.attributesNames,
      ExpressionAttributeValues: params.attributesValues,
      ReturnValues: 'ALL_NEW'
    })
}

function updateUser(userId, updates){
    let params = getUpdateParams(updates)
    return performUpdate({
      TableName: USERS_TABLE,
      Key: { userId: userId },
      UpdateExpression: params.expression,
      ExpressionAttributeNames: params.attributesNames,
      ExpressionAttributeValues: params.attributesValues,
      ReturnValues: 'ALL_NEW'
    });
}

function getUserById(userId){
    return performGet({
      TableName: USERS_TABLE,
      Key: { userId: userId }
    })
}

async function orgExistsById(orgId) {
  let result = await performGet({
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

async function userExistsByEmail(email, excludeUserId = null) {
  const result = await perfromQuery({
    TableName: USERS_TABLE,
    IndexName: 'email-index',
    KeyConditionExpression: 'email = :email',
    ExpressionAttributeValues: {
      ':email': email
    }
  });

  return result.Items.some(user => user.userId !== excludeUserId);
}

async function orgExistsByName(nameValue) {
  const queryResult = await perfromQuery({
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

function performCommand(CommandClass, params) {
  return docClient.send(new CommandClass(params));
}

function performGet(params){
    return performCommand(GetCommand, params)
}

function performPut(params) {
    return performCommand(PutCommand, params)
}

function performUpdate(params) {
    return performCommand(UpdateCommand, params)
}

function perfromQuery(params){
  return performCommand(QueryCommand, params)
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