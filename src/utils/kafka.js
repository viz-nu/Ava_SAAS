
import { Kafka, logLevel } from 'kafkajs'
const brokers = ['98.84.157.16:9094']


export async function sendKafkaMessage({ topic, message, acks = -1, }) {
    const kafka = new Kafka({ clientId: 'avakado-producer', brokers, logLevel: logLevel.ERROR })
    const producer = kafka.producer()
    try {
        await producer.connect()
        await producer.send({ topic, messages: [message], acks })// { key, value, headers, partition }
    } catch (error) {
        console.error('Error sending Kafka message:', error)
    } finally {
        await producer.disconnect()
    }
}