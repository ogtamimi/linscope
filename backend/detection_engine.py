"""
Detection Engine - Advanced Behavioral Analysis
- Rule-based detection (YAML/JSON rules)
- Score-based anomaly detection
- Pattern matching with regex and sequences
- Alert enrichment with process tree
"""

import time
import re
from collections import defaultdict, deque
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field
import json

@dataclass
class Alert:
    id: str
    timestamp: float
    rule_name: str
    severity: str  # 'info', 'low', 'medium', 'high', 'critical'
    title: str
    description: str
    events: List[dict] = field(default_factory=list)
    affected_pids: List[int] = field(default_factory=list)
    score: float = 0.0
    mitre_technique: Optional[str] = None  # MITRE ATT&CK
    iocs: List[Dict[str, str]] = field(default_factory=list)  # [{"type": "ip|domain|hash", "value": "..."}]

class DetectionEngine:
    def __init__(self, event_callback: Optional[Callable] = None):
        self.event_callback = event_callback
        self.rules = self._load_rules()
        self.process_scores = defaultdict(float)  # pid -> score
        self.event_window = deque(maxlen=5000)    # last 5000 events for correlation
        self.anomaly_threshold = 50.0
        self.alert_history = deque(maxlen=1000)
        
    def _load_rules(self) -> List[dict]:
        """Load detection rules - can be extended to read from YAML file"""
        rules = [
            {
                "name": "suspicious_parent_child",
                "severity": "high",
                "score": 40,
                "condition": {
                    "event_type": "exec",
                    "parent_processes": ["nginx", "apache2", "sshd", "cron", "systemd"],
                    "child_processes": ["bash", "sh", "python", "curl", "wget", "nc", "socat", "perl", "ruby"]
                },
                "mitre": "T1059",
                "title": "Suspicious child process from service",
                "description": "A web server or system service spawned an unexpected shell/script."
            },
            {
                "name": "reverse_shell_pattern",
                "severity": "critical",
                "score": 90,
                "condition": {
                    "event_type": "exec",
                    "command_patterns": [
                        r"nc\s+-e\s+/bin/sh",
                        r"bash\s+-i\s+>&\s+/dev/tcp/",
                        r"python\s+-c\s+['\"].*pty.*spawn.*['\"]",
                        r"perl\s+-e\s+.*socket.*exec"
                    ]
                },
                "mitre": "T1059.003",
                "title": "Reverse shell detected",
                "description": "A reverse shell command was executed."
            },
            {
                "name": "suspicious_network_port",
                "severity": "medium",
                "score": 30,
                "condition": {
                    "event_type": "connect",
                    "dest_port": [4444, 1337, 31337, 5555, 6667, 9001, 12345]
                },
                "mitre": "T1571",
                "title": "Connection to suspicious port",
                "description": "Process connected to a port commonly used by backdoors."
            },
            {
                "name": "privilege_escalation",
                "severity": "critical",
                "score": 80,
                "condition": {
                    "event_type": "exec",
                    "command_patterns": [r"sudo\s+", r"su\s+-", r"setuid", r"pkexec"]
                },
                "mitre": "T1068",
                "title": "Privilege escalation attempted",
                "description": "Process attempted to elevate privileges."
            },
            {
                "name": "persistence_installation",
                "severity": "high",
                "score": 50,
                "condition": {
                    "event_type": ["open", "write", "unlink_success"],
                    "file_paths": [
                        "/etc/cron", "/etc/systemd", "/etc/init.d",
                        "/var/spool/cron", "/etc/rc.local", "~/.bashrc",
                        "/etc/ld.so.preload", "/etc/ld.so.conf.d"
                    ]
                },
                "mitre": "T1543",
                "title": "Potential persistence mechanism",
                "description": "Process modified a common persistence location."
            },
            {
                "name": "unusual_outbound_from_web_server",
                "severity": "medium",
                "score": 35,
                "condition": {
                    "event_type": "connect",
                    "processes": ["nginx", "apache2", "httpd", "lighttpd"],
                    "dest_port_exclude": [80, 443, 8080, 8443]
                },
                "title": "Web server made outbound connection",
                "description": "Web server initiated connection to non-standard port."
            },
            {
                "name": "process_hollowing_indicators",
                "severity": "critical",
                "score": 95,
                "condition": {
                    "event_type": "exec",
                    "command_patterns": [r"\\?[a-zA-Z]:\\\\Temp\\\\", r"C:\\Windows\\Temp\\\\"],
                    # This is simplified; in real Linux, could indicate memfd or deleted binary
                },
                "mitre": "T1055.012",
                "title": "Possible process hollowing",
                "description": "Suspicious execution from temporary or non-standard path."
            },
            {
                "name": "rapid_file_deletion",
                "severity": "medium",
                "score": 25,
                "condition": {
                    "event_type": "unlink",
                    "count_within_seconds": 20,
                    "threshold": 10
                },
                "title": "Rapid file deletion",
                "description": "Large number of files deleted quickly - possible evasion."
            }
        ]
        return rules

    def analyze_event(self, event: dict) -> List[Alert]:
        """Analyze a single event and return any triggered alerts."""
        self.event_window.append(event)
        triggered_alerts = []
        
        for rule in self.rules:
            if self._matches_rule(event, rule):
                alert = self._create_alert(rule, event)
                triggered_alerts.append(alert)
                # Update process score
                pid = event.get("pid")
                if pid:
                    self.process_scores[pid] += rule.get("score", 0)
                
                # Send via callback
                if self.event_callback:
                    self.event_callback(alert.__dict__)
                    
        return triggered_alerts

    def _matches_rule(self, event: dict, rule: dict) -> bool:
        """Check if an event matches a rule's conditions."""
        cond = rule.get("condition", {})
        
        # Check event_type
        if "event_type" in cond:
            event_type = event.get("event")
            rule_types = cond["event_type"]
            if isinstance(rule_types, str):
                if event_type != rule_types:
                    return False
            elif isinstance(rule_types, list):
                if event_type not in rule_types:
                    return False
        
        # Process name matching
        if "processes" in cond:
            proc = event.get("process", "")
            if proc not in cond["processes"]:
                return False
        
        # Parent-child check
        if "parent_processes" in cond and "child_processes" in cond:
            # This requires access to process tree; we simplify with event fields
            ppid = event.get("ppid")
            # We'd need actual parent name; for now, we partially skip
            pass
        
        # Command pattern matching (regex)
        if "command_patterns" in cond:
            cmd = event.get("process", "") + " " + event.get("filename", "")
            for pattern in cond["command_patterns"]:
                if re.search(pattern, cmd, re.IGNORECASE):
                    return True
            return False
        
        # Destination port check
        if "dest_port" in cond:
            dport = event.get("dest_port")
            if dport not in cond["dest_port"]:
                return False
        
        # File paths
        if "file_paths" in cond:
            filename = event.get("filename", "")
            matched = any(path in filename for path in cond["file_paths"])
            if not matched:
                return False
        
        # Rapid event detection (requires window analysis)
        if "count_within_seconds" in cond:
            # Simplified; implement if needed
            pass
        
        return True

    def _create_alert(self, rule: dict, event: dict) -> Alert:
        # Extract IOCs from event
        iocs = []
        
        # Check for IP addresses
        if event.get('dest_ip'):
            iocs.append({'type': 'ip', 'value': event['dest_ip']})
        
        # Check for domains (could be in target or other fields)
        # For now we skip domains unless they appear in a specific field
        
        # Check for file hashes
        if event.get('hash'):
            iocs.append({'type': 'hash', 'value': event['hash']})
        
        alert = Alert(
            id=f"alert-{int(time.time()*1000)}-{hash(str(event))}",
            timestamp=event.get("timestamp", time.time()),
            rule_name=rule["name"],
            severity=rule.get("severity", "info"),
            title=rule["title"],
            description=rule["description"],
            events=[event],
            affected_pids=[event.get("pid")] if event.get("pid") else [],
            score=rule.get("score", 0),
            mitre_technique=rule.get("mitre"),
            iocs=iocs
        )
        return alert

    def get_top_anomalies(self, limit=10) -> List[tuple]:
        """Return processes with highest anomaly scores."""
        sorted_scores = sorted(self.process_scores.items(), key=lambda x: x[1], reverse=True)
        return sorted_scores[:limit]
