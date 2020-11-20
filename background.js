var re = /dashboard(?:\/dashboard)?;/;
function hashListener(details) {
    var refIndex = details.url.indexOf('#');
    var ref = refIndex >= 0 ? details.url.slice(refIndex + 1) : '';
    if (re.test(ref)) {
        chrome.pageAction.show(details.tabId, () => {
            if (chrome.runtime.lastError) { //Tab no longer exists
                console.log(chrome.runtime.lastError.message);
            } else {// Tab exists
                let version = getVersion();
                getAckedVersion((ackedVersion) => {
                    if (!ackedVersion) chrome.pageAction.setIcon({ tabId: details.tabId, path: "Assets/powerup_purple.png" });
                    ackedVersion = Number((ackedVersion || "0.0").split('.')[1]);
                    version = Number((version || "0.0").split('.')[1]);
                    if (ackedVersion === version)
                        chrome.pageAction.setIcon({ tabId: details.tabId, path: "Assets/powerup.png" });
                    else
                        chrome.pageAction.setIcon({ tabId: details.tabId, path: "Assets/powerup_purple.png" });
                });
                listenForBeaconMessages();

                chrome.tabs.executeScript(details.tabId, { file: '3rdParty/jquery-3.5.1.min.js', runAt: "document_end" });
                chrome.tabs.executeScript(details.tabId, { file: '3rdParty/node_modules/uuid/dist/umd/uuidv4.min.js', runAt: "document_end" });
                chrome.tabs.executeScript(details.tabId, { file: 'extside.min.js', runAt: "document_end" });
            }
        });

    } else {
        chrome.pageAction.hide(details.tabId, () => {
            if (chrome.runtime.lastError) { //Tab no longer exists
                console.log(chrome.runtime.lastError.message);
            } else {// Tab exists
                chrome.pageAction.setIcon({ tabId: details.tabId, path: "Assets/powerup_gray.png" });
            }
        });

    }
}

function getVersion() {
    var manifestData = chrome.runtime.getManifest();
    return manifestData.version;
}

function getAckedVersion(callback) {
    chrome.storage.local.get(['Powerups'], function (result) {
        //console.log('Powerup: (popup) config from storage is: ' + JSON.stringify(result));
        if (result && result.Powerups && result.Powerups.ackedVersion) {
            callback(result.Powerups.ackedVersion);
        } else {
            callback(undefined);
        }
    });
}

// Base filter
var filter = {
    url: [{
        urlMatches: '(?:\/e\/)|(?:dynatracelabs.com)|(?:live.dynatrace.com)'
    }]
};

const OPENKIT_URL = 'https://bf49960xxn.bf-sprint.dynatracelabs.com/mbeacon';
const OPENKIT_APPID = '9a51173a-1898-45ef-94dd-4fea40538ef4';
var openKit, openKitSession, openKitAction;

function listenForBeaconMessages() {
    if (typeof (BEACON_LISTENING) == "undefined") {
        chrome.runtime.onMessage.addListener(
            function (request, sender, sendResponse) {
                console.log(sender.tab ?
                    "from a content script:" + sender.tab.url :
                    "from the extension");
                switch (request.OpenKit) {
                    case "start_beacon":
                        startBeacon(request);
                        sendResponse({ beacon_status: "sent" });
                        break;
                    case "end_beacon":
                        endBeacon(request);
                        sendResponse({ beacon_status: "done" });
                        break;
                }
                return true;
            });
        console.log("POWERUP: message listener loaded.");
        BEACON_LISTENING = true;
    }
}

function startBeacon(request) {
    if (typeof (OpenKitBuilder) === "undefined") return false;
    if (request.beaconOptOut) return false;

    console.log("POWERUP: DEBUG - OpenKit start beacon");
    openKit = new OpenKitBuilder(OPENKIT_URL, OPENKIT_APPID, request.uuid)
        .withApplicationVersion(request.applicationVersion)
        .withOperatingSystem(request.operatingSystem)
        .withManufacturer(request.manufacturer)
        .withModelId(request.modelId)
        .withScreenResolution(request.screenResolution[0], request.screenResolution[1])
        .build();
    if (openKit) {
        openKitSession = openKit.createSession();
        if (openKitSession) {
            openKitSession.identifyUser(request.name);
            openKitAction = openKitSession.enterAction(request.action);
            if (openKitAction) {
                Object.keys(request.vals).forEach(x => {
                    openKitAction.reportValue(x, request.vals[x]);
                });
            }
        }
    }
}

function endBeacon(request) {
    if (typeof (OpenKitBuilder) === "undefined" || !openKit) return false;
    console.log("POWERUP: DEBUG - OpenKit end beacon");
    if (openKitAction) {
        Object.keys(request.vals).forEach(x => {
            openKitAction.reportValue(x, request.vals[x]);
        });
        powerupsFired = {};
        openKitAction.leaveAction();
    }
    if (openKitSession) openKitSession.end();
    if (openKit) openKit.shutdown();
}

// Main
chrome.webNavigation.onCommitted.addListener(hashListener, filter);
chrome.webNavigation.onHistoryStateUpdated.addListener(hashListener, filter);
chrome.webNavigation.onReferenceFragmentUpdated.addListener(hashListener, filter)