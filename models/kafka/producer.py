import json
from .config import producer

def produce(topic:str,event:dict):
    producer.produce(
        topic,
        json.dumps(event).encode("utf-8")
    )
    producer.flush()



event = {
    "camera_id": 1,
    "event": "helmet_missing",
    "confidence": 0.94
}


produce('ppe-event',event)