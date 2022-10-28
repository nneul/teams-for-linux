const { app, ipcMain, desktopCapturer, systemPreferences } = require('electron');
const path = require('path');
const { LucidLog } = require('lucid-log');
const isDev = require('electron-is-dev');
const os = require('os');
const isMac = os.platform() === 'darwin';
const config = require('./config')(app.getPath('userData'));
const logger = new LucidLog({
	levels: config.appLogLevels.split(',')
});

// Notification sound player
// eslint-disable-next-line no-unused-vars
const { NodeSound, NodeSoundPlayer } = require('node-sound');
/**
 * @type {NodeSoundPlayer}
 */
let player;
try {
	player = NodeSound.getDefaultPlayer();
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
app.commandLine.appendSwitch('enable-ntlm-v2', config.ntlmV2enabled);
app.commandLine.appendSwitch('try-supported-channel-layouts');

if (isMac){
	requestCameraAccess();
	
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
	ipcMain.handle('getZoomLevel', handleGetZoomLevel);
	ipcMain.handle('saveZoomLevel', handleSaveZoomLevel);
	ipcMain.handle('desktopCapturerGetSources', (event, opts) => desktopCapturer.getSources(opts));
	ipcMain.on('play-notification-sound', playNotificationSound);
}

// eslint-disable-next-line no-unused-vars
function playNotificationSound(event, audio) {
	const file = path.join(__dirname, `${isDev ? '' : '../../'}assets/sounds/notification.wav`);
	//TODO: Fix notification.wav location in macOS
	if (file) {
		logger.debug(`Playing file: ${file}`);
		player.play(file);
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

async function requestCameraAccess() {
	let status = systemPreferences.getMediaAccessStatus('camera');
	logger.debug(`mac camera status ${status}`);
	const permission = await systemPreferences.askForMediaAccess('camera');
	logger.debug(`mac camera permission ${permission}`);
}