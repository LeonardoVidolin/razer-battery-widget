# Git setup for Razer Battery Widget

Follow these steps in **Command Prompt** or **PowerShell**. Replace placeholders with your details.

---

## 1. Check if Git is installed

```bat
git --version
```

If you see a version (e.g. `git version 2.43.0`), Git is installed. If you get an error, install Git from https://git-scm.com/download/win and run the installer, then open a new terminal.

---

## 2. Configure your identity (one-time per PC)

Git needs your name and email for every commit. Set them globally:

```bat
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

Use the **same email** as your GitHub account if you plan to push to GitHub.

**Check that it worked:**

```bat
git config --global user.name
git config --global user.email
```

---

## 3. Optional: default branch name

```bat
git config --global init.defaultBranch main
```

---

## 4. Turn this project into a Git repo and push to GitHub

Run these from the **project folder** (e.g. `d:\Cursos\Battery_widget`).

**Replace `YOUR_USERNAME`** with your GitHub username. Create the repo on GitHub first (New repository, name it e.g. `razer-battery-widget`, leave README/.gitignore/license unchecked).

```bat
cd /d d:\Cursos\Battery_widget

git init
git add .
git status
git commit -m "Initial commit: Razer Battery Widget"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/razer-battery-widget.git
git push -u origin main
```

- **`git status`** — Shows what will be committed. You should see no `node_modules` or `dist` (they’re in `.gitignore`).
- **GitHub login:** On first `git push`, Windows may open a browser or ask for credentials. Sign in with your GitHub account. If it asks for a password, use a **Personal Access Token** (GitHub → Settings → Developer settings → Personal access tokens → Generate new token).

---

## 5. After the first push

- Edit **README.md** and **package.json**: replace `YOUR_USERNAME` with your real GitHub username so the “Download” and repo links work.
- Create a **Release** on GitHub and upload the installer from `dist\` so people can download it.

---

## Quick reference

| Task              | Command |
|-------------------|--------|
| See status        | `git status` |
| Add all changes   | `git add .` |
| Commit            | `git commit -m "Your message"` |
| Push to GitHub    | `git push` |
| Pull from GitHub  | `git pull` |
