# Security Policy

## Supported Versions

| Version | Supported | Security Updates |
| :--- | :--- | :--- |
| 0.3.x (alpha) | ✅ | Critical fixes only |
| 0.2.x | ❌ | No longer maintained |
| main branch | ✅ | Latest security patches |

## Reporting a Vulnerability

Do NOT create a public GitHub issue. Instead, please use one of the following methods:
1. Create a private security advisory on GitHub
2. Email : ogttamimi@gmail.com

You should receive a response within 48 hours.

### What to include
- Description of the vulnerability
- Steps to reproduce (kernel version, linscope version)
- Potential impact
- Any suggested fix (optional)

## Security best practices when running linscope
- Run only the eBPF collector with sudo – backend and frontend as normal user.
- Keep the backend bound to localhost (default).
- Do not expose the WebSocket or API to the public internet without authentication.
- Use kernel 5.4+ with CONFIG_BPF=y.

## Responsible disclosure
We thank all researchers who report security issues responsibly.

Last updated: May 2026