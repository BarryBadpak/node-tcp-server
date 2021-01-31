import * as Net from 'net';
import InvalidPortError from '../Errors/InvalidPortError';
import AddressInUseError from '../Errors/AddressInUseError';
import {Connection, ConnectionManager} from './Connection';
import {Protocol, ProtocolService} from './Protocol';
import {Message} from './Message';
import {v4 as uuid4} from 'uuid';

export class ServerManager {
    private servers: Map<number, Server> = new Map();

    public add(protocolService: ProtocolService, port: number): void {
        if (port <= 0) {
            throw new InvalidPortError(
                `Invalid port provided for service "${protocolService.protocolName}". 
                Service has not been added.`
            );
        }

        let server: Server;
        if (!this.servers.has(port)) {
            server = new Server(uuid4());
            server.addProtocolService(protocolService);
            server.open(port);

            this.servers.set(port, server);
            return;
        }

        server = this.servers.get(port) as Server;
        if (server.isSingleSocket() || protocolService.serverSendsFirst) {
            throw new AddressInUseError(
                `Protocol "${protocolService.protocolName}" and "${server.getProtocolNames()}"
                cannot use the same port.`
            );
        }

        server.addProtocolService(protocolService);
    }

    public stop(): void {
        if (!this.isRunning()) {
            return;
        }

        ConnectionManager.getInstance().closeAll();

        for (const server of this.servers.values()) {
            server.stop();
        }

        this.servers.clear();
    }

    public isRunning(): boolean {
        return this.servers.size !== 0;
    }
}


export class Server {
    private readonly uuid: string;
    // @ts-ignore
    private server: Net.Server;
    private port: number | undefined;
    private services: ProtocolService[] = [];

    constructor(uuid: string) {
        this.uuid = uuid;
    }

    public open(port: number): void {
        this.port = port;

        this.server = Net.createServer();
        this.server.on('listening', this.onListening.bind(this));
        this.server.on('connection', this.onConnect.bind(this));
        this.server.listen(port);
    }

    public stop(): void {
        if (this.server) {
            this.server.close();
        }
    }

    public addProtocolService(service: ProtocolService) {
        this.services.push(service);
    }

    private onListening(): void {
        console.log(`[Server] ${this.uuid} - Running ${this.getProtocolNames()} on port ${this.port}`);
    }

    private onConnect(socket: Net.Socket): void {
        // IP Bans section?
        const connection = ConnectionManager.getInstance().createConnection(socket, this);
        if (this.isSingleSocket()) {
            const [protocolService] = this.services;
            if (!protocolService) {
                throw new Error('No protocol available for single socket server.');
            }

            connection.acceptProtocol(protocolService.makeProtocol(connection));
            return;
        }

        connection.accept();
    }

    public isSingleSocket(): boolean {
        const [protocol] = this.services;
        return protocol ? protocol.serverSendsFirst : false;
    }

    public getProtocolNames(): string {
        const [firstProtocol, ...remainingProtocols] = this.services;
        if (!firstProtocol) {
            return '';
        }

        let protocolNames = firstProtocol.protocolName;
        for (const protocol of remainingProtocols) {
            protocolNames += `, ${protocol.protocolName}`;
        }

        return protocolNames;
    }

    public makeProtocol(msg: Message, connection: Connection): Protocol | null {
        const protocolId = msg.getUint8();
        for (const service of this.services) {
            if (protocolId != service.protocolIdentifier) {
                continue;
            }

            return service.makeProtocol(connection);
        }

        return null;
    }

    public getUuid(): string {
        return this.uuid;
    }
}
