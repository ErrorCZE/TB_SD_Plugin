var websocket = null;
var pluginUUID = null;
let intervalId = null;

let traderRestockData;
let traderRestockData_PVE;

var DestinationEnum = Object.freeze({ "HARDWARE_AND_SOFTWARE": 0, "HARDWARE_ONLY": 1, "SOFTWARE_ONLY": 2 })

function getTimeAgoString(timeDifference) {
    var seconds = Math.floor(timeDifference / 1000);
    var minutes = Math.floor(seconds / 60);
    var hours = Math.floor(minutes / 60);

    var timeAgo = "";

    if (hours > 0) {
        timeAgo += hours + "h ";
        minutes = minutes % 60;
    }
    if (minutes > 0 || timeAgo !== "") {
        timeAgo += minutes + "m ";
        seconds = seconds % 60;
    }
    if (seconds > 0 || timeAgo === "") {
        timeAgo += seconds + "s";
    }

    return timeAgo;
}


function updateTraderData() {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "https://tarkovbot.eu/api/trader-resets/", true);
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                var response = JSON.parse(xhr.responseText);
                traderRestockData = response.data.traders;
            }
        }
    };
    xhr.send();
}

updateTraderData();
setInterval(updateTraderData, 5 * 60 * 1000);


function updateTraderData_PVE() {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "https://tarkovbot.eu/api/pve/trader-resets/", true);
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                var response = JSON.parse(xhr.responseText);
                traderRestockData_PVE = response.data.traders;
            }
        }
    };
    xhr.send();
}

updateTraderData_PVE();
setInterval(updateTraderData_PVE, 5 * 55 * 1000);


var goonsTrackerAction = {

    type: "eu.tarkovbot.tools.goonsgetlocation",


    onKeyDown: function (context, settings, coordinates, userDesiredState) {

        var token = "";
        if (settings != null && settings.hasOwnProperty('token') && settings["token"] !== '') {
            goonsTrackerAction.SetTitle(context, "Loading");
            token = settings["token"];
            let source = settings["selectedGoonsSource"];

            var xhr = new XMLHttpRequest();
            xhr.open("GET", "https://tarkovbot.eu/api/streamdeck/goonslocation", true);
            xhr.setRequestHeader("AUTH-TOKEN", token);
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        if (source === "PVE") {
                            var response = JSON.parse(xhr.responseText);
                            var location = response.pve.location;
                            var reportedTime = new Date(response.pve.reported);
                            var timeDifference = Date.now() - reportedTime;
                            var timeAgo = getTimeAgoString(timeDifference);
                            goonsTrackerAction.SetTitle(context, location + "\n" + timeAgo); 
                        } else if (source === "PVP") {
                            var response = JSON.parse(xhr.responseText);
                            var location = response.pvp.location;
                            var reportedTime = new Date(response.pvp.reported);
                            var timeDifference = Date.now() - reportedTime;
                            var timeAgo = getTimeAgoString(timeDifference);
                            goonsTrackerAction.SetTitle(context, location + "\n" + timeAgo);
                        } else {
                            var response = JSON.parse(xhr.responseText);
                            var location = response.location;
                            var reportedTime = new Date(response.reported);
                            var timeDifference = Date.now() - reportedTime;
                            var timeAgo = getTimeAgoString(timeDifference);

                            goonsTrackerAction.SetTitle(context, location + "\n" + timeAgo);
                        }
                    }
                    else if (xhr.status === 401) {
                        goonsTrackerAction.SetTitle(context, "Invalid\nToken");
                    }
                    else {
                        goonsTrackerAction.SetTitle(context, "Error");
                    }
                }
            };
            xhr.send();

        } else {
            goonsTrackerAction.SetTitle(context, "Invalid\nToken");
        }
    },

    onWillAppear: function (context, settings, coordinates) {
        this.SetTitle(context, "Press to\nGet\nLocation");
    },

    SetTitle: function (context, goonsLocation) {
        var json = {
            "event": "setTitle",
            "context": context,
            "payload": {
                "title": "" + goonsLocation,
                "target": DestinationEnum.HARDWARE_AND_SOFTWARE,
                "state": 2
            }
        };

        websocket.send(JSON.stringify(json));
    }
};



var tarkovTimeAction = {

    type: "eu.tarkovbot.tools.tarkovtime",

    onWillAppear: function (context, settings, coordinates) {
        this.SetTitle(context, "Loading");

        function calculateTarkovTime() {
            const currentDateTime = new Date();
            const multiplier = 7;

            const tarkovTimeLeft = new Date(currentDateTime.getTime() * multiplier).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Moscow' });
            const tarkovTimeRight = new Date(currentDateTime.getTime() * multiplier - 43200000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Moscow' });

            tarkovTimeAction.SetTitle(context, tarkovTimeLeft + "\n" + tarkovTimeRight);
        }

        calculateTarkovTime();

        if (intervalId !== null) {
            clearInterval(intervalId);
        }

        intervalId = setInterval(calculateTarkovTime, 2000);


    },


    SetTitle: function (context, currentTime) {
        var json = {
            "event": "setTitle",
            "context": context,
            "payload": {
                "title": "" + currentTime,
                "target": DestinationEnum.HARDWARE_AND_SOFTWARE,
                "state": 2
            }
        };

        websocket.send(JSON.stringify(json));
    }
};

var traderrestockAction = {
    type: "eu.tarkovbot.tools.traderrestock",
    intervalIds: {},

    updateTitleAndImage: function (context, restockData) {
        if (!restockData) {
            this.SetTitle(context, "No Data");
            this.SetImage(context, ``);
            return;
        }

        const resetTime = new Date(restockData.resetTime);
        const currentTime = new Date();
        const timeDifference = resetTime.getTime() - currentTime.getTime();

        if (timeDifference > 0) {
            const hours = String(Math.floor(timeDifference / (1000 * 60 * 60))).padStart(1, '0');
            const minutes = String(Math.floor((timeDifference % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0');
            const seconds = String(Math.floor((timeDifference % (1000 * 60)) / 1000)).padStart(2, '0');
            this.SetTitle(context, `\n\n\n${hours}:${minutes}:${seconds}`);
        } else {
            this.SetTitle(context, `\n\n\nRestock`);
        }

        this.SetImage(context, `assets/${restockData.name}.png`);
    },

    startUpdating: function (context, settings, coordinates) {
        clearInterval(this.intervalIds[context]);
        this.intervalIds[context] = setInterval(() => {
            let trader = settings["selectedTrader"];
            let pveMODE = settings["pve_traders_mode_check"];

            if (trader) {
                let restockData = (pveMODE ? traderRestockData_PVE : traderRestockData).find(data => data.name === trader);
                this.updateTitleAndImage(context, restockData);
            }
            else {
                this.SetImage(context, ``);
                this.SetTitle(context, "Select\nTrader");
            }

        }, 1000);
    },

    stopUpdating: function (context) {
        clearInterval(this.intervalIds[context]);
    },

    onWillAppear: function (context, settings, coordinates) {
        this.SetTitle(context, "\n\n\nLoading");
        let trader = settings["selectedTrader"];

        if (trader) {
            this.startUpdating(context, settings, coordinates);
        } else {
            this.SetImage(context, ``);
            this.SetTitle(context, "Select\nTrader");
        }

    },

    onWillDisappear: function (context, settings, coordinates) {
        this.stopUpdating(context);
    },

    onDidReceiveSettings: function (context, settings, coordinates) {
        this.SetTitle(context, "\n\n\nLoading");
        let trader = settings["selectedTrader"];

        if (trader) {
            this.stopUpdating(context);
            this.startUpdating(context, settings, coordinates);
        } else {
            this.stopUpdating(context);
            this.SetImage(context, ``);
            this.SetTitle(context, "Select\nTrader");
        }

    },

    SetTitle: function (context, currentTime) {
        var json = {
            "event": "setTitle",
            "context": context,
            "payload": {
                "title": "" + currentTime,
                "target": DestinationEnum.HARDWARE_AND_SOFTWARE,
                "state": 2
            }
        };

        websocket.send(JSON.stringify(json));
    },

    SetImage: function (context, image) {
        var json = {
            "event": "setImage",
            "context": context,
            "payload": {
                "image": image,
                "target": DestinationEnum.HARDWARE_AND_SOFTWARE,
                "state": 2
            }
        };

        websocket.send(JSON.stringify(json));
    }
};







function connectElgatoStreamDeckSocket(inPort, inPluginUUID, inRegisterEvent, inInfo) {
    pluginUUID = inPluginUUID

    websocket = new WebSocket("ws://127.0.0.1:" + inPort);

    function registerPlugin(inPluginUUID) {
        var json = {
            "event": inRegisterEvent,
            "uuid": inPluginUUID
        };

        websocket.send(JSON.stringify(json));
    };

    websocket.onopen = function () {
        registerPlugin(pluginUUID);
    };

    websocket.onmessage = function (evt) {
        var jsonObj = JSON.parse(evt.data);

        var event = jsonObj['event'];
        var action = jsonObj['action'];
        var context = jsonObj['context'];

        if (event == "keyDown") {
            var jsonPayload = jsonObj['payload'];
            var settings = jsonPayload['settings'];
            var coordinates = jsonPayload['coordinates'];
            var userDesiredState = jsonPayload['userDesiredState'];

            if (jsonObj['action'] === "eu.tarkovbot.tools.tarkovtime") {
                tarkovTimeAction.onKeyDown(context, settings, coordinates, userDesiredState);
            } else if (jsonObj['action'] === "eu.tarkovbot.tools.goonsgetlocation") {
                goonsTrackerAction.onKeyDown(context, settings, coordinates, userDesiredState);
            } else if (jsonObj['action'] === "eu.tarkovbot.tools.traderrestock") {
                traderrestockAction.onKeyDown(context, settings, coordinates, userDesiredState);
            }
        } else if (event == "keyUp") {
            var jsonPayload = jsonObj['payload'];
            var settings = jsonPayload['settings'];
            var coordinates = jsonPayload['coordinates'];
            var userDesiredState = jsonPayload['userDesiredState'];

            if (jsonObj['action'] === "eu.tarkovbot.tools.tarkovtime") {
                tarkovTimeAction.onKeyUp(context, settings, coordinates, userDesiredState);
            } else if (jsonObj['action'] === "eu.tarkovbot.tools.goonsgetlocation") {
                goonsTrackerAction.onKeyUp(context, settings, coordinates, userDesiredState);
            }
        } else if (event == "willAppear") {
            var jsonPayload = jsonObj['payload'];
            var settings = jsonPayload['settings'];
            var coordinates = jsonPayload['coordinates'];

            if (jsonObj['action'] === "eu.tarkovbot.tools.tarkovtime") {
                tarkovTimeAction.onWillAppear(context, settings, coordinates);
            } else if (jsonObj['action'] === "eu.tarkovbot.tools.goonsgetlocation") {
                goonsTrackerAction.onWillAppear(context, settings, coordinates);
            } else if (jsonObj['action'] === "eu.tarkovbot.tools.traderrestock") {
                traderrestockAction.onWillAppear(context, settings, coordinates);
            }
        } else if (event == "didReceiveSettings") {
            var jsonPayload = jsonObj['payload'];
            var settings = jsonPayload['settings'];
            var coordinates = jsonPayload['coordinates'];


            if (jsonObj['action'] === "eu.tarkovbot.tools.traderrestock") {
                traderrestockAction.onDidReceiveSettings(context, settings, coordinates);
            }
        } else if (event == "willDisappear") {
            var jsonPayload = jsonObj['payload'];
            var settings = jsonPayload['settings'];
            var coordinates = jsonPayload['coordinates'];

            if (jsonObj['action'] === "eu.tarkovbot.tools.traderrestock") {
                traderrestockAction.onWillDisappear(context, settings, coordinates);
            }
        }
    }

    websocket.onclose = function () {
    };
};
