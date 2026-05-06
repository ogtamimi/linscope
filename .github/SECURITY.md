# Security Policy

## 🔒 Supported Versions

| Version | Supported | Security Updates |
|---------|-----------|------------------|
| v0.2.0+ (optimized) | ✅ | Full support |
| v0.1.x (alpha) | ⚠️ | Critical fixes only |
| main branch | ✅ | Latest security patches |

## 🚨 Reporting a Vulnerability

We take security seriously. Please do NOT:

- ❌ Do not disclose publicly
- ❌ Do not create a public GitHub issue
- ❌ Do not discuss in chats

Please DO:

- ✅ Create a private security advisory on GitHub
- ✅ Include reproduction steps
- ✅ Include affected versions
- ✅ Include impact

## 📋 What to Include

**Vulnerability Description:**
...

**Steps to Reproduce:**
1.
2.
3.

**Affected Versions:**
...

**Impact:**
...

## 🔄 Response Process
- Acknowledgment: 24–48 hours
- Verification: 5–7 days
- Fix: Based on severity
- Release: Patch version
- Disclosure: After fix

## 🛡️ Best Practices
- Run collector with sudo only
- Keep backend on localhost (or use SSL/TLS for production)
- Linux kernel 5.4+ (eBPF support)
- Use v0.2.0+ for production (better performance & stability)
- Keep dependencies updated
- Monitor performance metrics in dashboard
