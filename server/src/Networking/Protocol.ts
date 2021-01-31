import {Connection} from './Connection';

export abstract class ProtocolService {
    abstract readonly protocolName: string;
    abstract readonly protocolIdentifier: number;
    abstract readonly serverSendsFirst: boolean;
    abstract readonly isCheckSummed: boolean;

    private readonly protocolCtor: ProtocolConstructor;

    constructor(protocolCtor: ProtocolConstructor) {
        this.protocolCtor = protocolCtor;
    }

    public makeProtocol(connection: Connection): Protocol {
        return new this.protocolCtor(connection);
    }
}

export interface ProtocolConstructor {
    new(connection: Connection): Protocol;
}

export abstract class Protocol {
    private connection: Connection;

    constructor(connection: Connection) {
        this.connection = connection;
    }

    public abstract parsePacket(message: Buffer): void;

    public abstract onConnect(): void;

    public abstract onFirstMessageReceived(message: Buffer): void;

    public send(message: Buffer): void {
        this.connection.send(message);
    }

    //
    // public onMessageReceived(message: Buffer): void {
    //
    // };
    //
    // public onMessageSend(message: Buffer): void {
    //
    // }

}
