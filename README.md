# Razer Battery Widget

A lightweight Windows desktop widget that shows battery level and charging status for your Razer wireless devices—headphones, keyboard, and mouse—in one place. Styled with Razer’s dark theme and green accents.
<img width="449" height="164" alt="image" src="https://github.com/user-attachments/assets/0427ea9e-8da8-4864-ae5f-ed89ac90785e" />


---

## Download

**[Download the latest release (Windows installer)](https://github.com/LeonardoVidolin/razer-battery-widget/releases/latest)**

1. Download **Razer Battery Widget Setup x.x.x.exe**
2. Run the installer
3. Launch the app—the widget appears on your desktop and an icon sits in the system tray

**Requirement:** [Razer Synapse 3](https://www.razer.com/synapse-3) or [Razer Synapse 4](https://www.razer.com/synapse) must be running. The widget reads battery data from Synapse’s logs—no extra drivers or USB access needed.

---

## Features

- **Three device slots** — Headphones, keyboard, and mouse with clear icons and circular battery indicators
- **Charging indicator** — Lightning icon when a device is charging
- **Razer-style UI** — Dark background, green accents, always-on-top option
- **System tray** — Minimize to the tray; double-click or use the menu to show the widget again
- **Start with Windows** — Optional launch at login (toggle in the tray menu)
- **Always on top** — Optional toggle so the widget stays above other windows

---

## Requirements

- **Windows** 10 or 11
- **Razer Synapse 3** or **Razer Synapse 4** (running in the background)
- No admin rights or extra drivers required

---

## Usage

- **Move the widget** — Drag it by the background
- **Minimize** — Close the window; the app stays in the system tray
- **Show again** — Double-click the tray icon or right-click → **Show Widget**
- **Tray menu** — Right-click the tray icon for **Start with Windows**, **Always on top**, and **Quit**

---

## Supported devices

Devices are detected automatically from Synapse. Typical matches:

| Slot       | Examples                                                                 |
| ---------- | ------------------------------------------------------------------------ |
| Headphones | BlackShark, Kraken, Barracuda, Nari, Thresher, and other headsets        |
| Keyboard   | BlackWidow, Huntsman, Ornata, Cynosa, DeathStalker                        |
| Mouse      | DeathAdder, Viper, Basilisk, Mamba, Naga, Orochi, Cobra, Pro Click       |

If a device doesn’t appear, it may use a name that isn’t mapped yet; the widget still shows up to three devices, filling slots in order when the exact type isn’t recognized.

---

## For developers

### Run from source

```bash
git clone https://github.com/LeonardoVidolin/razer-battery-widget.git
cd razer-battery-widget
npm install
npm start
```

### Build the installer

```bash
npm run build
```

The installer is created in the `dist/` folder.

### How it works

Battery data is read from Razer Synapse log files (same approach as [razer-taskbar](https://github.com/sanraith/razer-taskbar)):

- **Synapse 3:** `%LOCALAPPDATA%\Razer\Synapse3\Log\Razer Synapse 3.log`
- **Synapse 4:** `%LOCALAPPDATA%\Razer\RazerAppEngine\User Data\Logs\systray_systrayv2*.log`

Device names and keywords can be extended in `renderer.js` to support more products.

### Regenerate tray icon

```bash
npm run tray-icon
```

---

## License

MIT — see [LICENSE](LICENSE).

---

---

**Maintainer:** Release checklist and Git setup are in the [docs/](docs/) folder.

*Not affiliated with Razer Inc. Razer and Synapse are trademarks of Razer Inc.*
