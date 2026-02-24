# Razer Battery Widget

A small desktop widget that shows battery level for your Razer wireless gear (headphones, keyboard, mouse) with circular indicators and a charging (lightning) icon when applicable. Styled with Razer’s dark theme and green accents.

## Download

**[→ Latest release (installer)](https://github.com/YOUR_USERNAME/razer-battery-widget/releases/latest)** — Download the `.exe` installer, run it, and you’re done. Requires [Razer Synapse 3](https://www.razer.com/synapse-3) or [Razer Synapse 4](https://www.razer.com/synapse) to be running.

*(Replace `YOUR_USERNAME` with your GitHub username after you create the repo and your first release.)*

## How it works

Like [razer-taskbar](https://github.com/sanraith/razer-taskbar), this app reads battery data from **Razer Synapse** log files—no USB or driver needed. You must have **Razer Synapse 3** or **Razer Synapse 4** running.

- **Synapse 3:** `%LOCALAPPDATA%\Razer\Synapse3\Log\Razer Synapse 3.log`
- **Synapse 4:** `%LOCALAPPDATA%\Razer\RazerAppEngine\User Data\Logs\systray_systrayv2*.log`

## Requirements

- Windows (tested on 10 & 11)
- Razer Synapse 3 or 4 running in the background
- Node.js (for running from source or building the .exe)

## Run from source

```bash
npm install
npm start
```

The widget appears as a floating window. Drag the background to move it. Close the window to minimize to the system tray; double‑click the tray icon or use **Show Widget** in the tray menu to open it again.

## Start with Windows

- Right‑click the tray icon → **Start with Windows** (checked by default).
- When enabled, the widget will start automatically when you log in.

## Build an installer (.exe)

```bash
npm install
npm run build
```

The installer is created in the `dist/` folder. Run it to install Razer Battery Widget; you can choose the install location and create a desktop shortcut. After installation, enable **Start with Windows** in the tray menu if you want it to launch at login.

## Device mapping

Devices are matched to slots by name. If a device isn’t recognized, it is still shown in the first available slot (headphones, then keyboard, then mouse).

- **Headphones:** headset, headphone, BlackShark, Kraken, Barracuda, Nari, etc.
- **Keyboard:** keyboard, BlackWidow, Huntsman, Ornata, Cynosa, etc.
- **Mouse:** mouse, DeathAdder, Viper, Basilisk, Mamba, Naga, Orochi, Cobra, Pro Click, etc.

You can extend the keywords in `renderer.js` if needed.

## Tray icon

The system tray uses `assets/tray-icon.png` (a 32×32 Razer-green battery icon). To regenerate it:

```bash
npm run tray-icon
```

## Publishing on GitHub

### 1. Create the repository and push

1. On GitHub, click **New repository**. Name it (e.g. `razer-battery-widget`). Do **not** add a README, .gitignore, or license.
2. In your project folder, run (replace `YOUR_USERNAME` with your GitHub username):

   ```bash
   git init
   git add .
   git commit -m "Initial commit: Razer Battery Widget"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/razer-battery-widget.git
   git push -u origin main
   ```

### 2. Optional: repo description and topics

In the repo **Settings → General**, set a short description and topics (e.g. `razer`, `battery`, `electron`, `windows`, `synapse`).

### 3. Publish a release (so others can download the installer)

1. **Build the installer:**

   ```bash
   npm run build
   ```

2. **Create a release on GitHub:**
   - Open your repo → **Releases** → **Create a new release**.
   - **Choose a tag:** e.g. `v1.0.0` (create new tag).
   - **Release title:** e.g. `v1.0.0`.
   - **Description:** e.g. “First release. Windows installer for Razer Battery Widget.”
   - **Attach the installer:** drag and drop the file from `dist/` — it’s named like **Razer Battery Widget Setup 1.0.0.exe**.
   - Click **Publish release**.

3. **Update the Download link** in this README: replace `YOUR_USERNAME` in the “Latest release” link with your GitHub username so the link points to your repo.

After that, the **Download** section at the top will point to your latest release and users can get the installer from there.
