# Config

This folder contains the configuration options available for the app.

## Available starting arguments

The application uses [yargs](https://www.npmjs.com/package/yargs) to allow command line arguments.

Here is the list of available arguments and its usage:

| Option | Usage | Default Value |
|:-:|:-:|:-:|
| help  | show the available commands | false |
| version | show the version number | false |
| onlineOfflineReload | Reload page when going from offline to online | true |
| rightClickWithSpellcheck | Enable/Disable the right click menu with spellchecker | true |
| closeAppOnCross | Close the app when clicking the close (X) cross | false |
| partition | [BrowserWindow](https://electronjs.org/docs/api/browser-window) webpreferences partition | persist:teams-4-linux |
| webDebug | Start with the browser developer tools open  |  false |
| minimized | Start the application minimized | false |
| url | url to open | [https://teams.microsoft.com/](https://teams.microsoft.com/) |
| proxyServer | Proxy Server with format address:port | None |
| useElectronDl | Use Electron dl to automatically download files to the download folder | false |
| config | config file location | ~/.config/teams-for-linux/config.json |
| chromeUserAgent | user agent string for chrome | Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3831.6 Safari/537.36 |
| ntlmV2enabled | set enable-ntlm-v2 value | true |
| authServerWhitelist | set auth-server-whitelist value | * |
| customCSSName | Custom CSS name for the packaged available css files. Currently those are: "compactDark", "compactLight", "tweaks", "condensedDark" and "condensedLight" | |
| customCSSLocation | Location for custom CSS styles | |
| customCACertsFingerprints | custom CA Certs Fingerprints to allow SSL unrecognized signer or self signed certificate (see below) | [] |
| clientCertPath clientCertPassword | custom Client Certs for corporate authentication (certificate must be in pkcs12 format) | [] |
| appIcon | 'Teams app icon to show in the tray' | ../assets/icons/icon-16x16.png if Mac or ../assets/icons/icon-96x96.png otherwise|  
| spellCheckerLanguages | Language codes to use with Electron\'s spell checker (experimental) | [] |
| customUserDir | Custom User Directory so that you can have multiple profiles | |
| appLogLevels | Comma separated list of log levels (error,warn,info,debug) | error,warn |
| clearStorage | Whether to clear the storage before creating the window or not | false |
| disableNotifications | A flag to disable all notifications | false |
| disableMeetingNotifications | Whether to disable meeting notifications or not | false |
| disableNotificationSound | Disable chat/meeting start notification sound | false |
| disableNotificationSoundIfNotAvailable | Disable chat/meeting start notification sound if status is not Available (e.g. busy, in a call) | true |
| appIdleTimeout | A numeric value in seconds as duration before app considers the system as idle | 300 |
| appIdleTimeoutCheckInterval | A numeric value in seconds as poll interval to check if the appIdleTimeout is reached | 10 |
| appActiveCheckInterval | A numeric value in seconds as poll interval to check if the system is active from being idle | 2 |
| screenLockInhibitionMethod | Screen lock inhibition method to be used (Electron/WakeLockSentinel) | Electron |



As an example, to disable the persitence, you can run the following command:

```bash
teams-for-linux --partition nopersist
```

Alternatively, you can use a file called `config.json` with the configuration options. This file needs to be located in `~/.config/teams-for-linux/config.json`

[yargs](https://www.npmjs.com/package/yargs) allows for extra modes of configuration. Refer to their documentation if you prefer to use a configuration file instead of arguments.

Example:

```json
{
    "closeAppOnCross": true
}
```

## Getting custom CA Certs fingerprints

Information about how to get the custom CA Certs fingerprints is now available under the [certificate README.md file](../certificate/README.md)

## Custom backgrounds

We added a feature to load custom background images during a video call. This is available from version `1.0.84`.

### Things to remember:

1. Currently app does not feature adding or removing custom images. You have to rely on any locally hosted light weight web servers to serve images.
2. Custom images are always loaded with `http://locahost/<image-path>`. So, you have to make sure the web server is running and `http://localhost` responds to the request.
3. You can choose any web server of your choice but make sure `Access-Control-Allow-Origin` is set to `*` in response headers from web server.

For apache2, `/etc/apache2/apache2.conf` may need to have an entry like this.
```xml
<Directory /var/www/>
	Header set Access-Control-Allow-Origin "*"
	Options Indexes FollowSymLinks
	AllowOverride None
	Require all granted
</Directory>
```

### Configuring list of images

1. List of images are to be stored in `custom_bg.json` in `config` folder.
2. It would look like this:
```js
[
	{
		"filetype": "jpg", // Type of image
		"id": "Custom_bg01", // Id of the image. Give a unique name without spaces.
		"name": "Custom bg", // Name of your image.
		"src": "/teams-for-linux/custom-bg/<path-to-image>", // Path to the image to be loaded when selected from the preview.
		"thumb_src": "/teams-for-linux/custom-bg/<path-to-thumb-image>" // Path to the image to be shown on the preview screen. You can use same as the original or a cropped down image also.
	}
]
```

As you can see from the above example, it's a JSON array so you can configure any number of images of your choice.