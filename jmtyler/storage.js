/**
 * TODO: Use chrome.storage.local/sync.  Further encapsulate details such as defaults and maps.
 */

var jmtyler = jmtyler || {};
jmtyler.storage = (() => {
	const defaults = {
		notificationsOn: true,
		showPageCount:   false,
		toastIconUri:    'icons/48.png',
		toastSoundUri:   null,
		isDebugMode:     false,
		readingClub:     null,
	};

	const storage = {
		get(key = null) {
			return new Promise((resolve, reject) => {
				chrome.storage.local.get(key, (result) => {
					if (typeof result == 'undefined') {
						// BLOCKER: Reject with lastError directly if it's already an error object.
						reject(new Error(chrome.runtime.lastError.message));
						return;
					}
					// BLOCKER: Defaults?
					resolve(key ? result[key] : result);
				});
			});
		},
		set(key, value) {
			let data = key;
			if (typeof value != 'undefined') {
				data = { [key]: value };
			}

			return new Promise((resolve, reject) => {
				chrome.storage.local.set(data, () => {
					const err = chrome.runtime.lastError.message;
					if (err) {
						reject(new Error(err));
						return;
					}
					// BLOCKER: I don't think I want method chaining anymore.
					resolve(this);
				});
			});
		},
		clear(keys) {
			return new Promise((resolve, reject) => {
				const cb = () => {
					const err = chrome.runtime.lastError.message;
					if (err) {
						reject(new Error(err));
						return;
					}
					resolve(this);
				};

				if (!keys) {
					chrome.storage.local.clear(cb);
					return;
				}

				chrome.storage.local.remove(keys, cb);
			});
		},
	};

	return storage;
})();
