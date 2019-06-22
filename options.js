
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

	const _initializeSettings = () => {
		const areNotificationsOn = jmtyler.settings.get('notifications_on');
		if (areNotificationsOn) {
			$('#radToastOn').prop('checked', true);
		} else {
			$('#radToastOff').prop('checked', true);
		}
		$('#radToastOff').button('refresh');

		const doShowPageCount = jmtyler.settings.get('show_page_count');
		if (doShowPageCount) {
			$('#radShowCountOn').prop('checked', true);
		} else {
			$('#radShowCountOff').prop('checked', true);
		}
		$('#radShowCountOff').button('refresh');

		toastIconUri = jmtyler.settings.get('toast_icon_uri');
		$('#imgToastIcon').prop('src', toastIconUri);

		toastSoundUri = jmtyler.settings.get('toast_sound_uri');
		$('#audToastSound').prop('src', toastSoundUri);

		const readingClub = jmtyler.settings.get('reading_club');
		$('#txtReadingClub').prop('value', readingClub);
	};

	// TODO: eventually implement live edit
	$('#btnSave').button();
	$('#btnSave').on('click', () => {
		const areNotificationsOn = $('#radToast :radio:checked').val() == 'on';
		const doShowPageCount    = $('#radShowCount :radio:checked').val() == 'on';
		const readingClub        = $('#txtReadingClub').val();

		const previous = jmtyler.settings.get();
		jmtyler.settings.set('notifications_on', areNotificationsOn)
			.set('show_page_count', doShowPageCount)
			.set('toast_icon_uri', toastIconUri)
			.set('toast_sound_uri', toastSoundUri)
			.set('reading_club', readingClub);

		chrome.runtime.sendMessage({ method: 'OnSettingsChange', args: { previous } });
	});

	$('#btnReset').button();
	$('#btnReset').on('click', () => {
		const previous = jmtyler.settings.get();
		jmtyler.settings.clear();
		_initializeSettings();
		chrome.runtime.sendMessage({ method: 'OnSettingsChange', args: { previous } });
	});

	_initializeSettings();
});
