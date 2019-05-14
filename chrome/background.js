
const HomestuckURLRegex = /^https:\/\/www\.homestuck\.com(\/[a-z/-]+)($|\/([0-9]+))/;

const icons = {
	idle:   { '16': 'icons/16.png', '32': 'icons/32.png' },
	potato: { '16': 'icons/16.png', '32': 'icons/32.png' },
};

/* Main */

const Main = () => {
	jmtyler.log('executing Main()');

	chrome.browserAction.setBadgeBackgroundColor({ color: '#BB0000' });
	if (jmtyler.settings.get('is_debug_mode')) {
		Object.assign(icons, {
			idle:   { '16': 'icons/16.png', '32': 'icons/2B_32.png' },
			potato: { '16': 'icons/16.png', '32': 'icons/2B_32.png' },
		});
		chrome.browserAction.setBadgeBackgroundColor({ color: '#00AA00' });

		// Make some key functions globally accessible for debug mode.
		window.LaunchTab = () => LaunchTab();
		window.PlaySound = () => PlaySound();
		window.ClearData = () => ClearData();
	}

	// After startup, make sure the browser action still looks as it should with context.
	// TODO: Remember to handle first install, when we don't have any data yet.
	const activeStory = GetActiveStory();
	SetStatus('idle', activeStory);
	if (jmtyler.settings.get('show_page_count')) {
		SetBadge(activeStory.pages - activeStory.current);
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
	// TODO: Probably just switch this out for an event emitter or something.
	chrome.runtime.onMessage.addListener(({ method, args = {} }) => (OnMessage[method] ? OnMessage[method](args) : OnMessage.Unknown()));

	// const vapidKey = 'BB0WW0ANGE7CquFTQC0n68DmkVrInd616DEi3pI5Yq8IKHv0v9qhvzkAInBjEw2zNfgx29JB2DAQkV_81ztYpTg';
	// chrome.gcm.register([ vapidKey ], (registrationId) => {
	// TODO: Debug mode should hook into a separate FCM account purely for testing.
	chrome.instanceID.getToken({ authorizedEntity: '710329635775', scope: 'GCM' }, (token) => {
		// TODO: Need to send token to API to subscribe to the potato FCM topic.
		// TODO: Debug mode should point to a separate Staging API (or even ngrok if I can manage it).
		console.log('registered with gcm', token || chrome.runtime.lastError.message);

		// TODO: Now that we're using FCM, we should be able to switch to a nonpersistent background script, right?
		// TODO: For some features, we must specify a lowest supported Chrome version.  Will that allow us to use ES6 features too?
		// TODO: What happens if we were offline during a ping?  Does it arrive later?  Do we have to fetch explicitly?
		chrome.gcm.onMessage.addListener(({ data }) => {
			console.log('received gcm message', data);
			OnMessage.Potato(data);
		});
	});
};

/* Event Handlers */

const OnMessage = {
	Potato({ story: title, arc: subtitle, endpoint, page }) {
		let toastType = 'new_pages';
		// TODO: Probably don't want to distract the user if this potato isn't new *for them* (though it should be new for everyone now).
		const stories = jmtyler.memory.get('stories');
		if (!stories[endpoint]) {
			// TODO: brand new story/arc!
			toastType = 'new_story';  // TODO: Also need to differentiate between new_story and new_arc.
			stories[endpoint] = {
				endpoint: endpoint,
				title:    title,
				subtitle: subtitle || null,
				pages:    0,
				current:  0,
			};
		}

		const potatoSize = page - stories[endpoint].pages;
		stories[endpoint].pages = page;
		jmtyler.memory.set('stories', stories);

		SetStatus('potato', stories[endpoint]);
		ShowToast(toastType, stories[endpoint], potatoSize);
	},
	Unknown() {
		jmtyler.log('An unknown Runtime Message was received and therefore could not be processed.');
	},
};

const OnOverrideLastPageRead = ({ pageUrl }) => {
	// TODO: We should check which menu item was clicked.  We'll probably end up with more menu items soon.

	const urlParts = pageUrl.match(HomestuckURLRegex);
	const endpoint = urlParts[1];
	const page     = parseInt(urlParts[3] || '0', 10);

	const stories = jmtyler.memory.get('stories');
	if (!stories[endpoint]) {
		// TODO: Should maybe inform the user this is not a comic page.
		return;
	}

	MarkPage(endpoint, page);
};

const OnPageVisit = (_tabId, { url: currentPageUrl }) => {
	if (!currentPageUrl) {
		return;
	}

	// This listener isn't triggered AFTER a regex filter like the context menu, so must validate it ourselves.
	const urlParts = currentPageUrl.match(HomestuckURLRegex);
	if (!urlParts) {
		// This is not a Homestuck page, so we don't care about it.
		return;
	}

	const currentEndpoint = urlParts[1];
	const currentPage     = parseInt(urlParts[3] || '0', 10);

	const stories = jmtyler.memory.get('stories');
	const story = stories[currentEndpoint];
	if (!story) {
		// This page IS on Homestuck.com, but is NOT a comic page.
		return;
	}

	if (currentPage > story.current) {
		MarkPage(currentEndpoint, currentPage);
	}
};

/**
 * Set button icon as idle, open a new tab with the last page read,
 * and set the new 'last page read' as the latest update available.
 */
const LaunchTab = () => {
	try {
		const story = GetActiveStory();
		jmtyler.log('executing LaunchTab()', story);
		chrome.tabs.create({ url: `https://www.homestuck.com${story.endpoint}/${story.current}` });
	} catch (e) {
		jmtyler.log('failed to open new tab for MSPA', e);
	}
};

/* Core Functions */

const MarkPage = (endpoint, page) => {
	const stories = jmtyler.memory.get('stories');
	stories[endpoint].current = page;
	jmtyler.memory.set('stories', stories);

	const story = stories[endpoint];
	SetStatus('idle', story);
	if (jmtyler.settings.get('show_page_count')) {
		SetBadge(story.pages - story.current);
	}
};

const PlaySound = () => {
	const toastSoundUri = jmtyler.settings.get('toast_sound_uri');
	if (!toastSoundUri) {
		return;
	}

	// TODO: This MIGHT not work anymore once we switch to a nonpersistent background script...
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

const ShowToast = (type, story, count) => {
	if (!jmtyler.settings.get('notifications_on')) {
		return;
	}

	const fullTitle = [story.title, story.subtitle].filter((v) => v).join(': ');

	const iconUrl = jmtyler.settings.get('toast_icon_uri');
	const title   = 'Homestuck.com';
	let message = ({
		'new_story': `<strong>THERE'S A BRAND NEW STORY: <em>${story.title}</em></strong>`,
		'new_arc':   `<strong><em>${story.title}</em> POSTED A NEW STORY: <em>${story.subtitle}</em></strong>`,
		'new_pages': `<strong>THERE'S BEEN AN UPDATE TO <em>${fullTitle}</em>!!!</strong>`,
	})[type];

	if (jmtyler.settings.get('show_page_count')) {
		message += `\n<sup>(There are ${count} new pages.)</sup>`;
	}

	chrome.notifications.create({ type: 'basic', title, message, iconUrl }, (id) => {
		// TODO: This doesn't seem to have an effect.  The toast is clearing itself automatically.
		// TODO: I think I'd actually like to keep the toast up persistently until they close it.
		setTimeout(() => chrome.notifications.clear(id), 10000);
	});

	PlaySound();
};

/* Helpers */

const GetActiveStory = () => {
	const endpoint = jmtyler.memory.get('active');
	const stories = jmtyler.memory.get('stories');
	return stories[endpoint];
};

const SetStatus = (iconKey, story) => {
	chrome.browserAction.setIcon({ path: icons[iconKey] });

	const fullTitle = [story.title, story.subtitle].filter((v) => v).join(' - ');
	const status = `Currently reading: ${fullTitle}\nOn Page #${story.current}`;
	chrome.browserAction.setTitle({ title: chrome.runtime.getManifest().name + '\n' + status });
};

const SetBadge = (count) => {
	let text = count.toString();
	if (count == 0) text = '';
	chrome.browserAction.setBadgeText({ text });
};

const ClearData = () => {
	jmtyler.settings.clear();
	jmtyler.memory.clear();
	SetStatus('idle');
	SetBadge(0);
};

chrome.runtime.onInstalled.addListener(({ reason }) => {
	const previousVersion = jmtyler.memory.get('version');
	const currentVersion = chrome.runtime.getManifest().version;
	jmtyler.log('executing onInstalled()', { currentVersion, previousVersion, reason });

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
