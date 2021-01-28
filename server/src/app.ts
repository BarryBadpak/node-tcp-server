import * as net from 'net';

const server = net.createServer((connection) => {
    console.log('Client connected', connection.address());

    connection.on('data', (data: Buffer) => {
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
