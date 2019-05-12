
const icons = {
	idle:    'icons/16.png',
	updates: 'icons/whatpumpkin.gif',
};

/* Main */

const Main = () => {
	jmtyler.log('executing Main()');

	chrome.browserAction.setBadgeBackgroundColor({ color: '#00AA00' });
	if (jmtyler.settings.get('is_debug_mode')) {
		chrome.browserAction.setBadgeText({ text: 'dbg' });
		chrome.browserAction.setBadgeBackgroundColor({ color: '#BB0000' });

		// Make some key functions globally accessible for debug mode.
		window.LaunchTab = () => LaunchTab();
		window.PlaySound = () => PlaySound();
		window.ClearData = () => ClearData();
	}

	const lastPageRead    = jmtyler.memory.get('last_page_read');
	const latestUpdate    = jmtyler.memory.get('latest_update');
	const doShowPageCount = jmtyler.settings.get('show_page_count');

	// After startup, make sure the browser action still looks as it should with context.
	SetStatus('idle', lastPageRead);
	if (lastPageRead == latestUpdate) {
		SetBadge('');
	} else if (latestUpdate !== false && doShowPageCount) {
		SetBadge(CalculateRemainingPages(lastPageRead, latestUpdate));
	}

	chrome.contextMenus.create({
		title:               "Mark as my Last Read page",
		documentUrlPatterns: ["https://www.homestuck.com/*"],
		contexts:            ['page', 'frame', 'link', 'image', 'video', 'audio'],  // Pretty much as long as it is on the MSPA website.
	});

	chrome.contextMenus.onClicked.addListener(OnOverrideLastPageRead);
	chrome.tabs.onUpdated.addListener(OnPageVisit);
	chrome.browserAction.onClicked.addListener(LaunchTab);
	chrome.notifications.onClicked.addListener((id) => {
		chrome.notifications.clear(id);
		LaunchTab();
	});
	chrome.runtime.onMessage.addListener(({ method, args = {} }) => (OnMessage[method] ? OnMessage[method](args) : OnMessage.Unknown()));

	// const vapidKey = 'BB0WW0ANGE7CquFTQC0n68DmkVrInd616DEi3pI5Yq8IKHv0v9qhvzkAInBjEw2zNfgx29JB2DAQkV_81ztYpTg';
	// chrome.gcm.register([ vapidKey ], (registrationId) => {
	chrome.instanceID.getToken({ authorizedEntity: '710329635775', scope: 'GCM' }, (token) => {
		console.log('registered with gcm', token || chrome.runtime.lastError.message);

		// TODO: Now that we're using FCM, we should be able to switch to a nonpersistent background script, right?
		// TODO: For some features, we must specify a lowest supported Chrome version.  Will that allow us to use ES6 features too?
		chrome.gcm.onMessage.addListener(({ data }) => {
			console.log('received gcm message', data);
			OnMessage.Potato(data);
		});
	});
};

/* Event Handlers */

const OnMessage = {
	Potato({ story, arc, endpoint, page }) {
		// TODO: Probably don't want to distract the user if this potato isn't new *for them* (though it should be new for everyone now).
		ShowToast(story, arc, endpoint, page);
		PlaySound();
	},
	Unknown() {
		jmtyler.log('An unknown Runtime Message was received and therefore could not be processed.');
	},
};

const OnOverrideLastPageRead = ({ pageUrl }) => {
	// TODO: We should check which menu item was clicked.  We'll probably end up with more menu items soon.
	MarkPage(pageUrl);
};

const OnPageVisit = (_tabId, { url: currentPageUrl }) => {
	if (!currentPageUrl) {
		return;
	}

	// This listener isn't triggered AFTER a regex filter like the context menu, so must do it ourselves.
	const currentPage = currentPageUrl.match(/^https:\/\/www\.homestuck\.com\/([a-z/-]+)($|\/([0-9]+))/);
	if (currentPage === null) {
		// This is not an MSPA comic page, so we don't care about it.
		return;
	}

	// TODO: We're on Homestuck.com, but it may not be a comic page.  Filter URL through our list of Story Arc endpoints.

	const savedPageUrl = jmtyler.memory.get('last_page_read');
	const savedPage    = savedPageUrl.match(/^https:\/\/www\.homestuck\.com\/([a-z/-]+)($|\/([0-9]+))/);

	// Strip the page IDs off this page's URL and our saved page's URL, then compare them.
	const currentStory  = currentPage[1];
	const currentPageId = parseInt(currentPage[3] || '1', 10);
	const savedStory    = savedPage[1];
	const savedPageId   = parseInt(savedPage[3] || '1', 10);

	// TODO: We should update every Story's last read page anyway, whether it's my active Story or not.
	if (currentStory === savedStory && currentPageId > savedPageId) {
		// This page is LATER than the last page we've read, so this is the new one!
		// TODO: This is actually broken now, since CalculateRemainingPages expects an MSPA URL.
		MarkPage(currentPageUrl);
	}
};

/**
 * Set button icon as idle, open a new tab with the last page read,
 * and set the new 'last page read' as the latest update available.
 */
const LaunchTab = () => {
	try {
		const latestUpdate = jmtyler.memory.get('latest_update');
		const lastPageRead = jmtyler.memory.get('last_page_read') || "https://www.homestuck.com";

		jmtyler.log('executing LaunchTab()', latestUpdate, lastPageRead);

		chrome.tabs.create({ url: lastPageRead });
	} catch (e) {
		jmtyler.log('failed to open new tab for MSPA', e);
	}

	return;
};

/* Core Functions */

const MarkPage = (url) => {
	// TODO: This should take more info than just URL, and update everything.
	jmtyler.memory.set('last_page_read', url);
	SetStatus('idle', url);

	const latestUpdate = jmtyler.memory.get('latest_update');
	if (latestUpdate !== false && doShowPageCount) {
		SetBadge(CalculateRemainingPages(url, latestUpdate));
	}
};

const PlaySound = () => {
	const toastSoundUri = jmtyler.settings.get('toast_sound_uri');
	if (toastSoundUri == null) {
		return;
	}

	// Get the existing <audio /> element from the page, if one's already been created ...
	let audio = document.getElementsByTagName('audio');
	if (audio.length > 0) {
		audio = audio[0];
	} else {
		// ... if not, create it.
		audio = document.createElement('audio');
		document.body.appendChild(audio);
		audio.autoplay = true;
		audio.controls = false;
		audio.volume = 1.0;
	}

	// Bam.  Audio automatically plays when you set the 'src' property, apparently.
	audio.src = toastSoundUri;
};

const ShowToast = (story, arc, endpoint, page) => {
	// Show notification for new updates.
	const iconUrl = jmtyler.settings.get('toast_icon_uri');
	const title   = "Homestuck.com - " + story;
	const message = "Update!! Click here to start reading!";

	chrome.notifications.create({ type: 'basic', title, message, iconUrl }, (id) => {
		// TODO: This doesn't seem to have an effect.  The toast is clearing itself automatically.
		setTimeout(() => chrome.notifications.clear(id), 10000);
	});
};

/* Helpers */

const SetStatus = (iconKey, lastPageRead = null) => {
	chrome.browserAction.setIcon({ path: icons[iconKey] });
	if (iconKey !== null) {
		chrome.browserAction.setTitle({ title: chrome.runtime.getManifest().name + '\n' + lastPageRead });
	}
};

const SetBadge = (text) => {
	chrome.browserAction.setBadgeText({ text: text.toString() });
};

const CalculateRemainingPages = (lastPageRead, latestUpdate) => {
	// TODO: Should probably start storing the unread pages count so we don't have to do this.
	const lastPageReadId     = parseInt(lastPageRead.substr(lastPageRead.length - 6), 10);
	const latestUpdatePageId = parseInt(latestUpdate.substr(latestUpdate.length - 6), 10);
	const unreadPageCount    = latestUpdatePageId - lastPageReadId;
	return unreadPageCount;
};

const ClearData = () => {
	jmtyler.settings.clear();
	jmtyler.memory.clear();
	SetStatus('idle');
	SetBadge('');
};

chrome.runtime.onInstalled.addListener(({ reason, previousVersion }) => {
	const currentVersion = chrome.runtime.getManifest().version;
	jmtyler.log('executing onInstalled()', { currentVersion, previousVersion, reason });

	if (currentVersion == previousVersion) {
		jmtyler.log('  new version is same as old version... aborting');
		return;
	}

	// If the latest version has already been fully installed, don't do anything. (Not sure how we got here, though.)
	if (jmtyler.version.isInstalled(currentVersion)) {
		jmtyler.log('  new version has already been installed... aborting');
		return;
	}

	// Install the latest version, performing any necessary migrations.
	switch (reason) {
		case 'install':
			jmtyler.log('  extension is newly installed');
			jmtyler.version.install(currentVersion);
			break;
		case 'update':
		case 'chrome_update':
			jmtyler.log('  extension is being updated');
			jmtyler.version.update(previousVersion, currentVersion);
			break;
		default:
			jmtyler.log('  extension is in some unhandled state... [' + reason + ']');
			break;
	}

	jmtyler.log('  done migration, ready to run Main()');

	// Now that we've finished any migrations, we can run the main process.
	Main();
});

const version = chrome.runtime.getManifest().version;
const isInstalled = jmtyler.version.isInstalled(version);
jmtyler.log('checking if current version has been installed...' + (isInstalled ? 'yes' : 'no'));
if (isInstalled) {
	// Only run the main process immediately if the latest version has already been fully installed.
	jmtyler.log('current version is installed, running Main() immediately');
	Main();
}
