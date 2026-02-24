# Publish Razer Battery Widget — checklist

Do these in order. Repo URL is set to **LeonardoVidolin/razer-battery-widget**.

---

## Step 1: Build the installer

In **Command Prompt** or **PowerShell**:

```bat
cd /d d:\Cursos\Battery_widget
npm run build
```

When it finishes, you should have **Razer Battery Widget Setup 1.0.0.exe** in the `dist\` folder.

---

## Step 2: Create the repo on GitHub

1. Go to **https://github.com/new**
2. **Repository name:** `razer-battery-widget` (or any name you like)
3. **Public**
4. Leave **"Add a README"**, **".gitignore"**, and **"License"** **unchecked**
5. Click **Create repository**

---

## Step 3: Push your code

**Important:** Run these commands from the **project folder** (where `main.js` and `package.json` are). In Command Prompt:

```bat
cd /d d:\Cursos\Battery_widget
```

Then:

```bat
git init
git add .
git status
git commit -m "Initial commit: Razer Battery Widget"
git branch -M main
git remote add origin https://github.com/LeonardoVidolin/razer-battery-widget.git
git push -u origin main
```

Sign in in the browser if Git asks.

---

### If `git add .` doesn't add anything

1. **Check your folder:** You must be in the project root (the folder that contains `main.js`, `package.json`, `.gitignore`). Run:
   ```bat
   cd /d d:\Cursos\Battery_widget
   dir
   ```
   You should see `main.js`, `package.json`, etc.

2. **See what Git sees:** Run:
   ```bat
   git status
   ```
   - **"nothing to commit, working tree clean"** → Everything is already committed. You can go straight to **Step 4** (fix links) and **Step 5** (create release), then run **`git push -u origin main`** if you haven't pushed yet.
   - **"Untracked files"** listed → Run `git add .` again from this folder; they should be added.
   - **"Changes not staged"** → Run `git add .` then `git commit -m "Your message"`.

3. **If the repo was already initialized elsewhere:** Run `git status` in the folder where you ran `git init`. That folder is your repo root; all commands must be run there.

---

## Step 4: Fix the links in the repo

1. README and package.json already use **LeonardoVidolin**. After you push, the repo links will work as-is.

---

## Step 5: Create the first release

1. On GitHub, open your repo.
2. Click **Releases** (right side) → **Create a new release**.
3. **Choose a tag:** type `v1.0.0` → **Create new tag: v1.0.0**.
4. **Release title:** `v1.0.0`
5. **Describe this release:** e.g.  
   `First release. Windows installer for Razer Battery Widget. Requires Razer Synapse 3 or 4.`
6. Under **Attach binaries**, drag and drop:  
   **Razer Battery Widget Setup 1.0.0.exe** from `d:\Cursos\Battery_widget\dist\`
7. Click **Publish release**.

---

## Done

Your project is published. The **Download** link in the README now points to the latest release, and anyone can download the installer from there.

Optional: In repo **Settings → General**, add a short description and topics: `razer`, `battery`, `electron`, `windows`, `synapse`.
