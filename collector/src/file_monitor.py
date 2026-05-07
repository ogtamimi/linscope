#!/usr/bin/env python3
"""
linscope - File System Call Monitor (open, read, write, unlink)
Tracks file operations via eBPF kprobes
"""

from bcc import BPF
import time

FILE_BPF = """
#include <uapi/linux/ptrace.h>
#include <linux/fs.h>

struct file_event_t {
    u32 pid;
    char comm[TASK_COMM_LEN];
    char filename[256];
    u64 timestamp;
    u32 op_type;  // 1=open, 2=read, 3=write, 4=unlink
};

BPF_PERF_OUTPUT(file_events);

int trace_open(struct pt_regs *ctx, const char __user *filename, int flags) {
    struct file_event_t event = {};
    event.pid = bpf_get_current_pid_tgid() >> 32;
    event.timestamp = bpf_ktime_get_ns();
    event.op_type = 1;
    bpf_get_current_comm(&event.comm, sizeof(event.comm));
    bpf_probe_read_user_str(&event.filename, sizeof(event.filename), filename);
    file_events.perf_submit(ctx, &event, sizeof(event));
    return 0;
}

int trace_unlink(struct pt_regs *ctx, const char __user *pathname) {
    struct file_event_t event = {};
    event.pid = bpf_get_current_pid_tgid() >> 32;
    event.timestamp = bpf_ktime_get_ns();
    event.op_type = 4;
    bpf_get_current_comm(&event.comm, sizeof(event.comm));
    bpf_probe_read_user_str(&event.filename, sizeof(event.filename), pathname);
    file_events.perf_submit(ctx, &event, sizeof(event));
    return 0;
}
"""

class FileMonitor:
    def __init__(self, callback):
        self.callback = callback

    def start(self):
        print("[linscope] Loading file syscall monitor...")
        bpf = BPF(text=FILE_BPF)
        bpf.attach_kprobe(event="do_sys_open", fn_name="trace_open")
        bpf.attach_kprobe(event="do_unlinkat", fn_name="trace_unlink")

        def handle_event(cpu, data, size):
            e = bpf["file_events"].event(data)
            ops = {1: "open", 2: "read", 3: "write", 4: "unlink"}
            self.callback({
                "timestamp": time.time(),
                "pid": e.pid,
                "process": e.comm.decode("utf-8", errors="replace"),
                "event": ops.get(e.op_type, "file_op"),
                "filename": e.filename.decode("utf-8", errors="replace"),
                "source": "file_monitor"
            })

        bpf["file_events"].open_perf_buffer(handle_event)
        print("[linscope] File syscall monitor active ✅")
        while True:
            bpf.perf_buffer_poll(timeout=100)
