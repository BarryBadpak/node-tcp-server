import * as net from 'net';
import {Protocol, ProtocolService} from './Networking/Protocol';
import {ServerManager} from './Networking/Server';
import {OutMessage} from './Networking/Message';

class TestProtocol extends Protocol {
    onConnect(): void {
    }

    onFirstMessageReceived(message: Buffer): void {
        console.log('First message: ' + message.toString());
    }

    parsePacket(message: Buffer): void {
        console.log('Parse packet: ' + message.toString());
    }
}

class TestProtocolService extends ProtocolService {
    readonly isCheckSummed: boolean = true;
    readonly protocolIdentifier: number = 0x0f;
    readonly protocolName: string = 'Test protocol';
    readonly serverSendsFirst: boolean = false;

    constructor() {
        super(TestProtocol);
    }
}

const serverManager = new ServerManager();
serverManager.add(new TestProtocolService(), 8125);
// serverManager.add(TestProtocol, 8126);


const server = net.createServer((connection) => {
    console.log('Client connected', connection.address());

    // connection.on('data', (data: Buffer) => {
    //     console.log(`Incoming data "${data.toString()}"`);
    // });

    connection.on('readable', () => {
        const data = connection.read();
        console.log(`Incoming data "${data.toString()}"`);
    });

    connection.on('end', () => {
        console.log('Client disconnected');
    });

    connection.write('hello\r\n');
    // connection.pipe(connection);
});

server.listen(8124, () => {
    console.log('Server started', server.address());
});

// const server2 = net.createServer((connection) => {
//     console.log('Client connected', connection.address());
//
//     connection.on('data', (data: Buffer) => {
//         console.log(`Incoming data "${data.toString()}"`);
//     });
//
//     connection.on('end', () => {
//         console.log('Client disconnected');
//     });
//
//     connection.write('hello\r\n');
//     // connection.pipe(connection);
// });
//
// server2.listen(8125, () => {
//     console.log('Server started', server2.address());
// });

const client = net.createConnection({port: 8125}, () => {
    const outMessage = new OutMessage();
    outMessage.addString('je moeder');

    console.log('User connected');
    client.write(outMessage.getOutputBuffer());
    client.write(outMessage.getOutputBuffer());
    client.write(outMessage.getOutputBuffer());
    client.write(outMessage.getOutputBuffer());
    client.write(outMessage.getOutputBuffer());
    client.write(outMessage.getOutputBuffer());
});
