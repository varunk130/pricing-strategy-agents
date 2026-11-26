# Security

Please do not open a public issue for a security problem. Report it privately
through GitHub's "Report a vulnerability" button on the Security tab.

- API keys belong in `.env.local`, which git ignores. Never commit a key.
- The app reads `ANTHROPIC_API_KEY` on the server only. It is never sent to the browser.
