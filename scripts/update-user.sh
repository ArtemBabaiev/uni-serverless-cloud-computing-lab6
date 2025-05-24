aws --endpoint-url=http://localhost:9324 sqs send-message \
  --queue-url http://localhost:9324/queue/main-queue \
  --message-body '{
    "eventType": "update.user",
    "orgId": "82f360d4-0410-495c-8de4-606aa8ddbce2",
    "userId": "bf698f92-e0d3-4539-99c0-1e9b529701ec",
    "name":"First Last UPD",
    "email": "test@email.com"
}'