import Net from 'net';
import {Protocol} from './Protocol';
import {Message} from './Message';
import {v4 as uuidv4} from 'uuid';
import {Server} from './Server';

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

    public createConnection(socket: Net.Socket, server: Server): Connection {
        const connection = new Connection(uuidv4(), socket, server);
        this.connections.add(connection);

        return connection;
    }

    public releaseConnection(connection: Connection): void {
        this.connections.delete(connection);
    }

    public getAll(): Set<Connection> {
        return this.connections;
    }

    public closeAll(): void {
        for (const connection of this.connections) {
            connection.close();
        }

        this.connections.clear();
    }
}

export class Connection {
    private static READ_TIMEOUT_MS = 30000;

    private readonly uuid: string;
    private socket: Net.Socket;
    private server: Server;

    private protocol: Protocol | null = null;

    private msg: Message | undefined;
    private receivedFirstMessage: boolean = false;

    private cancelReadPromise: (value?: unknown) => void = () => {
    };

    constructor(uuid: string, socket: Net.Socket, server: Server) {
        this.uuid = uuid;
        this.socket = socket;
        this.server = server;
    }

    public acceptProtocol(protocol: Protocol): void {
        this.protocol = protocol;
        this.accept();
    }

    public accept(): void {
        this.log('Connected');
        this.socket.on('timeout', this.handleTimeout.bind(this));
        this.socket.on('end', this.handleEnd.bind(this));

        this.parseMessages();
    }

    public send(message: Buffer): void {
        this.socket.write(message);
    }

    public close(): void {
        this.log('Close client socket');

        this.cancelReadPromise();
        this.cancelReadPromise();

        ConnectionManager.getInstance().releaseConnection(this);
        this.socket.destroy();
    }

    private parseMessages(): void {
        this.executeReadPromise(this.parseMessageHeader(), Connection.READ_TIMEOUT_MS)
            .then(() => {
                if (this.socket.destroyed) {
                    return;
                }

                return this.executeReadPromise(this.parseMessageBody(), Connection.READ_TIMEOUT_MS)
                    .then(() => {
                        if (!this.socket.destroyed) {
                            setImmediate(() => {
                                this.parseMessages();
                            });
                        }
                    })
                    .catch((error) => {
                        this.log(`Body parse error: ${error}`);
                        this.handleTimeout();
                    });
            })
            .catch((error) => {
                this.log(`Header parse error: ${error}`);
                this.handleTimeout();
            });
    }

    private async parseMessageHeader(): Promise<void> {
        const header = await this.readBytes(Message.HEADER_SIZE);
        if (!header) {
            this.log('Message header could not be read from internal buffer');
            this.close();
            return;
        }

        // Check if too many packets have been sent per/s

        const messageLength = header.readInt16LE();
        if (messageLength == 0 || messageLength > Message.MAX_BODY_SIZE) {
            this.log(`Invalid message length ${messageLength}`);
            this.close();
            return;
        }

        const checksum = header.readInt32LE(Message.HEADER_MESSAGE_SIZE_LENGTH);

        this.msg = new Message();
        this.msg.setLength(messageLength);
        this.msg.setChecksum(checksum);
    }

    private async parseMessageBody(): Promise<void> {
        if (!this.msg) {
            this.close();
            return;
        }

        const messageBodyBuffer = await this.readBytes(this.msg.getLength());
        if (!messageBodyBuffer) {
            this.log('Message body could not be read from internal buffer');
            this.close();
            return;
        }

        this.msg.getBodyBuffer().set(messageBodyBuffer);
        if (this.msg.calcChecksum() !== this.msg.getChecksum()) {
            this.log(`Message checksum (${this.msg.getChecksum()} does not match calculated checksum (${this.msg.calcChecksum()})`);
        }

        this.log(`Incoming message with length ${this.msg.getLength()}`);

        if (!this.receivedFirstMessage) {
            this.receivedFirstMessage = true;

            if (!this.protocol) {
                this.protocol = this.server.makeProtocol(this.msg, this);
                if (!this.protocol) {
                    this.log('Invalid protocolId in message');
                    this.close();
                    return;
                }
            } else {
                this.msg.skipBytes(1);
            }

            this.protocol.onReceiveFirstMessage(this.msg);
            return;
        }

        if (!this.protocol) {
            this.close();
            return;
        }

        this.protocol.onReceiveMessage(this.msg);
    }

    private handleTimeout(): void {
        this.log('Connection timed out');
        this.close();
    }

    private handleEnd(): void {
        this.log('Client closed connection');
        this.close();
    }

    private async readable(): Promise<void> {
        return new Promise((resolve) => {
            this.socket.once('readable', resolve);
        });
    };

    private async readBytes(num: number, tries: number = 0): Promise<Buffer | null> {
        let buffer: Buffer | undefined;

        buffer = this.socket.read(num);
        if (buffer) {
            return buffer;
        }

        if (tries == 30) {
            return null;
        }

        return new Promise((resolve) => {
            this.readable().then(() => {
                this.readBytes(num, ++tries).then((buffer) => {
                    resolve(buffer);
                });
            });
        });
    }

    private executeReadPromise(promise: Promise<any>, ms: number) {
        const timeoutPromise = new Promise((_resolve, reject) => {
            let id = setTimeout(() => {
                clearTimeout(id);
                reject(`Timed out in ${ms}ms.`);
            }, ms);
        });

        return Promise.race([
            promise,
            timeoutPromise,
            new Promise((resolve) => this.cancelReadPromise = resolve)
        ]);
    }

    private log(msg: string): void {
        console.log(`[Server] ${this.server.getUuid()} [Socket] ${this.uuid} - ${msg}`);
    }
}
