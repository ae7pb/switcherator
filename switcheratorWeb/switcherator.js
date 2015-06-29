/*
 * 
 * SwitcheratorWeb
 * copyright 2015 David Whipple
 * Creative Commons Attribution
 */




/*
 * Global variables.  Yeah yeah I know whatever.
 */
var radioSettings;
var radioSwitches;
var radioPrograms;
var radioInputs;
var radioColors;
var radioTimeLimits;
var ports = ["PORTA", "PORTB", "PORTC", "PORTD", "PORTE", "PORTF", "PORTG"];
var resetOnClick = 0;
var debugMePlease = 1;

/*
 * Get all the radios in the database first thing.
 */
$(document).ready(function () {
    $.get("ajax.php",
        {function: "getRadios"},
        function (response) {
            radioDivs(response)
        },
        "json");
    navigationBar(null);

});

$(document).on('click', function () {
    if (resetOnClick == 1)
    resetOnClick = 2;
    else if (resetOnClick == 2) {
        resetOnClick = 0;
        $("#messageBar").hide();
        $("#errorBar").hide();
        //        $("#detailEditDiv").remove();
        $("#debugSection").hide();
    }
});

// templates files
$.get("templatesBox.html", function (templates) {
    $("body").append(templates);
});
$.get("templatesForms.html", function (templates) {
    $("body").append(templates);
});
$.get("nonTemplateI18n.html", function (templates) {
    $("body").append(templates);
});


/*
 * 
 * Shows the navigation bar
 */
function navigationBar(radioText) {


}

/*
 * Populate the existing radioDiv element with a new box for each radio
 */
function radioDivs(response) {
    if (response == null)
        return;
    $("#radioList").html("");
    response.forEach(function (radio) {
        var output = radio.name;
        var radioNum = radio.id;
        var radioListings = [
    {radioNum: radioNum, output: output}
    ];
    var htmlOutput = templateRender("#radioListTemplate", radioListings);
    $("#radioList").append(htmlOutput);
    })
}
/*
 * Get the details of a certain radio
 */
function getRadioDetails(radioNum, updateMe) {
    if ($("#backToRadioList").is(":visible") && updateMe !== 1)
        return;
    $("#radioList").children('div').each(function () {
        $(this).hide();
    })
    $("#detailEditDiv").remove();
    $("#radio-" + radioNum).show();
    $("#backToRadioList").show();
    $("#pleaseWaitRadio").show();
    $.get("ajax.php"
            , {function: "radioDetails",
                radioID: radioNum}
                , function (response) {
                    showRadioDetails(response)
                }
                , "json"
         );

}

/*
 * Hide all the details and show all the radios
 */
function goBackToRadioList() {
    // want ajax to complete before we hide it so it doesn't get shown later
    if ($("#pleaseWaitRadio").is(":visible"))
        return;
    $("#backToRadioList").hide();
    $("#pleaseWaitRadio").hide();
    $("#detailEditDiv").remove();
    $(".detailField").remove()
        $("#radioList").children('div').each(function () {
            $(this).show();
        })
}


/*
 * Get the details of a single radio.  Draw up all the edit stuff
 */
function showRadioDetails(response) {
    $("#pleaseWaitRadio").hide();
    if (response.fail !== null)
        $("#radioDetails").text(response.fail);
    $("#detailEditDiv").remove();
    // fill in the global variables
    radioSettings = response.radio;
    radioSwitches = response.switches;
    radioPrograms = response.programs;
    radioInputs = response.inputs;
    radioColors = response.colors;
    radioTimeLimits = response.timeLimits;
    var htmlOutput = "";
    var showMe = "";
    // we will be re-running this later so figure out what is already open and arrange
    // for it to open back up
    if ($("#radioSettings").data("hide") == "shown") {
        showMe = viewRadioSettings;
    } else if ($("#radioSwitches").data("hide") == "shown") {
        showMe = viewRadioSwitches;
    } else if ($("#radioPrograms").data("hide") == "shown") {
        showMe = viewRadioPrograms;
    } else if ($("#radioInputs").data("hide") == "shown") {
        showMe = viewRadioInputs;
    } else if ($("#radioColors").data("hide") == "shown") {
        showMe = viewRadioColors;
    } else if ($("#radioTimeLimits").data("hide") == "shown") {
        showMe = viewRadioTimeLimits;
    }


    data = [
    {radioID: radioSettings.radioID, }
    ];
    $("#radioRefresh").html("");
    htmlOutput = templateRender("#radioUpdateTemplate", data);
    $("#radioRefresh").append(htmlOutput);

    /*
     * Radio settings boxes
     */


    var clockTweak = parseInt(radioSettings.clockTweak, 16);
    clockTweak = clockTweak.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    var colorChangeSpeed = parseInt(radioSettings.colorChangeSpeed, 16);
    var hueSpeed = parseInt(radioSettings.hueSpeed, 16);
    // Input message timing - When an input is triggered and we send a message the input message timing is
    // how long we wait before we send the next message
    var inputTiming = parseInt(radioSettings.inputMessageTiming, 16);
    var data = [
    {clockTweak: clockTweak,
        colorChangeSpeed: colorChangeSpeed,
        hueSpeed: hueSpeed,
        inputTiming: inputTiming
    }
    ]
        $("#radioSettings").html("");
    htmlOutput = templateRender("#radioViewSettingsTemplate", radioSettings);
    $("#radioSettings").append(htmlOutput);
    htmlOutput = templateRender("#radioOtherSettingsTemplate", data);
    $("#radioSettings").append(htmlOutput);



    /*
     * Radio switches boxes
     */
    var port, getPin, pin, hiLo, switchMessage, switchStuff, colorNum, red, green, blue, switchColor, textColor, switchString;
    var switchArray = [];
    radioSwitches.forEach(function (thisSwitch) {
        switchStuff = parseInt(thisSwitch.switchStuff, 10);
        switchString = thisSwitch.switchStuff;
        // switch stuff is a complicated but compact port / pin switch thingie. Need to decode it
        if (switchStuff >= 200) {
            if (switchStuff == 200) {
                // 200 = single color pwm
                textColor = "black";
                colorNum = parseInt(thisSwitch.switchPWM, 10);
                if (radioColors[colorNum] != null) {
                    red = parseInt(radioColors[colorNum]["red"]);
                    green = parseInt(radioColors[colorNum]["green"]);
                    blue = parseInt(radioColors[colorNum]["blue"]);
                    if (red < 75 || green < 75 || blue < 75)
        textColor = "white";
    switchColor = "#" + ("0" + red.toString(16)).substr(-2) + ("0" + green.toString(16)).substr(-2) +
        ("0" + blue.toString(16)).substr(-2);
                } else {
                    switchColor = wordsToTranslate.noColorSet;
                }
                switchArray.push({colorNum: colorNum, switchID: thisSwitch.id, switchNumber: thisSwitch.switchNumber,
                    switchPWM: thisSwitch.switchPWM, switchColor: switchColor, textColor: textColor, switchType: switchString});
            } else {
                switchArray.push({switchType: switchString, switchID: thisSwitch.id, switchNumber: thisSwitch.switchNumber});
            }
        } else {
            port = ports[(Math.floor(thisSwitch.switchStuff / 16))];
            getPin = thisSwitch.switchStuff % 16;
            pin = Math.floor(getPin / 2);
            if (getPin % 2 == 0) {
                hiLo = 0;
            } else {
                hiLo = 1;
            }
            switchArray.push({switchType: switchString, switchID: thisSwitch.id, switchNumber: thisSwitch.switchNumber,
                hiLo: hiLo, port: port, pin: pin});
        }


    });
    $("#radioSwitches").html("");
    htmlOutput = templateRender("#radioViewSwitchesTemplate", "");
    $("#radioSwitches").append(htmlOutput);
    htmlOutput = templateRender("#radioViewSwitchTemplate", switchArray);
    $("#radioSwitches").append(htmlOutput);


    /*
     * Radio programs boxes
     */

    var programDays, dayInt, programStart, hour, minute, programDuration, switchArray, programSwitches;
    var Sun, Mon, Tue, Wed, Thu, Fri, Sat, overflow;
    var programArray = [];
    radioPrograms.forEach(function (thisProgram) {
        // programNumber, days (0b01111111 = sun-sat), time (seconds from midnight), duration(seconds), 
        // switches(ff=blank), rollover(next program that houses more switches)
        dayInt = parseInt(thisProgram.days, 10);
        if (dayInt & 0x40)
        Sun = 1;
        else
        Sun = 0;
    if (dayInt & 0x20)
        Mon = 1;
    else
        Mon = 0;
    if (dayInt & 0x10)
        Tue = 1;
    else
        Tue = 0;
    if (dayInt & 0x08)
        Wed = 1;
    else
        Wed = 0;
    if (dayInt & 0x04)
        Thu = 1;
    else
        Thu = 0;
    if (dayInt & 0x02)
        Fri = 1;
    else
        Fri = 0;
    if (dayInt & 0x01)
        Sat = 1;
    else
        Sat = 0;
    hour = Math.floor((parseInt(thisProgram.time)) / 60);
    minute = (parseInt(thisProgram.time)) % 60;
    var ampm = "AM";
    if (hour > 12) {
        ampm = "PM";
        hour -= 12;
    }
    programStart = hour.toString(10) + ":" + (("0" + minute.toString(10)).substr(-2))+ " " + ampm;
    programDuration = (Math.floor((parseInt(thisProgram.duration)) / 60)).toString(10);
    programSwitches = "";
    switchArray = [];
    switchArray = getOverflowSwitches(thisProgram.programNumber, switchArray);
    for(var x = 0; x < switchArray.length; x++) {
        if(x > 0)
            programSwitches += ", ";
        programSwitches += (parseInt(switchArray[x])).toString(10);
    }

    // see if this is an overflow program
    if(parseInt(thisProgram.time) == 0xFEFF) {
        return;
        programStart = wordsToTranslate.overflow;
        programDuration = wordsToTranslate.overflow;
        Sun = Mon = Tue = Wed = Thu = Fri = Sat = "";
    }
    programArray.push({
        id: thisProgram.id,
        programNumber: thisProgram.programNumber,
        programStart: programStart,
        programDuration: programDuration,
        Sun: Sun,
        Mon: Mon,
        Tue: Tue,
        Wed: Wed,
        Thu: Thu,
        Fri: Fri,
        Sat: Sat,
        dayInt: dayInt,
        programSwitches: programSwitches,
        overflow: overflow,
    });

    });
    $("#radioPrograms").html("");
    htmlOutput = templateRender("#radioViewProgramsTemplate", "");
    $("#radioPrograms").append(htmlOutput);
    htmlOutput = templateRender("#radioViewProgramTemplate", programArray);
    $("#radioPrograms").append(htmlOutput);

    /*
     * Radio inputs boxes
     */


    // input information (from switcherator.c)
    // Pp - value of 255 (default) means nothing programmed
    // value of 0-15 = PORTA, 16-31 = PORTB, 32-47 = PORTC, 
    // 48-63 = PORTD, 64-79 = PORTE, 80-95 = PORTF, 96-112 = PORTG
    // pin is abs(value/2)-the base - PINB3 = (22-16)/2  PINB3 (22-16)%2 = 0 - low (23-16)%2 = 1 - high
    // pLHsDDPw Pp int pin/port like sw, L%,H% (0,255 - digital), s - 0-127=switch, 128-255 = prog
    // dur in seconds, poll time in secs or  0 for continuous. w = which rgb (mask);)

    var inputPinStuff, inputLow, inputHigh, inputType, inputValues, inputSwitchOrProgram, inputPollTime, inputWhichRGB,
        port, pin, getPin, portPin, switchOrProgText, switchNum;
    var inputArray = [];
    radioInputs.forEach(function (thisInput) {
        inputPinStuff = parseInt(thisInput.pinStuff, 10);
        // low threshhold that must be met to start switch (analog)
        inputLow = parseInt(thisInput.lowPercent, 10);
        // high threshhold - max analog can be or 255 for digital switch
        inputHigh = parseInt(thisInput.highPercent, 10);
        // 0-127 = switch, 128-255 = program
        if (inputHigh == 255 || inputLow == 255) {
            inputType = 1;
            if (inputHigh == 255)
        inputValues = 1;
            else
        inputValues = 0;
        } else {
            inputType = 0;
            inputValues = (Math.floor(inputHigh * 100 / 254)).toString(10) + "%-" +
        (Math.floor(inputLow * 100 / 254)).toString(10) + "%";
        }
        inputSwitchOrProgram = parseInt(thisInput.whichSwitchOrProgram, 10);
        if (inputSwitchOrProgram > 127) {
            switchNum = inputSwitchOrProgram - 128;
            switchOrProg = 1;
        } else {
            switchNum = inputSwitchOrProgram;
            switchOrProg = 0;
        }
        // 0 = every 1/10 second or >0 is num seconds
        inputPollTime = parseInt(thisInput.pollTime);
        //todo deal with whichRGB. Basically it can be an adjustment knob for each color
        inputWhichRGB = parseInt(thisInput.whichRGB);
        port = Math.floor(inputPinStuff / 16);
        getPin = inputPinStuff % 16;
        pin = Math.floor(getPin / 2);
        portPin = ports[port] + pin.toString(10);
        inputArray.push({
            id: thisInput.inputNumber,
            inputType: inputType,
            inputNumber: thisInput.inputNumber,
            portPin: portPin,
            inputValues: inputValues,
            switchOrProgram: switchOrProg,
            switchNum: switchNum,
            duration: thisInput.duration,
            pollTime: thisInput.pollTime,
        });
    });

    $("#radioInputs").html("");
    htmlOutput = templateRender("#radioViewInputsTemplate", "");
    $("#radioInputs").append(htmlOutput);
    htmlOutput = templateRender("#radioViewInputTemplate", inputArray);
    $("#radioInputs").append(htmlOutput);
    /*
     * Radio colors boxes
     */


    var colorText, colorMessage, textColor;
    var colorArray = [];
    radioColors.forEach(function (thisColor) {
        red = parseInt(thisColor.red);
        green = parseInt(thisColor.green);
        blue = parseInt(thisColor.blue);
        textColor = "black";
        if (red < 75 || green < 75 || blue < 75)
        textColor = "white";
    colorText = ("0" + red.toString(16)).substr(-2) + ("0" + green.toString(16)).substr(-2) +
        ("0" + blue.toString(16)).substr(-2);
    colorArray.push({
        id: thisColor.id,
        colorChangeNumber: thisColor.colorChangeNumber,
        color: colorText,
        textColor: textColor,
        changeAble: thisColor.ifChangeable,
    })
    });
    $("#radioColors").html("");
    htmlOutput = templateRender("#radioViewColorsTemplate", "");
    $("#radioColors").append(htmlOutput);
    htmlOutput = templateRender("#radioViewColorTemplate", colorArray);
    $("#radioColors").append(htmlOutput);


    /*
     * Radio time limits boxes
     */

    var limitStart, limitStop, startMessage, stopMessage, limitDays;
    var timeLimitArray = [];
    radioTimeLimits.forEach(function (thisLimit) {
        limitStart = parseInt(thisLimit.startTime);
        limitStop = parseInt(thisLimit.stopTime);
        hour = Math.floor(limitStart / 60);
        minute = limitStart % 60;
        startMessage = hour.toString(10) + ":" + (("0" + minute.toString(10)).substr(-2));
        hour = Math.floor(limitStop / 60);
        minute = limitStop % 60;
        stopMessage = hour.toString(10) + ":" + (("0" + minute.toString(10)).substr(-2));
        dayInt = parseInt(thisLimit.days, 10);
        if (dayInt & 0x40)
        Sun = 1;
        else
        Sun = 0;
    if (dayInt & 0x20)
        Mon = 1;
    else
        Mon = 0;
    if (dayInt & 0x10)
        Tue = 1;
    else
        Tue = 0;
    if (dayInt & 0x08)
        Wed = 1;
    else
        Wed = 0;
    if (dayInt & 0x04)
        Thu = 1;
    else
        Thu = 0;
    if (dayInt & 0x02)
        Fri = 1;
    else
        Fri = 0;
    if (dayInt & 0x01)
        Sat = 1;
    else
        Sat = 0;
    timeLimitArray.push({
        id: thisLimit.id,
        limitNumber: thisLimit.limitNumber,
        startMessage: startMessage,
        stopMessage: stopMessage,
        Sun: Sun,
        Mon: Mon,
        Tue: Tue,
        Wed: Wed,
        Thu: Thu,
        Fri: Fri,
        Sat: Sat,
    })
    })
    $("#radioTimeLimits").html("");
    htmlOutput = templateRender("#radioViewTimeLimitsTemplate", "");
    $("#radioTimeLimits").append(htmlOutput);
    htmlOutput = templateRender("#radioViewTimeLimitTemplate", timeLimitArray);
    $("#radioTimeLimits").append(htmlOutput);

    // if we have maxed out on the switches then we need to hide the new switch form
    if (radioSwitches.length == radioSettings.switchCount) {
        $("#radioSwitches-n").hide();
    }


    $("#radioSettings").data("hide", "hidden");
    $("#radioSwitches").data("hide", "hidden");
    $("#radioPrograms").data("hide", "hidden");
    $("#radioInputs").data("hide", "hidden");
    $("#radioColors").data("hide", "hidden");
    $("#radioTimeLimits").data("hide", "hidden");
    $(".radioDetails").show();
    if (typeof (showMe) === "function") {
        showMe();
    }
}

/**********************************************************
 * 
 * Radio Settings Area
 * 
 **********************************************************/


/*
 * Shows the sub navigation for the radio settings
 */
function viewRadioSettings() {
    if ($("#radioSettings").data("hide") == "shown") {
        showHeaderSections();
        $("#detailEditDiv").remove();
        $(".radioSettingsSubChild").hide();
        $("#radioSettings").data("hide", "hidden");
        $("#radioSettingsMsg").text(wordsToTranslate.clickViewSettings);
    } else {
        hideHeaderSections();
        $("#radioSettings-0").show();
        $(".radioSettingsSubChild").show();
        $("#radioSettings").data("hide", "shown");
        $("#radioSettingsMsg").text(wordsToTranslate.clickHideSettings);
    }
}

// Change the name of the radio, edit the description and location.
function radioChangeName() {
    resetEdit();
    var changeNameArray = {
        topLeft: wordsToTranslate.radioName,
        topRight: "<input id=newRadioName value='" + radioSettings.name + "' onKeyDown=radioChangeNameSubmit(event) />",
        secondLeft: wordsToTranslate.Description,
        secondRight: "<textarea cols=21 rows=6 id=newRadioDescription >" + radioSettings.description + "</textarea>",
        thirdLeft: wordsToTranslate.Location,
        thirdRight: "<input id=newRadioLocation value='" + radioSettings.location + "' onKeyDown=radioChangeNameSubmit(event) />",
        bottomLeft: "&nbsp;",
        bottomRight: "<button onClick=radioChangeNameSubmit(event)>Submit</button>"
    };
    htmlOutput = templateRender("#twoByFour", changeNameArray);
    $("#individualDetailEdit").append(htmlOutput);
    $("#newRadioName").focus();
}



// for the life of me I couldn't get this to work so we'll go this route (key code)
function radioChangeNameSubmit(event) {
    if (event.keyCode != 13 && event.keyCode != 0)
        return;
    $.post("ajax.php?function=radioChangeName",
            {
                radioID: radioSettings.id,
        name: $("#newRadioName").val(),
        description: $("#newRadioDescription").val(),
        location: $("#newRadioLocation").val()
            }
            , function (data) {
                if (data == "ok") {
                    radioSettings.name = $("#newRadioName").val();
                    radioSettings.description = $("#newRadioDescription").val();
                    radioSettings.location = $("#newRadioLocation").val();
                    $("#radio-" + radioSettings.id).html(radioSettings.name);
                    $("#radioNameSpan").html(radioSettings.name);
                    showMessage(wordsToTranslate.nameChanged);
                } else {
                    showError(wordsToTranslate.nameChangeError);
                }
            },
            "text"
          ).error(function () {
              showError(wordsToTranslate.nameChangeError);
          });
            resetOnClick = 1;
}

function radioChangeTweak() {
    resetEdit();
    var changeTweakArray = {
        topMessage: wordsToTranslate.clockTweakMessage,
        topLeft: wordsToTranslate.tweakAdjust,
        topRight: "<input id=clockTweak value=0 onKeyDown=radioChangeTweakSubmit(event); />",
        bottomLeft: "&nbsp;",
        bottomRight: "<input type=button value=Submit onClick=radioChangeTweakSubmit(event) />"
    }
    htmlOutput = templateRender("#oneByTwoByTwo", changeTweakArray);
    $("#individualDetailEdit").append(htmlOutput);
    $("#clockTweak").focus();
}

// from readme
// CT:xxxx - sets amount to adjust the timer.  15625? is default
function radioChangeTweakSubmit(event) {
    if (event.keyCode != 13 && event.keyCode != null && event.keyCode != 0)
        return;
    var tweak = $("#clockTweak").val();
    // convert it to int and back to sanitize
    tweak = parseInt(tweak);
    tweak = tweak.toString(10);
    if (tweak == "NaN" || tweak > 9999 || tweak < -999) {
        showError(wordsToTranslate.changeError);
        if (debugMePlease == 1) {
            $("#debugSection").html(wordsToTranslate.invalidAmount);
            $("#debugSection").show();
        }
        resetOnClick = 1;
        return;
    }
    var radioCommand = "CT:" + tweak;
    radioID = radioSettings.id;
    postRadioCommand(radioCommand, radioID);
}




function radioChangeColorSpeed() {
    resetEdit();
    var renderObject = {
        topMessage: wordsToTranslate.colorChangeSpeedMessage,
        topLeft: wordsToTranslate.ccsInput,
        topRight: "<input id=ccSpeed value=" + parseInt(radioSettings.colorChangeSpeed, 16) + " onKeyDown=radioColorChangeSpeedSubmit(event); />",
        bottomLeft: "&nbsp;",
        bottomRight: "<input type=button value=Submit onClick=radioColorChangeSpeedSubmit(event) />"
    }
    htmlOutput = templateRender("#oneByTwoByTwo", renderObject);
    $("#individualDetailEdit").append(htmlOutput);
    $("#ccSpeed").focus();
}

function radioColorChangeSpeedSubmit(event) {
    if (event.keyCode != 13 && event.keyCode != null && event.keyCode != 0)
        return;
    var ccSpeed = $("#ccSpeed").val();
    ccSpeed = parseInt(ccSpeed);
    if (ccSpeed < 1 || ccSpeed > 9999) {
        showError(wordsToTranslate.changeError);
        $("#debugSection").html(wordsToTranslate.invalidAmount);
        $("#debugSection").show();
        resetOnClick = 1;
        return;
    }
    ccSpeed = ccSpeed.toString(16);
    var radioCommand = "CH:" + ccSpeed;
    radioID = radioSettings.id;
    postRadioCommand(radioCommand, radioID);
}


function radioChangeHueSpeed() {
    resetEdit();
    var renderObject = {
        topMessage: wordsToTranslate.hueSpeedMessage,
        topLeft: wordsToTranslate.hsInput,
        topRight: "<input id=hueSpeed value=" + parseInt(radioSettings.hueSpeed, 16) + " onKeyDown=radioColorHueSpeedSubmit(event); />",
        bottomLeft: "&nbsp;",
        bottomRight: "<input type=button value=Submit onClick=radioColorHueSpeedSubmit(event) />"
    }
    htmlOutput = templateRender("#oneByTwoByTwo", renderObject);
    $("#individualDetailEdit").append(htmlOutput);
    $("#hueSpeed").focus();
}

function radioColorHueSpeedSubmit(event) {
    if (event.keyCode != 13 && event.keyCode != 0 && event.keyCode != null)
        return;
    var hueSpeed = $("#hueSpeed").val();
    hueSpeed = parseInt(hueSpeed);
    if (hueSpeed < 1 || hueSpeed > 0xff) {
        showError(wordsToTranslate.changeError);
        $("#debugSection").html(wordsToTranslate.invalidAmount);
        $("#debugSection").show();
        resetOnClick = 1;
        return;
    }
    hueSpeed = hueSpeed.toString(16);
    var radioCommand = "HS:" + hueSpeed;
    radioID = radioSettings.id;
    postRadioCommand(radioCommand, radioID);
}


function radioChangeInputTiming() {
    resetEdit();
    var renderObject = {
        topMessage: wordsToTranslate.inputTimingMessage,
        topLeft: wordsToTranslate.itMessage,
        topRight: "<input id=inputTimingSpeed value=" + parseInt(radioSettings.inputMessageTiming, 16) +
            " onKeyDown=radioChangeInputTimingSubmit(event); />",
        bottomLeft: "&nbsp;",
        bottomRight: "<input type=button value=Submit onClick=radioChangeInputTimingSubmit(event) />"
    }
    htmlOutput = templateRender("#oneByTwoByTwo", renderObject);
    $("#individualDetailEdit").append(htmlOutput);
    $("#inputTimingSpeed").focus();
}

function radioChangeInputTimingSubmit(event) {
    if (event.keyCode != 13 && event.keyCode != null && event.keyCode != 0)
        return;
    var inputTimingSpeed = $("#inputTimingSpeed").val();
    inputTimingSpeed = parseInt(inputTimingSpeed);
    if (inputTimingSpeed < 1 || inputTimingSpeed > 0xffff) {
        showError(wordsToTranslate.changeError);
        $("#debugSection").html(wordsToTranslate.invalidAmount);
        $("#debugSection").show();
        resetOnClick = 1;
        return;
    }
    inputTimingSpeed = inputTimingSpeed.toString(16);
    var radioCommand = "IT:" + inputTimingSpeed;
    radioID = radioSettings.id;
    postRadioCommand(radioCommand, radioID);
}


function autoAddNewRadio() {
    resetEdit();
    var newRadioObject = {
        topLeft: wordsToTranslate.radioName,
        topRight: "<input id=newRadioName value='' onKeyDown=autoAddNewRadioSubmit(event) >",
        secondLeft: wordsToTranslate.Description,
        secondRight: "<textarea cols=21 rows=6 id=newRadioDescription ></textarea>",
        thirdLeft: wordsToTranslate.Location,
        thirdRight: "<input id=newRadioLocation value='' onKeyDown=autoAddNewRadioSubmit(event) />",
        bottomLeft: "&nbsp;",
        bottomRight: "<button onClick=autoAddNewRadioSubmit(event)>Submit</button>"
    };
    htmlOutput = templateRender("#twoByFour", newRadioObject);
    $("#individualDetailEdit").append(htmlOutput);
    $("#newRadioName").focus();
}

function autoAddNewRadioSubmit(event) {
    if (event.keyCode != 13 && event.keyCode != null && event.keyCode != 0)
        return;
    if ($("#newRadioName").val == "")
        return;
    $("#submitWait").show();
    $.post("ajax.php?function=processNewRadio",
            {
                name: $("#newRadioName").val(),
        description: $("#newRadioDescription").val(),
        location: $("#newRadioLocation").val()
            }
            , function (data) {
                if (data == "ok") {
                    $("#submitWait").hide();
                    reloadRadios();
                    showMessage(wordsToTranslate.changeSuccess);
                    $("individualDetailEdit").empty();
                } else {
                    $("#submitWait").hide();
                    showError(wordsToTranslate.changeError);
                    if (debugMePlease == 1) {
                        $("#debugSection").html(data);
                        $("#debugSection").show();
                    }
                }
            },
                "text"
                    ).error(function () {
                        $("#submitWait").hide();
                        showError(wordsToTranslate.nameChangeError);
                    });
            resetOnClick = 1;

}

function getRadioUpdate() {
    $("#pleaseWaitRadio").show();
    $.post("ajax.php?function=updateRadio",
            {
                radioID: radioSettings.id,
            }
            , function (data) {
                if (data == "ok") {
                    $("#pleaseWaitRadio").hide();
                    showMessage(wordsToTranslate.changeSuccess);
                    getRadioDetails(radioSettings.id, 1);
                } else {
                    $("#pleaseWaitRadio").hide();
                    showError(wordsToTranslate.changeError);
                    if (debugMePlease == 1) {
                        $("#debugSection").html(data);
                        $("#debugSection").show();
                    }
                }
            },
            "text"
          ).error(function () {
              $("#pleaseWaitRadio").hide();
              showError(wordsToTranslate.changeError);
          });
            resetOnClick = 1;

}


function reloadRadios() {
    $.get("ajax.php",
            {function: "getRadios"},
            function (response) {
                radioDivs(response)
            },
            "json");
}

function manuallyAddNewRadio() {
    resetEdit();
    var newRadioObject = {
        topLeft: wordsToTranslate.radioName,
        topRight: "<input id=newRadioName value='' onKeyDown=manuallyAddNewRadioSubmit(event) />",
        secondLeft: wordsToTranslate.Description,
        secondRight: "<textarea cols=21 rows=6 id=newRadioDescription ></textarea>",
        thirdLeft: wordsToTranslate.Location,
        thirdRight: "<input id=newRadioLocation value='' onKeyDown=manuallyAddNewRadioSubmit(event) />",
        fourthLeft: wordsToTranslate.radioChannel,
        fourthRight: "<input id=newRadioChannel onKeyDown=manuallyAddNewRadioSubmit(event) />",
        bottomLeft: "&nbsp;",
        bottomRight: "<button onClick=manuallyAddNewRadioSubmit(event)>Submit</button>"
    };
    htmlOutput = templateRender("#twoByFive", newRadioObject);
    $("#individualDetailEdit").append(htmlOutput);
    $("#newRadioName").focus();
}


function manuallyAddNewRadioSubmit(event) {
    if (event.keyCode != 13 && event.keyCode != null && event.keyCode != 0)
        return;
    if ($("#newRadioName").val == "")
        return;
    if ($("#newRadioChannel").val == "") {
        showError(wordsToTranslate.invalidChannel);
        resetOnClick = 1;
        return;
    }
    var text = $("#newRadioChannel").val();
    var reg = /^[a-zA-Z0-9:-]+$/;
    var match = text.match(reg);
    if (match == null) {
        showError(wordsToTranslate.invalidChannel);
        resetOnClick = 1;
        return;
    }

    $("#submitWait").show();
    $.post("ajax.php?function=processExistingRadio",
            {
                name: $("#newRadioName").val(),
        description: $("#newRadioDescription").val(),
        location: $("#newRadioLocation").val(),
        channel: $("#newRadioChannel").val(),
            }
            , function (data) {
                if (data == "ok") {
                    $("#submitWait").hide();
                    reloadRadios();
                    showMessage(wordsToTranslate.changeSuccess);
                    $("individualDetailEdit").empty();
                } else {
                    $("#submitWait").hide();
                    showError(wordsToTranslate.changeError);
                    if (debugMePlease == 1) {
                        $("#debugSection").html(data);
                        $("#debugSection").show();
                    }
                }
            },
                "text"
                    ).error(function () {
                        $("#submitWait").hide();
                        showError(wordsToTranslate.nameChangeError);
                    });
            resetOnClick = 1;


}

/**********************************************************
 * 
 * Radio Switches Area
 * 
 **********************************************************/

/*
 * Shows the sub navigation for the radio switches
 */
function viewRadioSwitches() {
    if ($("#radioSwitches").data("hide") == "shown") {
        showHeaderSections();
        $("#detailEditDiv").remove();
        $(".radioSwitchesSubChild").hide();
        $("#radioSwitches").data("hide", "hidden");
        $("#radioSwitchesMsg").text("Click to view switches");
    } else {
        hideHeaderSections();
        $("#radioSwitches-v").show();
        $(".radioSwitchesSubChild").show();
        $("#radioSwitches").data("hide", "shown");
        $("#radioSwitchesMsg").text("Click to hide switches");
    }
}

function addEditSwitch(switchID) {
    resetEdit();
    var addEditSwitchObject = {
        topMessage: wordsToTranslate.switchMessage,
        topLeft: wordsToTranslate.switchType,
        switchTypes: [
        {typeIndex: "x", type: wordsToTranslate.switchSelect, selected: '', },
        {typeIndex: 0, type: wordsToTranslate.switchSwitch, selected: '', },
        {typeIndex: 1, type: wordsToTranslate.switchSingleColor, selected: '', },
        {typeIndex: 2, type: wordsToTranslate.switchSmoothHue, selected: '', },
        {typeIndex: 3, type: wordsToTranslate.colorRotation, selected: '', },
        ],
        secondLeft: wordsToTranslate.portPin,
        ports: [
        {portIndex: 0, port: "PORTA", selected: ''},
        {portIndex: 1, port: "PORTB", selected: ''},
        {portIndex: 2, port: "PORTC", selected: ''},
        {portIndex: 3, port: "PORTD", selected: ''},
        {portIndex: 4, port: "PORTE", selected: ''},
        {portIndex: 5, port: "PORTF", selected: ''},
        {portIndex: 6, port: "PORTG", selected: ''},
        ],
        pins: [
        {pin: 0, selected: ''},
        {pin: 1, selected: ''},
        {pin: 2, selected: ''},
        {pin: 3, selected: ''},
        {pin: 4, selected: ''},
        {pin: 5, selected: ''},
        {pin: 6, selected: ''},
        {pin: 7, selected: ''},
        ],
        hiLo: [
        {pinID: 1, pinValue: "high", selected: ''},
        {pinID: 0, pinValue: "low", selected: ''},
        ],
        thirdLeft: wordsToTranslate.colorChangeNumber,
        thirdRight: "<input id='switchPWMColor' onKeyDown=\"addEditSwitchSubmit(event,'" + switchID + "' )\" >",
        bottomLeft: "&nbsp;",
        bottomRight: "<button onClick=addEditSwitchSubmit(event,'" + switchID + "') >Submit</button>",
        switchID: switchID,
    };
    htmlOutput = templateRender("#switchDetailForm", addEditSwitchObject);
    $("#individualDetailEdit").append(htmlOutput);
    $("#newRadioName").focus();
    if (switchID != "new") {
        var switchStuff = radioSwitches[switchID].switchStuff;
        var switchPWM = radioSwitches[switchID].switchPWM;
        switch (switchStuff) {
            case 200: //pwm
                $(".switchThirdRow").show();
                $("#switchType").val(1);
                $("#switchPWMColor").val(switchPWM);
                break;
            case 201: //hue
                $("#switchType").val(2);
                break;
            case 202: //color change
                $("#switchType").val(3);
                break;
            default:
                $(".switchSecondRow").show();
                $("#switchType").val(0);
                var port, getPin, pin, hiLo;
                port = (Math.floor(radioSwitches[switchID].switchStuff / 16));
                getPin = radioSwitches[switchID].switchStuff % 16;
                pin = Math.floor(getPin / 2);
                if (getPin % 2 == 0) {
                    hiLo = 0;
                } else {
                    hiLo = 1;
                }
                $("#port").val(port);
                $("#pin").val(pin);
                $("#hiLo").val(hiLo);
        }
    }
}


// changes the information in the form when you choose which type of switch
function changeSwitchData(data) {
    var value = data.value;
    switch (value) {
        case "0":
            $(".switchHide").hide();
            $(".switchSecondRow").show();
            break;
        case "1":
            $(".switchHide").hide();
            $(".switchThirdRow").show();
            break;
        default:
            $(".switchHide").hide();
            break;
    }
}

// PS:P#S#H - PWM setup - p# is color change num, sw #then H=Hue, C=color change, 0=static color
function addEditSwitchSubmit(event, switchID) {
    if (event.keyCode != 13 && event.keyCode != null && event.keyCode != 0)
        return;
    // need to figure out an open switch number
    if (switchID == "new") {
        for (var x = 0; x < radioSettings.switchCount; x++) {
            if (radioSwitches[x] == null) {
                switchID = x;
                break;
            }
        }
    }
    var switchType = $("#switchType").val();
    var radioCommand = "";
    var pwmColor = $("#switchPWMColor").val();
    pwmColor = ("00" + pwmColor).slice(-2);
    radioCommand = "PS:" + pwmColor + switchID;
    switch (switchType) {
        case "1": // pwm single color
            radioCommand = radioCommand + "0";
            break;
        case "2": // smooth hue pwm
            radioCommand = radioCommand + "H";
            break;
        case "3": // color change pwm
            radioCommand = radioCommand + "C";
            break;
        default: // regular switch
            var thisPortArray = ["A", "B", "C", "D", "E", "F", "G"];
            radioCommand = "NS:" + switchID + thisPortArray[$("#port").val()] + $("#pin").val() + $("#hiLo").val();
            break;
    }

    postRadioCommand(radioCommand, radioSettings.id);
}

/**********************************************************
 * 
 * Radio Programs Area
 * 
 **********************************************************/


/*
 * Shows the sub navigation for the radio programs
 */
function viewRadioPrograms() {
    if ($("#radioPrograms").data("hide") == "shown") {
        showHeaderSections();
        $("#detailEditDiv").remove();
        $(".radioProgramsSubChild").hide();
        $("#radioPrograms").data("hide", "hidden");
        $("#radioProgramsMsg").text("Click to view programs");
    } else {
        hideHeaderSections();
        $("#radioPrograms-v").show();
        $(".radioProgramsSubChild").show();
        $("#radioPrograms").data("hide", "shown");
        $("#radioProgramsMsg").text("Click to hide programs");
    }
}

function addEditProgram(programID) {
    resetEdit();
    var theseSwitches = [];
    var x;
    for(x=0;x<radioSettings.switchCount;x++) {
        theseSwitches.push({switchNumber: x});
    }
    if (radioPrograms[programID] != null) {
        var Sun, Mon, Tue, Wed, Thu, Fri, Sat, all;
        if (radioPrograms[programID].days & 0x40)
            Sun = "checked";
        if (radioPrograms[programID].days & 0x20)
            Mon = "checked";
        if (radioPrograms[programID].days & 0x10)
            Tue = "checked";
        if (radioPrograms[programID].days & 0x08)
            Wed = "checked";
        if (radioPrograms[programID].days & 0x04)
            Thu = "checked";
        if (radioPrograms[programID].days & 0x02)
            Fri = "checked";
        if (radioPrograms[programID].days & 0x01)
            Sat = "checked";
        if ((radioPrograms[programID].days & 0x7F) == 0x7F)
            all = "checked";
        var tempSwitchArray = [];
        var selectedSwitches = [];
        tempSwitchArray = radioPrograms[programID].switches.split(",");
        tempSwitchArray.forEach(function(thisSwitch) {
            if(parseInt(thisSwitch) < 255)
            selectedSwitches.push(parseInt(thisSwitch));
        });
        if(parseInt(radioPrograms[programID].rollover) < 255) {
            selectedSwitches = getOverflowSwitches(radioPrograms[programID].rollover, selectedSwitches);
        }
        selectedSwitches.forEach(function(thisSwitch) {
            theseSwitches[thisSwitch] = {switchNumber: thisSwitch, switchSelected: "selected"};
        });

        var hour = Math.floor(parseInt(radioPrograms[programID].time)/60);
        var minute = Math.floor(parseInt(radioPrograms[programID].time)%60);
        var ampm = "AM";
        if(hour > 12) {
            hour -= 12;
            ampm = "PM";
        }
        var startTime = hour.toString()+":"+  ( "0" + minute.toString()).substr(-2) + " " + ampm;
        minute = Math.floor(parseInt(radioPrograms[programID].duration)/60);
        var seconds = Math.floor(parseInt(radioPrograms[programID].duration)%60);
        var duration = minute.toString();   //+":"+("0" + seconds.toString()).substr(-2);
        var programEditObject = {
            sunChecked: Sun,
            monChecked: Mon,
            tueChecked: Tue,
            wedChecked: Wed,
            thuChecked: Thu,
            friChecked: Fri,
            satChecked: Sat,
            allChecked: all,
            startTime: startTime,
            duration: duration,
            programNumber: radioPrograms[programID].programNumber,
            programID: programID,
            programSwitches: radioPrograms[programID].programSwitches,
            topLeft: wordsToTranslate.programDaysRun,
            secondLeft: wordsToTranslate.programStartTime,
            thirdLeft: wordsToTranslate.programDuration,
            fourthLeft: wordsToTranslate.programSwitches,
            switches: theseSwitches,
        };
    } else {

        var programEditObject = {
            programID: programID,
            topLeft: wordsToTranslate.programDaysRun,
            secondLeft: wordsToTranslate.programStartTime,
            thirdLeft: wordsToTranslate.programDuration,
            fourthLeft: wordsToTranslate.programSwitches,
            switches: theseSwitches,
        };
    };
    htmlOutput = templateRender("#programDetailForm", programEditObject);
    $("#individualDetailEdit").append(htmlOutput);
    $("#programEditStartTime").kitkatclock();
}

// little helper to get us all of the overflow switches
function getOverflowSwitches(programID,switchArray) {
    var thisProgramID = -1;
    for(var x = 0; x<radioPrograms.length; x++) {
        if(radioPrograms[x].programNumber == programID) {
            thisProgramID = x;
            break
        }
    }
    if(thisProgramID == -1)
        return switchArray;
    var tempSwitchArray = [];
    tempSwitchArray = radioPrograms[thisProgramID].switches.split(",");
    tempSwitchArray.forEach(function(thisSwitch) {
        if(parseInt(thisSwitch) < 255)
        switchArray.push(parseInt(thisSwitch));
    });
    if(parseInt(radioPrograms[thisProgramID].rollover) < 255) {
        switchArray = getOverflowSwitches(radioPrograms[thisProgramID].rollover, switchArray);
    }
    return switchArray;
} 

// when the "all" button gets checked
function programCheckboxToggle(event) {
    if(event.checked) {
        $(".programCheckbox").prop("checked", true);
    } else {
        $(".programCheckbox").prop("checked", false);
    }

}


// programEdit - directly edits a program and assums that you know what you are doing
// PE:##ddssssddddswswswswPP - day of the week mask, start time (seconds in day), duration(seconds), 4 switches, 
// 0123456789012345678901234       next program (if you need more than 4 switches
// THIS FUNCTION IS TRUSTING YOU so DON'T DO IT IF YOU AREN'T COMFORTABLE

function addEditProgramSubmit(event, programID) {
    if (event.keyCode != 13 && event.keyCode != null && event.keyCode != 0)
        return;
    // need to figure out an open program number
    if (programID == "new") {
        for (var x = 0; x < radioSettings.programCount; x++) {
            if (radioPrograms[x] == null) {
                programID = x;
                break;
            }
        }
    }
    // we are going to start overriding programs.  Should erase them first
    var radioCommands = [];
    radioCommands.push("CP:"+("0"+programID).slice(-2));

    programID = ("0" + programID).slice(-2);
    var duration = $("#programEditDuration").val();
    var startTime = $("#programEditStartTime").val();
    var time = startTime.match(/(\d+)(:(\d\d))?\s*(p?)/i); 

    var hours = parseInt(time[1],10);    
    if (hours == 24 && !time[4]) {
        hours = 0;
    }
    else {
        hours += (hours < 12 && time[4])? 12 : 0;
    }   
    var minutes = (parseInt(time[3],10) || 0);
    startTime = (hours * 60) + minutes;
    startTime = ("0000" + startTime.toString(16)).slice(-4);
    var time = duration.match(/(\d+)(:(\d\d))?\s*(p?)/i); 

    minutes = parseInt(time[1],10);    
    var seconds = (parseInt(time[3],10) || 0);
    duration = (minutes * 60) + seconds;
    duration = ("0000" + duration.toString(16)).slice(-4);
    var dayInt = 0;
    if($("#sunCheckbox").prop("checked"))
        dayInt |= 0x40;
    if($("#monCheckbox").prop("checked"))
        dayInt |= 0x20;
    if($("#tueCheckbox").prop("checked"))
        dayInt |= 0x10;
    if($("#wedCheckbox").prop("checked"))
        dayInt |= 0x08;
    if($("#thuCheckbox").prop("checked"))
        dayInt |= 0x04;
    if($("#friCheckbox").prop("checked"))
        dayInt |= 0x02;
    if($("#satCheckbox").prop("checked"))
        dayInt |= 0x01;
    dayInt = ("0" + dayInt.toString(16)).slice(-2);
    radioCommand = "PE:"+programID+dayInt+startTime+duration;
    var switches = $("#programSwitchesSelect").val();
    for(x = 0; x < 4; x ++) {
        var thisSwitch = switches.shift();
        if(typeof(thisSwitch) == "undefined") {
            radioCommand = radioCommand + "FF";
        } else {
            thisSwitch = ("0" + thisSwitch.toString(16)).slice(-2);
            radioCommand = radioCommand + thisSwitch;
        }
    }


    if(switches.length > 0) {
        var overflowArray = makeOverflowProgram(switches, radioCommands);
        overflow = overflowArray[0];
        radioCommands = overflowArray[1];
    } else {
        overflow = 255;
    }
    overflow = ("0" + overflow.toString(16)).slice(-2);
    radioCommand = radioCommand + overflow;
    // put the commands together
    radioCommands.push(radioCommand);
    postRadioCommand(radioCommands, radioSettings.id);
}

// create an overflow program for extra switches
function makeOverflowProgram (switches, radioCommands) {
    var programNum = -1;
    // need to figure out an open program number
    for (var x = (radioSettings.programCount-1); x>=0; x--) {
        if (radioPrograms[x] == null) {
            programNum = x;
            break;
        }
    }
    if(programNum == -1) { // didn't find a program
        // can't do more switches.  sorry
        // this should be rare anyway
        switches = [];
        return [255, radioCommands];
    }
    // We have an empty program.  we will update the information through the import so we just want to make
    // sure we don't use the same overflow twice
    radioPrograms[programNum] = {nothingToSee: "here"};
    programNum = ("0" + programNum.toString(16)).slice(-2);
    // PE:##ddssssddddswswswswPP - day of the week mask, start time (seconds in day), duration(seconds), 4 switches, 
    var overflowRadioCommand =  "PE:" + programNum + "FFFEFFFFFF"; //  basic setup for overflow program
    for(x = 0; x < 4; x++) {
        var thisSwitch = switches.shift();
        if(typeof thisSwitch == "undefined") {
            overflowRadioCommand = overflowRadioCommand + "FF";
        } else {
            thisSwitch = ("0" + thisSwitch.toString(16)).slice(-2);
            overflowRadioCommand = overflowRadioCommand + thisSwitch;
        }
    }

    if(switches.length > 0) {
        var overflowArray = makeOverflowProgram(switches, radioCommands);
        overflow = overflowArray[0];
        radioCommands = overflowArray[1];
    } else {
        overflow = 255;
    }
    overflowRadioCommand = overflowRadioCommand + (("0" + overflow.toString(16)).slice(-2));
    radioCommands.push(overflowRadioCommand);    
    return [programNum, radioCommands];
}


/**********************************************************
 * 
 * Radio Inputs Area
 * 
 **********************************************************/


/*
 * Shows the sub navigation for the radio inputs
 */
function viewRadioInputs() {
    if ($("#radioInputs").data("hide") == "shown") {
        showHeaderSections();
        $("#detailEditDiv").remove();
        $(".radioInputsSubChild").hide();
        $("#radioInputs").data("hide", "hidden");
        $("#radioInputsMsg").text("Click to view inputs");
    } else {
        hideHeaderSections();
        $("#radioInputs-v").show();
        $(".radioInputsSubChild").show();
        $("#radioInputs").data("hide", "shown");
        $("#radioInputsMsg").text("Click to hide inputs");
    }
}

function addEditInput(inputID) {
    resetEdit();
    if(inputID == "new") {
        var duration, minutes, seconds, durationText, lowPercent, highPercent, pollTime;
        pollTime = "";
        durationText = "";
    } else {
        var duration = parseInt(radioInputs[inputID].duration);
        var minutes =  Math.floor(duration / 60);
        var seconds = duration % 60;
        var durationText = minutes.toString()+":"+("0" + seconds.toString()).slice(-2);
        var lowPercent = Math.floor((parseInt(radioInputs[inputID].lowPercent))*100/255);
        var highPercent = Math.floor((parseInt(radioInputs[inputID].highPercent))*100/255);
        var pollTime = radioInputs[inputID].pollTime;
    }
    var addEditinputObject = {
        topMessage: wordsToTranslate.inputMessage,
        topLeft: wordsToTranslate.inputType,
        inputTypes: [
        {typeIndex: "x", type: wordsToTranslate.inputSelect, selected: '', },
        {typeIndex: 0, type: wordsToTranslate.inputDigital, selected: '', },
        {typeIndex: 1, type: wordsToTranslate.inputAnalog, selected: '', },
        ],
        secondLeft: wordsToTranslate.inputPortPin,
        ports: [
        {portIndex: 0, port: "PORTA", selected: ''},
        {portIndex: 1, port: "PORTB", selected: ''},
        {portIndex: 2, port: "PORTC", selected: ''},
        {portIndex: 3, port: "PORTD", selected: ''},
        {portIndex: 4, port: "PORTE", selected: ''},
        {portIndex: 5, port: "PORTF", selected: ''},
        {portIndex: 6, port: "PORTG", selected: ''},
        ],
        pins: [
        {pin: 0, selected: ''},
        {pin: 1, selected: ''},
        {pin: 2, selected: ''},
        {pin: 3, selected: ''},
        {pin: 4, selected: ''},
        {pin: 5, selected: ''},
        {pin: 6, selected: ''},
        {pin: 7, selected: ''},
        ],
        thirdLeft: wordsToTranslate.inputSwitchProgram,
        thirdRight: "<input id='inputSwitchProgramNum' size=5 onKeyDown=\"addEditInputSubmit(event,'" + inputID + "' )\" >",
        fourthLeftDigital: wordsToTranslate.digitalInputHiLo,
        fourthRightDigital:  "", 
        fourthLeftAnalog: wordsToTranslate.analogInputHiLo,
        fourthRightAnalogLow: "<input size=5 value='"+lowPercent+"' id='analogLowInput' />",
        fourthRightAnalogHigh: "<input size=5 value='"+highPercent+"' id='analogHighInput' />",
        fifthLeft: wordsToTranslate.inputDuration,
        fifthRight: "<input id='inputDuration' size=5 onKeyDown=\"addEditInputSubmit(event,'" + inputID + "' )\" "+
            " value='"+durationText+"' >",
        sixthLeft: wordsToTranslate.inputHowOften,
        sixthRight: "<input id='inputHowOften' size=5 onKeyDown=\"addEditInputSubmit(event,'" + inputID + "' )\" "+ 
            "value='" + pollTime + "' >",
        bottomLeft: "&nbsp;",
        bottomRight: "<button onClick=addEditInputSubmit(event,'" + inputID + "') >Submit</button>",
        inputNumber: inputID,
    };
    htmlOutput = templateRender("#inputDetailForm", addEditinputObject);
    $("#individualDetailEdit").append(htmlOutput);
    $("#newRadioName").focus();
    if (inputID != "new") {
        var pinStuff = radioInputs[inputID].pinStuff;
        if(radioInputs[inputID].lowPercent == 255 || radioInputs[inputID].highPercent == 255) {
            $("#inputType").val(0);
            $(".digitalInput").show();
            $("#digitalInputHiLoH").prop("checked", true);
        } else {
            $("#inputType").val(1);
            $(".analogInput").show();
            $("#digitalInputHiLoL").prop("checked", true);
        }
        var port, getPin, pin, hiLo;
        port = (Math.floor(radioInputs[inputID].inputStuff / 16));
        getPin = radioInputs[inputID].inputStuff % 16;
        pin = Math.floor(getPin / 2);
        if (getPin % 2 == 0) {
            hiLo = 0;
        } else {
            hiLo = 1;
        }
        var port, getPin, pin, hiLo;
        port = (Math.floor(radioInputs[inputID].pinStuff / 16));
        getPin = radioInputs[inputID].pinStuff % 16;
        pin = Math.floor(getPin / 2);
        $("#port").val(port);
        $("#pin").val(pin);
        var switchOrProgram = parseInt(radioInputs[inputID].whichSwitchOrProgram);
        if(switchOrProgram >= 128) {
            $("#inputSwitchProgramP").prop("checked", true);
            switchOrProgram -= 128;
        } else {
            $("#inputSwitchProgramS").prop("checked", true);
        }
        $("#inputSwitchProgramNum").val(switchOrProgram);
    }
}

//AI:##PpLLLHHH?##DuraPO - Analog input - ## input num, port/pin, LLL%,HHH%,? = (s)witch or (p)rogram, ## num, dur/poll time in seconds
//DI:##Ppx?##DuraPO - Digital input. x=H/L for what activates switch
function addEditInputSubmit(event, inputID) {
    if (event.keyCode != 13 && event.keyCode != null && event.keyCode != 0)
        return;
    // need to figure out an open program number
    if (inputID == "new") {
        for (var x = 0; x < radioSettings.inputCount; x++) {
            if (radioInputs[x] == null) {
                inputID = x;
                break;
            }
        }
    }
    var inputNum = ("0" + inputID.toString()).slice(-2);
    var thisPortArray = ["A", "B", "C", "D", "E", "F", "G"];
    if($("#inputSwitchProgramP").prop("checked") == true) {
        var switchOrProgram = "P";
    } else {
        var switchOrProgram = "S";
    }
    var switchOrProgramNum = $("#inputSwitchProgramNum").val();
    switchOrProgramNum = ("00" + switchOrProgramNum).slice(-2);
    var duration = $("#inputDuration").val();
    var time = duration.match(/(\d+)(:(\d\d))?\s*(p?)/i); 

    var minutes = parseInt(time[1],10);    
    var seconds = (parseInt(time[3],10) || 0);
    duration = (minutes * 60) + seconds;
 
    duration = ("0000" + duration.toString()).slice(-4);
    var pollTime = $("#inputHowOften").val();
    pollTime = ("0" + pollTime).slice(-2);
    var port = $("#port").val();
    var pin = $("#pin").val();
    if($("#inputType").val() == 0) {
        if($("#digitalInputHiLoH").prop("checked") == true) {
            var hiLo = "H";
        } else {
            var hiLo = "L";
        }
        var radioCommand = "DI:"+inputNum+thisPortArray[port]+pin+hiLo+switchOrProgram+switchOrProgramNum+duration+pollTime;
    } else {
        var low = ("000" + $("#analogLowInput").val()).slice(-3);
        var high = ("000" + $("#analogHighInput").val()).slice(-3)
        var radioCommand = "AI:"+inputNum+thisPortArray[port]+pin+low+high+switchOrProgram+switchOrProgramNum+duration+pollTime;
    }
    postRadioCommand(radioCommand, radioSettings.id);
}


// choose which type of input and show/hide options based on it
function changeInputData(event) {
    if($("#inputType").val() == 0) {
        $(".digitalInput").show();
        $(".analogInput").hide();
    } else if ($("#inputType").val() == 1) {
        $(".digitalInput").hide();
        $(".analogInput").show();
    } else {
        $(".digitalInput").hide();
        $(".analogInput").hide();
    }
}


/**********************************************************
 * 
 * Radio Colors Area
 * 
 **********************************************************/


/*
 * Shows the sub navigation for the radio inputs
 */
function viewRadioColors() {
    if ($("#radioColors").data("hide") == "shown") {
        showHeaderSections();
        $("#detailEditDiv").remove();
        $(".radioColorsSubChild").hide();
        $("#radioColors").data("hide", "hidden");
        $("#radioColorsMsg").text("Click to view colors");
    } else {
        hideHeaderSections();
        $("#radioColors-v").show();
        $(".radioColorsSubChild").show();
        $("#radioColors").data("hide", "shown");
        $("#radioColorsMsg").text("Click to hide colors");
    }
}

function addEditColors(colorID) {
    console.log(radioColors);
    resetEdit();
    if(colorID != "new") {
        var red = radioColors[colorID].red;
        var green = radioColors[colorID].green;
        var blue = radioColors[colorID].blue;
        red = ("00" + red.toString(16)).slice(-2);
        green = ("00" + green.toString(16)).slice(-2);   
        blue = ("00" + blue.toString(16)).slice(-2);
        var color = red + green + blue;
        console.log(color);
    } else {
        var color = "";
    }
    var addEditColorsObject = {
        topLeft: wordsToTranslate.changeColor,
        topRight: "<input id=colorInput value='" + color + "' />",
        secondLeft: wordsToTranslate.colorChangeable,
        secondRight: "<input id=colorChangeY type=radio name=colorChangeable >"+wordsToTranslate.yes+"</input>"+
            "<input id=colorChangeN type=radio name=colorChangeable >"+wordsToTranslate.no+"</input> ",
        bottomLeft: "&nbsp;",
        bottomRight: "<button onClick=addEditColorsSubmit(event,'" + colorID + "') >Submit</button>",
    }
    htmlOutput = templateRender("#twoByThree", addEditColorsObject);
    $("#individualDetailEdit").append(htmlOutput);
 
} 

/**********************************************************
 * 
 * Radio TimeLimits Area
 * 
 **********************************************************/


/*
 * Shows the sub navigation for the radio inputs
 */
function viewRadioTimeLimits() {
    if ($("#radioTimeLimits").data("hide") == "shown") {
        showHeaderSections();
        $("#detailEditDiv").remove();
        $(".radioTimeLimitsSubChild").hide();
        $("#radioTimeLimits").data("hide", "hidden");
        $("#radioTimeLimitsMsg").text("Click to view time limits");
    } else {
        hideHeaderSections();
        $("#radioTimeLimits-v").show();
        $(".radioTimeLimitsSubChild").show();
        $("#radioTimeLimits").data("hide", "shown");
        $("#radioTimeLimitsMsg").text("Click to hide time limits");
    }
}

function addEditTimeLimits(limitID) {

}

/**********************************************************
 * 
 * General List
 * 
 **********************************************************/

function resetEdit() {
    $("#individualDetailEdit").children('div').each(function () {
        $(this).remove();
    });
}

function showMessage(message) {
    $("#messageBar").html(message);
    $("#messageBar").show();
}

function showError(message) {
    $("#errorBar").html(message)
        $("#errorBar").show();
}

function hideHeaderSections() {
    $(".headerSection").hide();
}

function showHeaderSections() {
    $(".headerSection").show();
}

// This send the actual data to the server to send to the radio
function postRadioCommand(radioCommand, radioID) {
    $("#submitWait").show();
    $.post("ajax.php?function=sendRadioCommand",
            {
                radioID: radioID,
        command: radioCommand,
            }
            , function (data) {
                $("#submitWait").hide();
                if (data == "ok") {
                    showMessage(wordsToTranslate.changeSuccess);
                    resetOnClick = 1;
                    getRadioUpdate();
                } else {
                    showError(wordsToTranslate.changeError);
                    resetOnClick = 1;
                    if (debugMePlease == 1) {
                        $("#debugSection").html(data);
                        $("#debugSection").show();
                    }
                }
            },
            "text"
                ).error(function () {
                    showError(wordsToTranslate.changeError);
                    resetOnClick = 1;
                })

}




/**********************************************************
 * 
 * Edit Templates
 * 
 **********************************************************/

// don't wanna type the same thing a million times
function templateRender(templateID, Data) {
    var template = $.templates(templateID)
        var htmlOutput = template.render(Data);
    return htmlOutput;
}



