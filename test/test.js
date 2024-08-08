import {
	listLocalIdentities,
	clearCryptoKeyCache,
	removeLocalAccount,
	getCryptoKey,
	lockData,
	unlockData,
	setMaxCryptoKeyCacheLifetime,
}
// note: this module specifier comes from the import-map
//    in index.html; swap "src" for "dist" here to test
//    against the dist/* files
from "local-data-lock/src";


// ***********************

var passkeyKeepAliveEl;
var setPasskeyKeepAliveBtn;
var registerAccountBtn;
var detectAccountBtn;
var resetAllAccountsBtn;
var selectAccountEl;
var unlockAccountBtn;
var addPasskeyBtn;
var resetAccountBtn;
var lockAccountBtn;
var accountDataEl;
var saveDataBtn;

var currentAccountID;
var localAccountIDs = listLocalIdentities();

if (document.readyState == "loading") {
	document.addEventListener("DOMContentLoaded",ready,false);
}
else {
	ready();
}


// ***********************

async function ready() {
	passkeyKeepAliveEl = document.getElementById("passkey-keep-alive");
	setPasskeyKeepAliveBtn = document.getElementById("set-passkey-keep-alive-btn");
	registerAccountBtn = document.getElementById("register-account-btn");
	detectAccountBtn = document.getElementById("detect-account-btn");
	resetAllAccountsBtn = document.getElementById("reset-all-accounts-btn");
	selectAccountEl = document.getElementById("select-account");
	unlockAccountBtn = document.getElementById("unlock-account-btn");
	addPasskeyBtn = document.getElementById("add-passkey-btn");
	resetAccountBtn = document.getElementById("reset-account-btn");
	lockAccountBtn = document.getElementById("lock-account-btn");
	accountDataEl = document.getElementById("account-data");
	saveDataBtn = document.getElementById("save-data-btn");

	selectAccountEl.addEventListener("change",changeSelectedAccount,false);
	accountDataEl.addEventListener("input",onChangeAccountData,false);

	setPasskeyKeepAliveBtn.addEventListener("click",setKeepAlive,false);
	registerAccountBtn.addEventListener("click",registerAccount,false);
	detectAccountBtn.addEventListener("click",detectAccount,false);
	resetAllAccountsBtn.addEventListener("click",resetAllAccounts,false);
	unlockAccountBtn.addEventListener("click",unlockAccount,false);
	addPasskeyBtn.addEventListener("click",addPasskey,false);
	resetAccountBtn.addEventListener("click",resetAccount,false);
	lockAccountBtn.addEventListener("click",lockAccount,false);
	saveDataBtn.addEventListener("click",saveData,false);

	updateElements();
}

function updateElements() {
	selectAccountEl.disabled = (localAccountIDs.length == 0);
	selectAccountEl.options.length = 1;
	for (let localID of localAccountIDs) {
		let optionEl = document.createElement("option");
		optionEl.value = localID;
		optionEl.innerHTML = localID;
		selectAccountEl.appendChild(optionEl);
	}

	if (localAccountIDs.length > 0) {
		detectAccountBtn.disabled = false;
		resetAllAccountsBtn.disabled = false;
	}
	else {
		detectAccountBtn.disabled = true;
		resetAllAccountsBtn.disabled = true;
		unlockAccountBtn.disabled = true;
	}

	if (localAccountIDs.includes(currentAccountID)) {
		selectAccountEl.value = currentAccountID;
		addPasskeyBtn.disabled = false;
		resetAccountBtn.disabled = false;
		lockAccountBtn.disabled = false;
		accountDataEl.disabled = false;
	}
	else {
		addPasskeyBtn.disabled = true;
		resetAccountBtn.disabled = true;
		lockAccountBtn.disabled = true;
		accountDataEl.disabled = true;
		accountDataEl.value = "";
		selectAccountEl.selectedIndex = 0;
	}
}

function changeSelectedAccount() {
	if (selectAccountEl.selectedIndex > 0) {
		unlockAccountBtn.disabled = false;
	}
	else {
		unlockAccountBtn.disabled = true;
	}
}

function onChangeAccountData() {
	saveDataBtn.disabled = false;
}

async function setKeepAlive() {
	var keepAlive = Math.max(1,Number(passkeyKeepAliveEl.value != null ? passkeyKeepAliveEl.value : 30));
	passkeyKeepAliveEl.value = keepAlive;

	setMaxCryptoKeyCacheLifetime(keepAlive * 60 * 1000);
	showToast(`Passkey Keep-Alive set to ${keepAlive} minute(s)`);
}

async function promptAddPasskey() {
	var passkeyUsernameEl;
	var passkeyDisplayNameEl;

	var result = await Swal.fire({
		title: "Add Passkey",
		html: `
			<p>
				<label>
					Username:
					<input type="text" id="passkey-username" class="swal2-input">
				</label>
			</p>
			<p>
				<label>
					Display Name:
					<input type="text" id="passkey-display-name" class="swal2-input">
				</label>
			</p>
		`,
		showConfirmButton: true,
		confirmButtonText: "Add",
		confirmButtonColor: "darkslateblue",
		showCancelButton: true,
		cancelButtonColor: "darkslategray",

		allowOutsideClick: true,
		allowEscapeKey: true,

		didOpen(popupEl) {
			passkeyUsernameEl = document.getElementById("passkey-username");
			passkeyDisplayNameEl = document.getElementById("passkey-display-name");
			passkeyUsernameEl.focus();
			popupEl.addEventListener("keypress",onKeypress,true);
		},

		willClose(popupEl) {
			popupEl.removeEventListener("keypress",onKeypress,true);
			passkeyUsernameEl = passkeyDisplayNameEl = null;
		},

		async preConfirm() {
			var passkeyUsername = passkeyUsernameEl.value.trim();
			var passkeyDisplayName = passkeyDisplayNameEl.value.trim();

			if (!passkeyUsername) {
				Swal.showValidationMessage("Please enter a username.");
				return false;
			}
			if (!passkeyDisplayName) {
				Swal.showValidationMessage("Please enter a display name.");
				return false;
			}

			return { passkeyUsername, passkeyDisplayName, };
		},
	});

	if (result.isConfirmed) {
		return result.value;
	}


	// ***********************

	function onKeypress(evt) {
		if (
			evt.key == "Enter" &&
			evt.target.matches(".swal2-input, .swal2-select, .swal2-textarea")
		) {
			evt.preventDefault();
			evt.stopPropagation();
			evt.stopImmediatePropagation();
			Swal.clickConfirm();
		}
	}
}

async function registerAccount() {
	let { passkeyUsername: username, passkeyDisplayName: displayName, } = (await promptAddPasskey() || {});

	if (username != null && displayName != null) {
		try {
			let key = await getCryptoKey({
				addNewPasskey: true,
				username,
				displayName,
			});
			localAccountIDs = listLocalIdentities();
			if (!localAccountIDs.includes(key.localIdentity)) {
				throw new Error("No account found for selected passkey");
			}
			selectAccountEl.value = currentAccountID = key.localIdentity;
			unlockAccountData(currentAccountID,key);
			updateElements();
			changeSelectedAccount();
			showToast("Account (and passkey) registered.");
		}
		catch (err) {
			logError(err);
			showError("Registering account and passkey failed.");
		}
	}
}

async function detectAccount() {
	try {
		let key = await getCryptoKey();
		if (!localAccountIDs.includes(key.localIdentity)) {
			throw new Error("No account matching selected passkey");
		}
		selectAccountEl.value = currentAccountID = key.localIdentity;
		unlockAccountData(currentAccountID,key);
		updateElements();
		changeSelectedAccount();
		showToast("Account detected and unlocked via passkey.");
	}
	catch (err) {
		logError(err);
		showError("Detecting account via passkey authentication failed.");
	}
}

async function resetAllAccounts() {
	var confirmResult = await Swal.fire({
		text: "Resetting will remove all local account data and passkeys. Are you sure?",
		icon: "warning",
		showConfirmButton: true,
		confirmButtonText: "Yes, reset!",
		confirmButtonColor: "darkslateblue",
		showCancelButton: true,
		cancelButtonColor: "darkslategray",
		cancelButtonText: "No",
		allowOutsideClick: true,
		allowEscapeKey: true,
	});

	if (confirmResult.isConfirmed) {
		for (let accountID of localAccountIDs) {
			removeLocalAccount(accountID);
			window.localStorage.removeItem(`account-data-${accountID}`);
		}
		localAccountIDs.length = 0;
		updateElements();
		showToast("All local accounts removed.");
	}
}

async function unlockAccount() {
	if (selectAccountEl.selectedIndex > 0) {
		try {
			let key = await getCryptoKey({ localIdentity: selectAccountEl.value, });
			if (!localAccountIDs.includes(key.localIdentity)) {
				throw new Error("No account found for selected passkey");
			}
			selectAccountEl.value = currentAccountID = key.localIdentity;
			unlockAccountData(currentAccountID,key);
			updateElements();
			changeSelectedAccount();
			showToast("Account unlocked.");
		}
		catch (err) {
			logError(err);
			showError("Unlocking account via passkey failed.");
		}
	}
}

async function addPasskey() {
	let { passkeyUsername: username, passkeyDisplayName: displayName, } = (await promptAddPasskey() || {});

	if (username != null && displayName != null) {
		try {
			await getCryptoKey({
				localIdentity: currentAccountID,
				addNewPasskey: true,
				username,
				displayName,
			});
			showToast("Additional passkey added.");
		}
		catch (err) {
			logError(err);
			showError("Adding new passkey failed.");
		}
	}
}

async function resetAccount() {
	var confirmResult = await Swal.fire({
		text: "Resetting an account regenerates a new encryption/decryption key and a new passkey, while discarding previously associated passkeys. Are you sure?",
		icon: "warning",
		showConfirmButton: true,
		confirmButtonText: "Yes, reset!",
		confirmButtonColor: "darkslateblue",
		showCancelButton: true,
		cancelButtonColor: "darkslategray",
		cancelButtonText: "No",
		allowOutsideClick: true,
		allowEscapeKey: true,
	});

	if (confirmResult.isConfirmed) {
		let { passkeyUsername: username, passkeyDisplayName: displayName, } = (await promptAddPasskey() || {});

		if (username != null && displayName != null) {
			try {
				let key = await getCryptoKey({
					localIdentity: currentAccountID,
					resetCryptoKey: true,
					username,
					displayName,
				});
				if (!localAccountIDs.includes(key.localIdentity)) {
					throw new Error("No account found for selected passkey");
				}
				if (accountDataEl.value != "") {
					lockAccountData(currentAccountID,key,accountDataEl.value);
				}
				else {
					storeAccountData(currentAccountID,"");
				}
				showToast("Account cryptographic key reset (and previous passkeys discarded).");
			}
			catch (err) {
				logError(err);
				showError("Resetting account failed.");
			}
		}
	}
}

async function lockAccount() {
	clearCryptoKeyCache(currentAccountID);
	currentAccountID = null;
	selectAccountEl.selectedIndex = 0;
	changeSelectedAccount();
	updateElements();
	showToast("Account locked.");
}

async function saveData() {
	try {
		let key = await getCryptoKey({ localIdentity: currentAccountID, });
		if (accountDataEl.value != "") {
			lockAccountData(currentAccountID,key,accountDataEl.value);
		}
		else {
			storeAccountData(currentAccountID,"");
		}
		saveDataBtn.disabled = true;
		showToast("Data encrypted and saved.");
	}
	catch (err) {
		logError(err);
		showError("Saving (encrypted!) data to account failed.");
	}
}

function unlockAccountData(accountID,key) {
	var data = loadAccountData(accountID);
	if (typeof data == "string") {
		if (data != "") {
			let text = unlockData(data,key,{ parseJSON: false, });
			accountDataEl.value = text;
		}
		else {
			accountDataEl.value = "";
		}
	}
	else {
		accountDataEl.value = "";
	}
}

function lockAccountData(accountID,key,data) {
	storeAccountData(accountID,lockData(data,key));
}

function loadAccountData(accountID) {
	var data = window.localStorage.getItem(`account-data-${accountID}`);
	if (typeof data == "string") {
		return data;
	}
}

function storeAccountData(accountID,data) {
	window.localStorage.setItem(`account-data-${accountID}`,data);
}

function logError(err,returnLog = false) {
	var err = `${
			err.stack ? err.stack : err.toString()
		}${
			err.cause ? `\n${logError(err.cause,/*returnLog=*/true)}` : ""
	}`;
	if (returnLog) return err;
	else console.error(err);
}

function showError(errMsg) {
	return Swal.fire({
		title: "Error!",
		text: errMsg,
		icon: "error",
		confirmButtonText: "ok",
	});
}

function showToast(toastMsg) {
	return Swal.fire({
		text: toastMsg,
		showConfirmButton: false,
		showCloseButton: true,
		timer: 5000,
		toast: true,
		position: "top-end",
		customClass: {
			popup: "toast-popup",
		},
	});
}
