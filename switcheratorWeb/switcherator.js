/*
 * 
 * SwitcheratorWeb
 * copyright 2015 David Whipple
 * Creative Commons Attribution
 */

// TODO: Show menu for new radio



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
var radioCommandResult;
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
function getRadioDetails(radioNum,updateMe) {
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
    if($("#radioSettings").data("hide") == "shown") {
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
                red = parseInt(radioColors[colorNum]["red"]);
                green = parseInt(radioColors[colorNum]["green"]);
                blue = parseInt(radioColors[colorNum]["blue"]);
                if (red < 75 || green < 75 || blue < 75)
                    textColor = "white";
                switchColor = ("0" + red.toString(16)).substr(-2) + ("0" + green.toString(16)).substr(-2) +
                        ("0" + blue.toString(16)).substr(-2);
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
    var Sun, Mon, Tue, Wed, Thu, Fri, Sat;
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
        programStart = hour.toString(10) + ":" + (("0" + minute.toString(10)).substr(-2));
        programDuration = (Math.floor((parseInt(thisProgram.duration)) / 60)).toString(10);
        switchArray = thisProgram.switches.split(",");
        programSwitches = "";
        for (var x = 0; x < switchArray.length; x++) {
            if (switchArray[x] !== "ff") {
                if (x > 0)
                    programSwitches += ",";
                programSwitches += (parseInt(switchArray[x], 16)).toString(10);
            }
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
            programSwitches: programSwitches
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
            id: thisInput.id,
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




    $("#radioSettings").data("hide", "hidden");
    $("#radioSwitches").data("hide", "hidden");
    $("#radioPrograms").data("hide", "hidden");
    $("#radioInputs").data("hide", "hidden");
    $("#radioColors").data("hide", "hidden");
    $("#radioTimeLimits").data("hide", "hidden");
    $(".radioDetails").show();
    if(typeof(showMe) === "function") {
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
        topRight: "<input id=newRadioName value='" + radioSettings.name + "' onKeyPress=radioChangeNameSubmit(event) />",
        secondLeft: wordsToTranslate.Description,
        secondRight: "<textarea cols=21 rows=6 id=newRadioDescription >" + radioSettings.description + "</textarea>",
        thirdLeft: wordsToTranslate.Location,
        thirdRight: "<input id=newRadioLocation value='" + radioSettings.location + "' onKeyPress=radioChangeNameSubmit(event) />",
        bottomLeft: "&nbsp;",
        bottomRight: "<button onClick=radioChangeNameSubmit(event)>Submit</button>"
    };
    htmlOutput = templateRender("#twoByFour", changeNameArray);
    $("#individualDetailEdit").append(htmlOutput);
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
            showMessage(wordsToTranslate.nameChangeError);
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
        topRight: "<input id=clockTweak value=0 onKeyPress=radioChangeTweakSubmit(event); />",
        bottomLeft: "&nbsp;",
        bottomRight: "<input type=button value=Submit onClick=radioChangeTweakSubmit(event) />"
    }
    htmlOutput = templateRender("#oneByTwoByTwo", changeTweakArray);
    $("#individualDetailEdit").append(htmlOutput);
}

// from readme
// CT:xxxx - sets amount to adjust the timer.  15625? is default
function radioChangeTweakSubmit(event) {
    if (event.keyCode != 13 && event.keyCode != 0)
        return;
    var tweak = $("#clockTweak").val();
    // convert it to int and back to sanitize
    tweak = parseInt(tweak);
    tweak = tweak.toString(10);
    if (tweak == "NaN" || tweak > 9999 || tweak < -999) {
        showError(wordsToTranslate.tweakChangeError);
        if (debugMePlease == 1) {
            $("#debugSection").html(wordsToTranslate.invalidAmount);
            $("#debugSection").show();
        }
        resetOnClick = 1;
        return;
    }
    var radioCommand = "CT:" + tweak;
    radioID = radioSettings.id;
    radioCommandResult = '';
    postRadioCommand(radioCommand, radioID);
}




function radioChangeColorSpeed() {
    resetEdit();
    var renderObject = {
        topMessage: wordsToTranslate.colorChangeSpeedMessage,
        topLeft: wordsToTranslate.ccsInput,
        topRight: "<input id=ccSpeed value=" + parseInt(radioSettings.colorChangeSpeed, 16) + " onKeyPress=radioColorChangeSpeedSubmit(event); />",
        bottomLeft: "&nbsp;",
        bottomRight: "<input type=button value=Submit onClick=radioColorChangeSpeedSubmit(event) />"
    }
    htmlOutput = templateRender("#oneByTwoByTwo", renderObject);
    $("#individualDetailEdit").append(htmlOutput);
}

function radioColorChangeSpeedSubmit(event) {
    if (event.keyCode != 13 && event.keyCode != 0)
        return;
    var ccSpeed = $("#ccSpeed").val();
    ccSpeed = parseInt(ccSpeed);
    if (ccSpeed < 1 || ccSpeed > 9999) {
        showError(wordsToTranslate.ccsChangeError);
        $("#debugSection").html(wordsToTranslate.invalidAmount);
        $("#debugSection").show();
        resetOnClick = 1;
        return;
    }
    ccSpeed = ccSpeed.toString();
    var radioCommand = "CH:" + ccSpeed;
    radioID = radioSettings.id;
    radioCommandResult = '';
    postRadioCommand(radioCommand, radioID);
}


function radioChangeHueSpeed() {

}


function radioChangeInputTiming() {

}

function addNewRadio() {

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
            getRadioDetails(radioID,1);
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



