# Pushing ToneScope to GitHub

Follow these steps to push your ToneScope project to your GitHub account:

## 1. Create a new repository on GitHub

1. Go to https://github.com/new
2. Name your repository: `tonescope`
3. Add description: "Real-time music note and key detection web app"
4. Choose Public or Private
5. **DO NOT** initialize with README (we already have one)
6. Click "Create repository"

## 2. Add GitHub remote and push

```bash
# Add your GitHub repository as remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/tonescope.git

# Rename branch to main (optional, if you prefer main over master)
git branch -M main

# Push to GitHub
git push -u origin main
```

## 3. Alternative: Use SSH instead of HTTPS

If you have SSH keys set up:

```bash
git remote add origin git@github.com:YOUR_USERNAME/tonescope.git
git branch -M main
git push -u origin main
```

## Example Commands

Replace `jhorvath` with your actual GitHub username:

```bash
git remote add origin https://github.com/jhorvath/tonescope.git
git branch -M main
git push -u origin main
```

## Verify

After pushing, visit:
```
https://github.com/YOUR_USERNAME/tonescope
```

Your code should now be on GitHub! 🎉

## Future Updates

After making changes:

```bash
git add .
git commit -m "Your commit message"
git push
```
