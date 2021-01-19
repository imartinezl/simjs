function* count() {
    let index = 0;
    while (true) {
        yield index;
        index++;
    }
}


function log(...args) {
    if (debug) {
        console.log(...args);
    }
}

class Environment {
    constructor(initial_time = 0) {
        this._now = initial_time;
        this._queue = new FlatQueue();
        this._eid = count();
        this._active_proc = null
    }

    get now() {
        return this._now
    }

    get active_process() {
        return this._active_proc
    }

    process(generator) {
        return new Process(this, generator)
    }

    timeout(delay = 0, value = null) {
        return new Timeout(this, delay, value)
    }

    event() {
        return new Event(this)
    }

    schedule(event, delay = 0) {
        log("schedule event " + (event.constructor.name) + " " + (this._now + delay))
        this._queue.push([this._now + delay, this._eid.next().value, event], this._now + delay);
    }

    peek() {
        try {
            return this._queue.peek();
        } catch (error) {
            return Infinity
        }
    }

    step() {
        let id, event;
        log("########## STEP ###########")
        try {
            let result = this._queue.pop();
            this._queue.shrink() // optional?? 
            this._now = result[0];
            id = result[1]; // TODO: what to do with this?
            event = result[2]; // TODO: what to do with this? callbacks? defused?
            log("Pop result", result, id)
        } catch (error) {
            log("Error step", error)
            throw new EmptySchedule()
        }

        let callbacks = event.callbacks
        event.callbacks = null
        log("step callbacks", callbacks, id, event)
        callbacks.forEach(callback => {
            callback(event)
        });

        log("step then", event)
        if ((!event.ok) && (!event.defused)) {
            const exc = {...event };
            throw exc
        }
    }

    run(until = null) {
        if (until !== null) {
            if (!(until instanceof Event)) {
                let at = until
                if (at <= this._now) {
                    throw "Until must be > the current simulation time.";
                }
                until = new Event(this);
                until._ok = true;
                until._value = null
                this.schedule(until, at - this._now)
            } else if (until.callbacks === null) {
                return until._value
            }
            until.callbacks.push((e) => StopSimulation.callback(e))
        }
        try {
            while (true) {
                this.step()
            }
        } catch (error) {
            log("error run", error)
            if (error instanceof StopSimulation) {
                log("StopSimulation")
                return [0]
            } else if (error instanceof EmptySchedule) {
                log("EmptySchedule")
                if (until !== null) {
                    if (!until.triggered) {
                        throw 'No scheduled events left but "until" event was not triggered'
                    }
                }
            }

        }
        return null
    }

}

class EmptySchedule {

}

class StopIteration {

}

class StopSimulation {
    constructor(value) {
        this.value = value
    }
    static callback(event) {
        log("stop simulation callback", event)
        if (event._ok) {
            throw new StopSimulation(event.value)
        } else {
            throw event._value
        }
    }
}

PENDING = "PENDING";
class Event {

    constructor(env) {
        this.env = env
        this.callbacks = []
            // this._ok = false //
            // this._defused = false //
        this._value = PENDING
    }

    get triggered() {
        return this._value !== PENDING
    }

    get processed() {
        return this.callbacks === null
    }

    get ok() {
        return this._ok
    }

    get defused() {
        return this.hasOwnProperty('_defused')
    }

    get value() {
        if (this._value === PENDING) {
            throw "Value not yet available"
        }
        return this._value
    }

    trigger(event) {
        this._ok = event._ok
        this._value = event._value
        this.env.schedule(this)
    }

    succeed(value = null) {
        if (this._value !== PENDING) {
            throw "Already triggered"
        }

        this._ok = true
        this._value = value
        this.env.schedule(this)
        return this
    }


}

class Timeout extends Event {
    constructor(env, delay, value = null) {
        if (delay < 0) {
            throw "Negative delay"
        }

        super(env)
        this.env = env;
        this.callbacks = []

        this._value = value;
        this._delay = delay;
        this._ok = true
        env.schedule(this, delay)

    }
}

class Initialize extends Event {
    constructor(env, process) {
        super(env)
        this.env = env;
        this.callbacks = [(e) => process._resume(e)];
        this._value = null

        this.flag = "INITIALIZE"

        this._ok = true;
        env.schedule(this)
    }
}

class Process extends Event {
    constructor(env, generator) {
        super(env)
        this.env = env;
        this.callbacks = [];
        this._generator = generator;

        this._target = new Initialize(env, this)
    }

    get target() {
        return this._target
    }

    get is_alive() {
        return this._value === PENDING
    }

    _resume(event) {
        log("resume!", event, this)
        this.env._active_process = this
        let brk = false,
            done;
        // debugger
        while (true) {
            try {
                if (event._ok) {
                    let g = this._generator.next()
                    event = g.value
                    done = g.done
                    if (done) {
                        throw new StopIteration()
                    }
                    log("next generator event", event)
                } else {
                    event._defused = true
                    log("defused TODO")
                    const exc = {...event };
                    event = this._generator.throw(exc)
                }
            } catch (error) {
                if (error instanceof StopIteration) {
                    log("StopIteration")
                    event = null
                    this._ok = true
                    this._value = error
                    this.env.schedule(this)
                    brk = true
                } else {
                    log("BaseException")
                    event = null
                    this._ok = false
                    this._value = error
                    this.env.schedule(this)
                    brk = true
                }
            }
            if (brk) {
                break
            }

            brk = false
            try {
                if (event.callbacks !== null) {
                    event.callbacks.push((e) => this._resume(e))
                    brk = true
                }
            } catch (error) {
                log(error)
                throw "errorr"
            }
            if (brk) {
                break
            }
        }

        this._target = event
        this.env._active_proc = null
    }
}



// let q = new FlatQueue();
// q.push([0, 2], 10);
// q.push([0, 3], 10);
// q.push([1, 9], 2);
// q.pop();
// q.shrink();


function* example(env, t) {
    let p2 = env.process(example2(env, 2))
    yield e
    console.log(env.now, "timeout start")
    yield env.timeout(t)
    console.log(env.now, "timeout done")
}

function* example2(env, t) {
    while (true) {
        console.log(env.now, "process start")
        yield env.timeout(t)
        console.log(env.now, "process done")
        if (!e.triggered) {
            yield env.timeout(1)
            e.succeed()
                // console.log(env.now, "event succeed")
        }
    }
}

const debug = false;
let env;
var t0 = performance.now()

env = new Environment()
let e = env.event()
let p1 = env.process(example(env, 5))

env.run(23)

var t1 = performance.now()
console.log("Call took " + (t1 - t0) + " milliseconds.")