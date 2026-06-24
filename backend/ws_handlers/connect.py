from backend.dynamo import save_connection


def handler(event, context):
    connection_id = event["requestContext"]["connectionId"]
    order_id = (event.get("queryStringParameters") or {}).get("orderId", "")
    if order_id:
        save_connection(connection_id, order_id)
    return {"statusCode": 200}
