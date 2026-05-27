from confluent_kafka import Consumer
import json

consumer = Consumer({
    'bootstrap.servers': 'localhost:9092',
    'group.id': 'ppe-service',
    'auto.offset.reset': 'earliest'
})

consumer.subscribe(['ppe-events'])

while True:
    msg = consumer.poll(1.0)

    if msg is None:
        continue

    if msg.error():
        print(msg.error())
        continue

    data = json.loads(msg.value().decode())
    print(data)