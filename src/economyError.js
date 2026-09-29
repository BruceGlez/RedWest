// A rule of the economy was broken (not enough money, unknown item, ...). The server answers 400 with
// the code and message; the game shows the message.
export class EconomyError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}
