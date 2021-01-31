export class Timer {
    private timer: NodeJS.Timeout | undefined;

    public set(callback: (...args: any[]) => void, ms: number): void {
        this.stop();
        this.timer = setTimeout(callback, ms);
    }

    public stop() {
        if (!this.timer) {
            return;
        }

        clearTimeout(this.timer);
        delete this.timer;
    }
}
