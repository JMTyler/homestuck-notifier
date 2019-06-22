
$(() => {
	let toastIconUri = null;
	let toastSoundUri = null;

	$('#lblVersion').text(chrome.runtime.getManifest().version);

	$('#radToast').buttonset();
	$('#radShowCount').buttonset();

	$('#fileToastIcon').on('change', (event) => {
		const file = event.target.files[0];  // TODO: can this array be empty?
		if (!file.type.match('image.*')) {
			// TODO: display an error of some kind
			return;
		}
		// TODO: worthwhile to encapsulate file operations?
		const fileReader = new FileReader();
		fileReader.onload = (event) => {
			toastIconUri = event.target.result;
			$('#imgToastIcon').prop('src', toastIconUri);
		};
		fileReader.readAsDataURL(file);
	});

	$('#fileToastSound').on('change', (event) => {
		const file = event.target.files[0];  // TODO: can this array be empty?
		if (!file.type.match('audio.*')) {
			// TODO: display an error of some kind
			//		 specifically for midis... I bet a lot of people will want midis
			return;
		}
		// TODO: worthwhile to encapsulate file operations?
		const fileReader = new FileReader();
		fileReader.onload = (event) => {
			toastSoundUri = event.target.result;
			$('#audToastSound').prop('src', toastSoundUri);
		};
		fileReader.readAsDataURL(file);
	});

	$('#grpAccordion').accordion({ collapsible: true, active: false });

	const _initializeSettings = async () => {
		const areNotificationsOn = await jmtyler.storage.get('notificationsOn');
		if (areNotificationsOn) {
			$('#radToastOn').prop('checked', true);
		} else {
			$('#radToastOff').prop('checked', true);
		}
		$('#radToastOff').button('refresh');

		const doShowPageCount = await jmtyler.storage.get('showPageCount');
		if (doShowPageCount) {
			$('#radShowCountOn').prop('checked', true);
		} else {
			$('#radShowCountOff').prop('checked', true);
		}
		$('#radShowCountOff').button('refresh');

		toastIconUri = await jmtyler.storage.get('toastIconUri');
		$('#imgToastIcon').prop('src', toastIconUri);

		toastSoundUri = await jmtyler.storage.get('toastSoundUri');
		$('#audToastSound').prop('src', toastSoundUri);

		const readingClub = await jmtyler.storage.get('readingClub');
		$('#txtReadingClub').prop('value', readingClub);
	};

	// TODO: eventually implement live edit
	$('#btnSave').button();
	$('#btnSave').on('click', () => {
		const notificationsOn = $('#radToast :radio:checked').val() == 'on';
		const showPageCount   = $('#radShowCount :radio:checked').val() == 'on';
		const readingClub     = $('#txtReadingClub').val();

		const previous = await jmtyler.storage.get();
		await jmtyler.storage.set({
			notificationsOn,
			showPageCount,
			toastIconUri,
			toastSoundUri,
			readingClub,
		});

		chrome.runtime.sendMessage({ method: 'OnSettingsChange', args: { previous } });
	});

	$('#btnReset').button();
	$('#btnReset').on('click', () => {
		const previous = await jmtyler.storage.get();
		// BLOCKER: Don't do this! It'll clear the app memory as well!
		// await jmtyler.storage.clear();
		_initializeSettings();
		chrome.runtime.sendMessage({ method: 'OnSettingsChange', args: { previous } });
	});

	_initializeSettings();
});
