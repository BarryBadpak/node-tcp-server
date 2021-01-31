export default class AddressInUseError extends Error {
    constructor(message?: string) {
        super(message);
    }
}
