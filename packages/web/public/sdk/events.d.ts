export declare class EventEmitter {
    private events;
    /**
     * Add an event listener
     */
    on(event: string, handler: Function): void;
    /**
     * Remove an event listener
     */
    off(event: string, handler: Function): void;
    /**
     * Add a one-time event listener
     */
    once(event: string, handler: Function): void;
    /**
     * Emit an event
     */
    emit(event: string, ...args: any[]): void;
    /**
     * Remove all event listeners
     */
    removeAllListeners(event?: string): void;
    /**
     * Get the number of listeners for an event
     */
    listenerCount(event: string): number;
}
