const { app, ipcMain, desktopCapturer, systemPreferences, powerMonitor } = require('electron');
const path = require('path');
const fs = require('fs');
const { LucidLog } = require('lucid-log');
const isDev = require('electron-is-dev');
const os = require('os');
const isMac = os.platform() === 'darwin';
if (app.commandLine.hasSwitch('customUserDir')) {
	app.setPath('userData', app.commandLine.getSwitchValue('customUserDir'));
}
const config = require('./config')(app.getPath('userData'));
config.appPath = path.join(__dirname, isDev ? '' : '../../');

const logger = new LucidLog({
	levels: config.appLogLevels.split(',')
});

const notificationSounds = [{
	type: 'new-message',
	file: path.join(config.appPath, 'assets/sounds/new_message.wav')
},
{
	type: 'meeting-started',
	file: path.join(config.appPath, 'assets/sounds/meeting_started.wav')
}];

let userStatus = -1;

// Notification sound player
/**
 * @type {NodeSoundPlayer | Afplay}
 */
let player;
try {
	if (isMac) {
		const Afplay = require('afplay');
		player = new Afplay;
	} else {
		// eslint-disable-next-line no-unused-vars
		const { NodeSound, NodeSoundPlayer } = require('node-sound');
		player = NodeSound.getDefaultPlayer();
	}
} catch (e) {
	logger.info('No audio players found. Audio notifications might not work.');
}

const Store = require('electron-store');
const store = new Store({
	name: 'settings'
});
const certificateModule = require('./certificate');
const gotTheLock = app.requestSingleInstanceLock();
const mainAppWindow = require('./mainAppWindow');
if (config.useElectronDl) require('electron-dl')();

if (config.proxyServer) app.commandLine.appendSwitch('proxy-server', config.proxyServer);
app.commandLine.appendSwitch('auth-server-whitelist', config.authServerWhitelist);
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling');
app.commandLine.appendSwitch('enable-ntlm-v2', config.ntlmV2enabled);
app.commandLine.appendSwitch('try-supported-channel-layouts');

if (isMac) {
	requestMediaAccess();

} else if (process.env.XDG_SESSION_TYPE == 'wayland') {
	logger.info('Running under Wayland, switching to PipeWire...');

	const features = app.commandLine.hasSwitch('enable-features') ? app.commandLine.getSwitchValue('enable-features').split(',') : [];
	if (!features.includes('WebRTCPipeWireCapturer'))
		features.push('WebRTCPipeWireCapturer');

	app.commandLine.appendSwitch('enable-features', features.join(','));
	app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
}

const protocolClient = 'msteams';
if (!app.isDefaultProtocolClient(protocolClient, process.execPath)) {
	app.setAsDefaultProtocolClient(protocolClient, process.execPath);
}

app.allowRendererProcessReuse = false;

if (!gotTheLock) {
	logger.info('App already running');
	app.quit();
} else {
	app.on('second-instance', mainAppWindow.onAppSecondInstance);
	app.on('ready', handleAppReady);
	app.on('quit', () => logger.debug('quit'));
	app.on('render-process-gone', onRenderProcessGone);
	app.on('will-quit', () => logger.debug('will-quit'));
	app.on('certificate-error', handleCertificateError);
	ipcMain.handle('getConfig', handleGetConfig);
	ipcMain.handle('getSystemIdleTime', handleGetSystemIdleTime);
	ipcMain.handle('getSystemIdleState', handleGetSystemIdleState);
	ipcMain.handle('getZoomLevel', handleGetZoomLevel);
	ipcMain.handle('saveZoomLevel', handleSaveZoomLevel);
	ipcMain.handle('desktopCapturerGetSources', (event, opts) => desktopCapturer.getSources(opts));
	ipcMain.handle('getCustomBGList', handleGetCustomBGList);
	ipcMain.on('play-notification-sound', playNotificationSound);
	ipcMain.on('user-status-changed', userStatusChangedHandler);
}

// eslint-disable-next-line no-unused-vars
function playNotificationSound(event, options) {
	// Player failed to load or notification sound disabled in config
	if (!player || config.disableNotificationSound) {
		return;
	}
	// Notification sound disabled if not available set in config and user status is not "Available" (or is unknown)
	if (config.disableNotificationSoundIfNotAvailable && userStatus !== 1 && userStatus !== -1) {
		return;
	}
	const sound = notificationSounds.filter(ns => {
		return ns.type === options.type;
	})[0];

	if (sound) {
		logger.debug(`Playing file: ${sound.file}`);
		player.play(sound.file);
	}
}

function onRenderProcessGone() {
	logger.debug('render-process-gone');
	app.quit();
}

function onAppTerminated(signal) {
	if (signal == 'SIGTERM') {
		process.abort();
	} else {
		app.quit();
	}
}

function handleAppReady() {
	process.on('SIGTRAP', onAppTerminated);
	process.on('SIGINT', onAppTerminated);
	process.on('SIGTERM', onAppTerminated);
	//Just catch the error
	process.stdout.on('error', () => { });
	mainAppWindow.onAppReady(config);
}

async function handleGetConfig() {
	return config;
}

async function handleGetSystemIdleTime() {
	return powerMonitor.getSystemIdleTime();
}

async function handleGetSystemIdleState() {
	const idleState = powerMonitor.getSystemIdleState(config.appIdleTimeout);
	logger.debug(`GetSystemIdleState => IdleTimeout: ${config.appIdleTimeout}s, IdleTimeoutPollInterval: ${config.appIdleTimeoutCheckInterval}s, ActiveCheckPollInterval: ${config.appActiveCheckInterval}s, IdleTime: ${powerMonitor.getSystemIdleTime()}s, IdleState: '${idleState}'`);
	return idleState;
}

async function handleGetZoomLevel(_, name) {
	const partition = getPartition(name) || {};
	return partition.zoomLevel ? partition.zoomLevel : 0;
}

async function handleSaveZoomLevel(_, args) {
	let partition = getPartition(args.partition) || {};
	partition.name = args.partition;
	partition.zoomLevel = args.zoomLevel;
	savePartition(partition);
	return;
}

async function handleGetCustomBGList() {
	const file = path.join(app.getPath('userData'), 'custom_bg.json');
	if (!fs.existsSync(file)) {
		return [];
	} else {
		return JSON.parse(fs.readFileSync(file));
	}
}

function getPartitions() {
	return store.get('app.partitions') || [];
}

function getPartition(name) {
	const partitions = getPartitions();
	return partitions.filter(p => {
		return p.name == name;
	})[0];
}

function savePartition(arg) {
	const partitions = getPartitions();
	const partitionIndex = partitions.findIndex(p => {
		return p.name == arg.name;
	});

	if (partitionIndex >= 0) {
		partitions[partitionIndex] = arg;
	} else {
		partitions.push(arg);
	}
	store.set('app.partitions', partitions);
}

function handleCertificateError() {
	const arg = {
		event: arguments[0],
		webContents: arguments[1],
		url: arguments[2],
		error: arguments[3],
		certificate: arguments[4],
		callback: arguments[5],
		config: config
	};
	certificateModule.onAppCertificateError(arg, logger);
}

async function requestMediaAccess() {
	['camera', 'microphone', 'screen'].map(async (permission) => {
		const status = await systemPreferences.askForMediaAccess(permission);
		logger.debug(`mac permission ${permission} asked current status ${status}`);
	});
}

/**
 * Handle user-status-changed message
 * 
 * @param {*} event 
 * @param {*} options 
 */
function userStatusChangedHandler(event, options) {
	userStatus = options.data.status;
}