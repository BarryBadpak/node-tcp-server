export default class InvalidPortError extends Error {
    constructor(message?: string) {
        super(message);
    }
}
