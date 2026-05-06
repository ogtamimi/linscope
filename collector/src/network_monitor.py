from bcc import BPF
import socket, struct, time

NETWORK_BPF = r"""
#include <uapi/linux/ptrace.h>
#include <net/sock.h>
#include <bcc/proto.h>

struct net_event_t {
    u32 pid;
    char comm[TASK_COMM_LEN];
    u32 saddr;
    u32 daddr;
    u16 dport;
    u16 sport;
    u64 timestamp;
};

BPF_PERF_OUTPUT(net_events);
BPF_HASH(currsock, u32, struct sock *);

int trace_connect(struct pt_regs *ctx, struct sock *sk) {
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    currsock.update(&pid, &sk);
    return 0;
}

int trace_connect_return(struct pt_regs *ctx) {
    int ret = PT_REGS_RC(ctx);
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    struct sock **skpp = currsock.lookup(&pid);
    if (!skpp) return 0;
    if (ret != 0) { currsock.delete(&pid); return 0; }
    struct net_event_t event = {};
    struct sock *sk = *skpp;
    event.pid = pid;
    event.timestamp = bpf_ktime_get_ns();
    event.saddr = sk->__sk_common.skc_rcv_saddr;
    event.daddr = sk->__sk_common.skc_daddr;
    event.dport = sk->__sk_common.skc_dport;
    event.sport = sk->__sk_common.skc_num;
    bpf_get_current_comm(&event.comm, sizeof(event.comm));
    net_events.perf_submit(ctx, &event, sizeof(event));
    currsock.delete(&pid);
    return 0;
}
"""

def ip(addr):
    return socket.inet_ntoa(struct.pack("I", addr))

class NetworkMonitor:
    def __init__(self, callback):
        self.callback = callback

    def start(self):
        print("[linscope] Loading network monitor...")
        bpf = BPF(text=NETWORK_BPF)
        bpf.attach_kprobe(event="tcp_v4_connect", fn_name="trace_connect")
        bpf.attach_kretprobe(event="tcp_v4_connect", fn_name="trace_connect_return")

        def handle_event(cpu, data, size):
            e = bpf["net_events"].event(data)
            dport = socket.ntohs(e.dport)
            dest = ip(e.daddr)
            self.callback({
                "timestamp": time.time(),
                "pid": e.pid,
                "process": e.comm.decode("utf-8", errors="replace"),
                "event": "connect",
                "source_ip": ip(e.saddr),
                "dest_ip": dest,
                "dest_port": dport,
                "target": f"{dest}:{dport}",
                "source": "network_monitor"
            })

        bpf["net_events"].open_perf_buffer(handle_event)
        print("[linscope] Network monitor active ✅")
        while True:
            bpf.perf_buffer_poll(timeout=100)
