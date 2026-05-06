# 🤝 Contributing to linscope

First off, thank you for considering contributing to linscope! 🎉

## 📋 Code of Conduct

By participating, you are expected to uphold this code. Please report unacceptable behavior.

## 🚀 How Can I Contribute?

### Reporting Bugs

- Check if the bug has already been reported
- Use the bug report template
- Include detailed steps to reproduce
- Include your Linux kernel version (`uname -r`)

### Suggesting Enhancements

- Check if the enhancement already exists
- Describe the feature in detail
- Explain why it would be useful

### Pull Requests

1. Fork the repo
2. Create a branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push (`git push origin feature/amazing`)
5. Open a Pull Request

## 🛠️ Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/linscope.git
cd linscope

# Install dependencies
./scripts/install.sh

# Run backend
source venv/bin/activate
uvicorn backend.main:app --reload

# Run frontend (new terminal)
cd frontend && npm run dev

# Run collector (new terminal, as root)
sudo PYTHONPATH=/usr/lib/python3/dist-packages python3 collector/main.py
```

📝 Style Guidelines
Python: Follow PEP 8

TypeScript: Use strict mode

Commits: Use conventional commits

🧪 Testing
```bash
# Backend tests (coming soon)
pytest tests/

# Frontend tests (coming soon)
cd frontend && npm test
```

📄 License
By contributing, you agree that your contributions will be licensed under Apache 2.0.