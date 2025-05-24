aws --endpoint-url=http://localhost:9324 sqs send-message \
  --queue-url http://localhost:9324/queue/main-queue \
  --message-body '{"eventType": "create.organization", "name": "Test Org", "description": "desc"}'