# The Reminder App

A Chrome extension for organizing tasks, nested mini tasks, and focused work sessions.

## Run as a Chrome extension

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode**.
3. Choose **Load unpacked**.
4. Select this project folder: `App`.
5. Click the extension icon and pin **The Reminder App** for quick access.

The extension uses Manifest V3 and stores tasks locally in the browser. No local server is required after loading the unpacked extension.

## Local preview

For browser development, serve this folder with a static server such as:

```sh
python3 -m http.server 4177
```

Then open `http://localhost:4177`.