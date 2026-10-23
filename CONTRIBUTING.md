# Contributing to Bluff

Thank you for your interest in contributing to Bluff. We welcome contributions, bug reports, feature proposals, and documentation improvements.

## Development Workflow

### Prerequisites
* Node.js v18+ or v20+
* npm v9+
* Git

### Local Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/OpeyemiMoses/Bluff.git
   cd Bluff
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
4. Run live test verification:
   ```bash
   npm run test:flow
   ```
5. Start development server:
   ```bash
   npm run dev
   ```

## Pull Request Guidelines

1. Fork the repo and create your branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Ensure code compiles without TypeScript errors:
   ```bash
   npm run build
   ```
3. Run tests to confirm zero regressions:
   ```bash
   npm run test:flow
   ```
4. Write clear, conventional commit messages:
   - `feat: add x402 multi-token challenge negotiation`
   - `fix: resolve brier calibration edge case`
   - `docs: update Tatum Sui RPC endpoint guide`
5. Open a Pull Request referencing relevant issues.

## Reporting Bugs

Please use the GitHub Issue template for bug reports, including:
* Clear description of the unexpected behavior
* Steps to reproduce
* Environment specifications (Node version, OS)
* Error output or terminal logs
