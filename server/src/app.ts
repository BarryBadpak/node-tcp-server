import * as net from 'net';
import {Protocol, ProtocolService} from './Networking/Protocol';
import {ServerManager} from './Networking/Server';
import {Message, OutMessage} from './Networking/Message';

class TestProtocol extends Protocol {
    onConnect(): void {
    }

    parsePacket(message: Buffer): void {
        console.log('Parse packet: ' + message.toString());
    }

    onReceiveFirstMessage(msg: Message): void {
        console.log('First message: ' + msg.getBodyBuffer().toString());
    }

    onReceiveMessage(msg: Message): void {
        console.log('message message: ' + msg.getBodyBuffer().toString());
    }
}

class TestProtocolService extends ProtocolService {
    readonly isCheckSummed: boolean = true;
    readonly protocolIdentifier: number = 1;
    readonly protocolName: string = 'Test protocol';
    readonly serverSendsFirst: boolean = false;

    constructor() {
        super(TestProtocol);
    }
}

const serverManager = new ServerManager();
serverManager.add(new TestProtocolService(), 8125);

function createClient(msg: string, interval: number = 100) {
    const client = net.createConnection({port: 8125}, () => {
        const outMessage = new OutMessage();
        outMessage.addUint8(1);
        outMessage.addString(msg);

        console.log('[Client] User connected');

        const intervalId = setInterval(() => {
            client.write(outMessage.getOutputBuffer());
        }, interval);

        client.on('error', (error) => {
            console.log(`[Client] Error - ${error}`);
            clearInterval(intervalId);
        });

        client.on('end', () => {
            console.log(`[Client] Connection closed by remote`);
            clearInterval(intervalId);
        });
    });
}

for (let i = 0; i < 25; i++) {
    createClient(`Bericht ${i + 1}`);
}

// Valid protocol message sending
// const client = net.createConnection({port: 8125}, () => {
//     const outMessage = new OutMessage();
//     outMessage.addUint8(1);
//     outMessage.addString('bericht_1');
//
//     console.log('[Client] User connected');
//
//     const intervalId = setInterval(() => {
//         client.write(outMessage.getOutputBuffer());
//     }, 2000);
//
//     client.on('error', (error) => {
//         console.log(`[Client] Error - ${error}`);
//         clearInterval(intervalId);
//     });
//
//     client.on('end', () => {
//         console.log(`[Client] Connection closed by remote`);
//         clearInterval(intervalId);
//     });
// });

// Invalid protocol message sending
// const client2 = net.createConnection({port: 8125}, () => {
//     const outMessage2 = new OutMessage();
//     outMessage2.addString('bericht 2');
//
//     const intervalId = setInterval(() => {
//         client2.write(outMessage2.getOutputBuffer());
//     }, 2000);
//
//     client2.on('error', (error) => {
//         console.log(`[Client] Error - ${error}`);
//         clearInterval(intervalId);
//     });
//
//     client2.on('end', () => {
//         console.log(`[Client] Connection closed by remote`);
//         clearInterval(intervalId);
//     });
// });
