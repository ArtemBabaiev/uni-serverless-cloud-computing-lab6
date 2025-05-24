aws --endpoint-url=http://localhost:9324 sqs send-message \
  --queue-url http://localhost:9324/queue/main-queue \
  --message-body '{
    "eventType": "update.organization",
    "orgId": "82f360d4-0410-495c-8de4-606aa8ddbce2",
    "name": "newNameValue_UPD",
    "description": "descValue2"
}'