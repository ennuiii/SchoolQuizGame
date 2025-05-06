# GitHub Branch Cleanup Instructions

You currently have both `main` and `master` branches in your GitHub repository. Here's how to clean things up:

## Option 1: Set `master` as Default and Remove `main`

### Step 1: Set master as the default branch
1. Go to https://github.com/ennuiii/SchoolQuizGame/settings/branches
2. Under "Default branch", click the switch button
3. Select "master" from the dropdown
4. Click "Update"
5. Confirm the change

### Step 2: Delete the main branch
1. Go to https://github.com/ennuiii/SchoolQuizGame/branches
2. Find the "main" branch
3. Click the trash icon next to it
4. Confirm the deletion

## Option 2: Merge master into main (GitHub Standard)

Most GitHub repositories use `main` as the default branch name now. If you want to follow this convention:

### Step 1: Pull the main branch
```powershell
git fetch origin
git checkout main
```

### Step 2: Merge your master branch into main
```powershell
git merge master
git push origin main
```

### Step 3: Set main as the default branch
1. Go to https://github.com/ennuiii/SchoolQuizGame/settings/branches
2. Under "Default branch", click the switch button
3. Select "main" from the dropdown
4. Click "Update"
5. Confirm the change

### Step 4: Delete the master branch (optional)
```powershell
# Delete the remote branch
git push origin --delete master

# Delete the local branch (switch to main first)
git checkout main
git branch -d master
```

## Recommendation

Since GitHub now uses `main` as the standard default branch, Option 2 is recommended as it will align your repository with GitHub conventions. However, if you prefer to keep things simple, Option 1 works just fine.

Choose the option that works best for you! 