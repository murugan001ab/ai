from confluent_kafka import Producer
import json

producer = Producer({
    'bootstrap.servers': '192.168.0.122:9092'
})

