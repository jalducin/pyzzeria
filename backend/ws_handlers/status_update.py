import json
import os

import boto3
from botocore.exceptions import ClientError

from backend.dynamo import delete_connection, get_connections_for_order, update_order_status


def handler(event, context):
    order_id = event["orderId"]
    new_status = event["newStatus"]
    estimated_seconds = event.get("estimatedSeconds")

    update_order_status(order_id, new_status)

    connections = get_connections_for_order(order_id)
    if not connections:
        return {"statusCode": 200}

    ws_url = os.environ.get("WS_ENDPOINT_URL")
    apigw = boto3.client("apigatewaymanagementapi", endpoint_url=ws_url)

    message = json.dumps({
        "type": "status_update",
        "orderId": order_id,
        "status": new_status,
        "estimatedSeconds": estimated_seconds,
    })

    for conn in connections:
        cid = conn["connectionId"]
        try:
            apigw.post_to_connection(Data=message.encode(), ConnectionId=cid)
        except ClientError as e:
            if e.response["Error"]["Code"] == "GoneException":
                delete_connection(cid)

    return {"statusCode": 200}
