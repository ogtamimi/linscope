from bcc import BPF
import time

PROCESS_BPF = r"""
#include <uapi/linux/ptrace.h>
#include <linux/sched.h>

struct event_t {
    u32 pid;
    u32 ppid;
    u32 uid;
    char comm[TASK_COMM_LEN];
    char filename[256];
    u64 timestamp;
    u32 event_type;
};

BPF_PERF_OUTPUT(events);

int trace_exec(struct tracepoint__syscalls__sys_enter_execve *args) {
    struct event_t event = {};
    struct task_struct *task = (struct task_struct *)bpf_get_current_task();
    event.pid = bpf_get_current_pid_tgid() >> 32;
    event.ppid = task->real_parent->tgid;
    event.uid = bpf_get_current_uid_gid() & 0xFFFFFFFF;
    event.timestamp = bpf_ktime_get_ns();
    event.event_type = 1;
    bpf_get_current_comm(&event.comm, sizeof(event.comm));
    bpf_probe_read_user_str(&event.filename, sizeof(event.filename), args->filename);
    events.perf_submit(args, &event, sizeof(event));
    return 0;
}

int trace_exit(struct tracepoint__syscalls__sys_exit_exit_group *args) {
    struct event_t event = {};
    struct task_struct *task = (struct task_struct *)bpf_get_current_task();
    event.pid = bpf_get_current_pid_tgid() >> 32;
    event.ppid = task->real_parent->tgid;
    event.uid = bpf_get_current_uid_gid() & 0xFFFFFFFF;
    event.timestamp = bpf_ktime_get_ns();
    event.event_type = 2;
    bpf_get_current_comm(&event.comm, sizeof(event.comm));
    events.perf_submit(args, &event, sizeof(event));
    return 0;
}
"""

class ProcessMonitor:
    def __init__(self, callback):
        self.callback = callback

    def start(self):
        print("[linscope] Loading process monitor...")
        bpf = BPF(text=PROCESS_BPF)
        bpf.attach_tracepoint(tp="syscalls:sys_enter_execve", fn_name="trace_exec")
        bpf.attach_tracepoint(tp="syscalls:sys_exit_exit_group", fn_name="trace_exit")

        def handle_event(cpu, data, size):
            e = bpf["events"].event(data)
            self.callback({
                "timestamp": time.time(),
                "pid": e.pid,
                "ppid": e.ppid,
                "uid": e.uid,
                "process": e.comm.decode("utf-8", errors="replace"),
                "filename": e.filename.decode("utf-8", errors="replace"),
                "event": "exec" if e.event_type == 1 else "exit",
                "source": "process_monitor"
            })

        bpf["events"].open_perf_buffer(handle_event)
        print("[linscope] Process monitor active ✅")
        while True:
            bpf.perf_buffer_poll(timeout=100)
