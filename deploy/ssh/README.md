# Deploy SSH keypair

An ed25519 keypair (`neca_cpanel_deploy_key` / `neca_cpanel_deploy_key.pub`)
was generated for the cPanel Git Version Control deploy flow. **The key
files themselves are git-ignored and are not in this repository** — private
keys should never live in version control, even scoped, read-only ones.

Tosin received both files as direct downloads when they were generated.
If they're needed again, regenerate with:

```bash
ssh-keygen -t ed25519 -C "neca-awards-cpanel-deploy" -f deploy/ssh/neca_cpanel_deploy_key -N ""
```

## What to do with them

1. **Public key → GitHub.** Add it as a Deploy Key on this repository:
   `Settings → Deploy keys → Add deploy key`. Read-only access is enough —
   cPanel only needs to pull.
2. **Private key → cPanel.** Import it under
   `cPanel → SSH Access → Manage SSH Keys → Import Key`, paste the private
   key contents, then use `Authorize` to complete the import.
3. Once both sides trust the key, cPanel's Git Version Control feature can
   clone/pull this repo over SSH using the repo's `git@github.com:...`
   remote URL.
4. Delete the local copies of the private key from your machine once
   they're safely in cPanel's key manager (a password manager entry is a
   good permanent home for it).
