# simjs

simjs is a process-based discrete-event simulation framework based on Javascript.

![](media/image.png)

Processes in simjs are defined by Javascript generator functions. All processes live in an environment. They interact with the environment and with each other via events. When a process yields an event, the process gets suspended. Simjs resumes the process, when the event occurs (we say that the event is triggered).

An important event type is the Timeout. Events of this type are triggered after a certain amount of (simulated) time has passed. They allow a process to sleep (or hold its state) for the given time. A Timeout and all other events can be created by calling the appropriate method of the Environment that the process lives in (Environment.timeout() for example).

FlatQueue.js imported from https://github.com/mourner/flatqueue
This library has been inspired in the Python library Simpy https://simpy.readthedocs.io
