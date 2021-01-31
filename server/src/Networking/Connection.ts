import Net from 'net';
import {Protocol} from './Protocol';
import {Message} from './Message';
import * as Adler from 'adler-32';

export class ConnectionManager {
    private static instance: ConnectionManager;
    private connections: Set<Connection> = new Set();

    private constructor() {
    }

    public static getInstance(): ConnectionManager {
        if (!ConnectionManager.instance) {
            ConnectionManager.instance = new ConnectionManager();
        }

        return ConnectionManager.instance;
    }

    public createConnection(socket: Net.Socket): Connection {
        const connection = new Connection(socket);
        this.connections.add(connection);

        return connection;
    }

    public releaseConnection(connection: Connection): void {
        this.connections.delete(connection);
    }

    public closeAll(): void {
        for (const connection of this.connections) {
            connection.close();
        }

        this.connections.clear();
    }
}

export class Connection {
    private socket: Net.Socket;
    private protocol: Protocol | undefined;
    private messageQueue: Message[] = [];
    private messageBuffers: Buffer[] = [];

    constructor(socket: Net.Socket) {
        this.socket = socket;
    }

    public acceptProtocol(protocol: Protocol): void {
        this.protocol = protocol;
    }

    public accept(): void {
        this.socket.on('timeout', this.handleTimeout.bind(this));
        // this.socket.on('end', this.handleDisconnected.bind(this));

        this.socket.on('data', this.readDataIntoBuffer.bind(this));
    }

    private readDataIntoBuffer(buffer: Buffer) {
        // The data event does not guarantee that the given buffer contains a full message
        // So we should keep a larger buffer and only handle a message if we got a full message

        console.log(`Socket ${this.socket.remoteAddress} - Added buffer to messageBuffer`);
        this.socket.write(`Socket ${this.socket.remoteAddress} - Added buffer to messageBuffer`);
        this.messageBuffers.push(buffer);
        this.processMessageBuffer();

        if (this.messageBuffers.length === 12122) {
            if (this.protocol) {
                this.protocol.parsePacket(Buffer.from(''));
            }
        }
    }

    private processMessageBuffer() {
        const buffer = this.messageBuffers.shift();
        if (!buffer) {
            return;
        }

        let bufferOffset = 0;

        let messageBody;
        let messageBodyOffset = 0;
        let messageLength;
        let checksum;

        this.socket.read();
        do {
            if (!messageLength) {
                messageLength = buffer.readUInt16LE(bufferOffset);
                bufferOffset += 2;
            }

            checksum = buffer.readInt32LE(Message.HEADER_MESSAGE_SIZE_LENGTH);
            bufferOffset += 4;

            messageBody = Buffer.alloc(messageLength);

            // If the buffer length is smaller then the message length
            if (buffer.byteLength < (messageLength + Message.HEADER_SIZE)) {
                buffer.copy(messageBody, messageBodyOffset, messageBodyOffset, Message.BODY_OFFSET);
                messageBodyOffset = buffer.byteLength - Message.BODY_OFFSET;
                continue;

            }
            buffer.copy(messageBody, messageBodyOffset, Message.BODY_OFFSET, Message.BODY_OFFSET + messageLength);
            bufferOffset += Message.HEADER_SIZE + messageLength;

            const verifyChecksum = Adler.buf(messageBody);
            if (checksum !== verifyChecksum) {
                console.log('Connection: Checksum verification failed');
                continue;
            }

            const message = new Message();
            message.setLength(messageLength);
            messageBody.copy(message.getBodyBuffer(), 0, 0);


            messageBody = undefined;
            messageBodyOffset = 0;
            messageLength = undefined;
            checksum = undefined;

            console.log('Push message');
            this.messageQueue.push(message);
        } while (bufferOffset < buffer.byteLength);
    }

    public send(message: Buffer): void {
        this.socket.write(message);
    }

    public close(force: boolean = false): void {
        ConnectionManager.getInstance().releaseConnection(this);

        if (force) {
            this.socket.destroy();
            return;
        }

        this.socket.end();
    }

    public handleTimeout(): void {
        this.close(true);
    }
}
