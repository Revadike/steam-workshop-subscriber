var fs = require("fs"),
SteamCommunity = require("steamcommunity");
const community = new SteamCommunity();
const config = JSON.parse(fs.readFileSync("config.json"));

var log = console.log;
console.log = function() {
    var first_parameter = arguments[0];
    var other_parameters = Array.prototype.slice.call(arguments, 1);
    function formatConsoleDate(date) {
        var day = date.getDate();
        var month = date.getMonth() + 1;
        var year = date.getFullYear();
        var hour = date.getHours();
        var minutes = date.getMinutes();
        var seconds = date.getSeconds();
        var milliseconds = date.getMilliseconds();
        return "[" + ((day < 10) ? "0" + day : day) +
        "-" + ((month < 10) ? "0" + month : month) +
        "-" + ((year < 10) ? "0" + year : year) +
        " " + ((hour < 10) ? "0" + hour : hour) +
        ":" + ((minutes < 10) ? "0" + minutes : minutes) +
        ":" + ((seconds < 10) ? "0" + seconds : seconds) +
        "." + ("00" + milliseconds).slice(-3) + "] ";
    }
    log.apply(console, [formatConsoleDate(new Date()) + first_parameter].concat(other_parameters));
}

console.log("Initializing...");
if (config.winauth_usage) {
    var SteamAuth = require("steamauth");
    SteamAuth.Sync(function(error) {
        var auth = new SteamAuth(config.winauth_data);
        auth.once("ready", function() {
            config.steam_credentials.authCode = config.steam_credentials.twoFactorCode = auth.calculateCode();
            steamLogin();
        });
    });
} else {
    steamLogin();
}

function steamLogin() {
    community.login(config.steam_credentials, function(err, sessionID, cookies) {
		if (err) {
			if (err.message == 'SteamGuardMobile') {
				console.log("This account already has two-factor authentication enabled");
				return;
			}
			if (err.message == 'SteamGuard') {
				console.log("An email has been sent to your address at " + err.emaildomain);
				process.exit();
				return;
			}
			if (err.message == 'CAPTCHA') {
				console.log(err.captchaurl);
				process.exit();
				return;
			}
			console.log(err);
			process.exit();
			return;
		}

		console.log("Logged in to Steam Community");
        community.httpRequestGet("http://steamcommunity.com/workshop/browse/?appid=" + config.appid + config.filters + "&p=1&l=english", {
            followAllRedirects: true
        }, function(error, response, data) {
            if (error) {
                console.log(error);
            } else {
                const pageinfo = data.match(/Showing [0-9\-]+ of [0-9,]+ entries/ig)[0];
                const perpage = parseInt(pageinfo.split("-")[1].split(" ")[0]);
                const total = parseInt(pageinfo.split(" ")[3].replace(",", ""));
                const pages = Math.ceil(total / perpage);
                var done = 1;
                var wids = [];
                [...new Set(data.match(/sharedfile_[0-9]+/g))].forEach(function(wid) {
                    wids.push(parseInt(wid.replace("sharedfile_", "")));
                });
                for (var p = 2; p <= pages; p++) {
                    let page = p;
                    setTimeout(function() {
                        community.httpRequestGet("http://steamcommunity.com/workshop/browse/?appid=" + config.appid + config.filters + "&p=" + page, {
                            followAllRedirects: true
                        }, function(error, response, data) {
                            if (error) {
                                console.log(error);
                            } else {
                                [...new Set(data.match(/sharedfile_[0-9]+/g))].forEach(function(wid) {
                                    wids.push(parseInt(wid.replace("sharedfile_", "")));
                                });                                
                            }
                            done++;
                            console.log("Visited page " + page + "/" + pages);
                            if (done >= pages) {
                                done = 0;
                                wids.forEach(function(w) {
                                    let wid = w;
                                    let formdata = {
                                        id: wid,
                                        appid: config.appid,
                                        sessionid: sessionID
                                    }
                                    setTimeout(function() {
                                        community.httpRequestPost("http://steamcommunity.com/sharedfiles/subscribe", {
                                            formData: formdata,
                                            followAllRedirects: true
                                        }, function(error, response, data) {
                                            if (error) {
                                                console.log(error);
                                            }
                                            done++;
                                            console.log("Subscribed to " + done + "/" + wids.length);
                                            if (done >= wids.length) {
                                                console.log("ALL DONE!")
                                            }
                                        });
                                    }, 0);
                                });
                            }
                        });
                    }, 0);
                }
            }            
        });
    });
}
