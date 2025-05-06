# Push to GitHub Instructions

## Authentication Error Solution

Since you're encountering an authentication error, you need to set up a Personal Access Token (PAT) to push to GitHub:

### Step 1: Create a Personal Access Token on GitHub

1. Go to GitHub.com and log in to your account.
2. Click on your profile picture in the top right corner.
3. Select "Settings" from the dropdown menu.
4. Scroll down and click on "Developer settings" in the left sidebar.
5. Click on "Personal access tokens" and then "Tokens (classic)".
6. Click "Generate new token" and then "Generate new token (classic)".
7. Give your token a descriptive name like "SchoolQuizGame Push".
8. Set an expiration date (e.g., 30 days, 60 days, or custom).
9. Select these scopes:
   - `repo` (Full control of private repositories)
   - `workflow` (if you plan to use GitHub Actions)
10. Click "Generate token" at the bottom.
11. **IMPORTANT:** Copy the token immediately! GitHub will only show it once.

### Step 2: Use the Token to Push Your Code

#### Method 1: Store Credentials (Recommended)
Run these commands in PowerShell:

```powershell
git config --global credential.helper store
```

Then try pushing again:
```powershell
git push -u origin master
```

When prompted, use your GitHub username and the Personal Access Token as the password.

#### Method 2: Include Token in Remote URL
Alternatively, you can include the token in the remote URL:

```powershell
git remote set-url origin https://YOUR_USERNAME:YOUR_TOKEN@github.com/ennuiii/SchoolQuizGame.git
git push -u origin master
```

Replace:
- `YOUR_USERNAME` with your GitHub username (ennuiii)
- `YOUR_TOKEN` with the personal access token you created

### Step 3: Verify Your Push

After pushing, visit https://github.com/ennuiii/SchoolQuizGame to verify that your code has been uploaded successfully.

## Next Steps

After successfully pushing your code:

1. Configure GitHub Pages if you want to deploy the frontend (Settings > Pages)
2. Set up a README.md with instructions for others
3. Consider setting up GitHub Actions for automated deployment 