import * as Adler from 'adler-32';

/*
 * Message structure
 *
 * 3 bytes - Unencrypted message size
 * 4 bytes - Checksum
 * 3 bytes - Encrypted message size
 */

export class Message {
    public static HEADER_MESSAGE_SIZE_LENGTH: number = 2;
    public static HEADER_CHECKSUM_SIZE: number = 4;
    public static MAX_SIZE: number = 65535;
    public static HEADER_SIZE: number = Message.HEADER_MESSAGE_SIZE_LENGTH + Message.HEADER_CHECKSUM_SIZE;
    public static MAX_BODY_SIZE: number = Message.MAX_SIZE - Message.HEADER_SIZE;
    public static BODY_OFFSET: number = Message.HEADER_SIZE;

    protected bodyBuffer: Buffer = Buffer.alloc(Message.MAX_BODY_SIZE);
    protected offset: number = 0;
    protected length: number = 0;
    protected checksum: number = 0;

    public addString(string: string): void {
        this.addBytes(Buffer.from(string));
    }

    public addUint8(number: number): void {
        this.bodyBuffer.writeUInt8(number, this.offset++);
    }

    public addBytes(bytes: Buffer): void {
        if (!this.canAdd(bytes.byteLength)) {
            return;
        }

        this.bodyBuffer.set(bytes, this.offset);
        this.offset += bytes.byteLength;
        this.length += bytes.byteLength;
    }

    public getBodyBuffer(): Buffer {
        return this.bodyBuffer;
    }

    public getUint8(): number {
        if (!this.canRead(1)) {
            return 0;
        }

        return this.bodyBuffer.readUInt8(this.offset++);
    }

    public getBytes(numBytes: number): Buffer {
        const bytes = Buffer.alloc(numBytes);
        if (!this.canRead(numBytes)) {
            return bytes;
        }

        this.bodyBuffer.copy(bytes, 0, this.offset, this.offset + numBytes);
        this.offset += numBytes;

        return bytes;
    }

    public skipBytes(numBytes: number): void {
        this.offset += numBytes;
    }

    public getLength(): number {
        return this.length;
    }

    public setLength(length: number): void {
        this.length = length;
    }

    public calcChecksum(): number {
        return Adler.buf(this.bodyBuffer.subarray(0, this.length), this.length);
    }

    public getChecksum(): number {
        return this.checksum;
    }

    public setChecksum(checksum: number): void {
        this.checksum = checksum;
    }

    private canAdd(numBytes: number): Boolean {
        return (this.offset + numBytes) < Message.MAX_BODY_SIZE;
    }

    private canRead(numBytes: number): Boolean {
        return numBytes >= (Message.MAX_BODY_SIZE - this.offset);
    }
}

export class OutMessage extends Message {
    protected headerBuffer: Buffer = Buffer.alloc(Message.HEADER_SIZE);

    public getOutputBuffer() {
        const buffer = Buffer.concat([this.headerBuffer, this.bodyBuffer.subarray(0, this.length)]);

        this.writeMessageLength(buffer);
        this.writeChecksum(buffer);

        return buffer;
    }

    private writeMessageLength(buffer: Buffer): void {
        buffer.writeUInt16LE(this.length, 0);
    }

    private writeChecksum(buffer: Buffer): void {
        buffer.writeInt32LE(
            this.calcChecksum(),
            Message.HEADER_MESSAGE_SIZE_LENGTH
        );
    }
}   
