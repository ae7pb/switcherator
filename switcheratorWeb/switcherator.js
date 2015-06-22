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
        $("#detailEditDiv").remove();
    }
});

// templates file
$.get("templates.html", function (templates) {
    $("body").append(templates);
})


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
function radioDetail(radioNum) {
    if ($("#backToRadioList").is(":visible"))
        return;
    $("#radioList").children('div').each(function () {
        $(this).hide();
    })
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
    // fill in the global variables
    radioSettings = response.radio;
    radioSwitches = response.switches;
    radioPrograms = response.programs;
    radioInputs = response.inputs;
    radioColors = response.colors;
    radioTimeLimits = response.timeLimits;
    var htmlOutput = "";
    /*
     * Radio settings boxes
     */

    htmlOutput = templateRender("#radioViewSettingsTemplate", radioSettings);
    $("#radioSwitches").before(htmlOutput);

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

    htmlOutput = templateRender("#radioOtherSettingsTemplate", data);
    $("#radioSwitches").before(htmlOutput);



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
    htmlOutput = templateRender("#radioViewSwitchesTemplate", "");
    $("#radioPrograms").before(htmlOutput);    
    htmlOutput = templateRender("#radioViewSwitchTemplate", switchArray);
    $("#radioPrograms").before(htmlOutput);    
    /*
     * Radio programs boxes
     */

    htmlOutput = templateRender("#radioViewProgramsTemplate", "");
    $("#radioInputs").before(htmlOutput);    

    var programDays, dayInt, programStart, hour, minute, programDuration, switchArray, programSwitches;
    var Sun, Mon, Tue, Wed, Thu, Fri, Sat;
    var programArray = [];
    radioPrograms.forEach(function (thisProgram) {
        // programNumber, days (0b01111111 = sun-sat), time (seconds from midnight), duration(seconds), 
        // switches(ff=blank), rollover(next program that houses more switches)
        dayInt = parseInt(thisProgram.days,10);
        if(dayInt & 0x40)Sun = 1;else Sun = 0;
        if(dayInt & 0x20)Mon = 1;else Mon = 0;
        if(dayInt & 0x10)Tue = 1;else Tue = 0;
        if(dayInt & 0x08)Wed = 1;else Wed = 0;
        if(dayInt & 0x04)Thu = 1;else Thu = 0;
        if(dayInt & 0x02)Fri = 1;else Fri = 0;
        if(dayInt & 0x01)Sat = 1;else Sat = 0;
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
    htmlOutput = templateRender("#radioViewProgramTemplate", programArray);
    $("#radioInputs").before(htmlOutput);    

    /*
     * Radio inputs boxes
     */

    htmlOutput = templateRender("#radioViewInputsTemplate", "");
    $("#radioColors").before(htmlOutput);

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

    htmlOutput = templateRender("#radioViewInputTemplate", inputArray);
    $("#radioColors").before(htmlOutput);
    /*
     * Radio colors boxes
     */

    htmlOutput = templateRender("#radioViewColorsTemplate", "");
    $("#radioColors").before(htmlOutput);

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
    htmlOutput = templateRender("#radioViewColorTemplate", colorArray);
    $("#radioColors").before(htmlOutput);


    /*
     * Radio time limits boxes
     */
    htmlOutput = templateRender("#radioViewTimeLimitsTemplate", "");
    $("#radioColors").before(htmlOutput);
    
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
        if(dayInt & 0x40)Sun = 1;else Sun = 0;
        if(dayInt & 0x20)Mon = 1;else Mon = 0;
        if(dayInt & 0x10)Tue = 1;else Tue = 0;
        if(dayInt & 0x08)Wed = 1;else Wed = 0;
        if(dayInt & 0x04)Thu = 1;else Thu = 0;
        if(dayInt & 0x02)Fri = 1;else Fri = 0;
        if(dayInt & 0x01)Sat = 1;else Sat = 0;
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
    htmlOutput = templateRender("#radioViewTimeLimitTemplate", timeLimitArray);
    $("#radioColors").before(htmlOutput);




    $("#radioSettings").data("hide", "hidden");
    $("#radioSwitches").data("hide", "hidden");
    $("#radioPrograms").data("hide", "hidden");
    $("#radioInputs").data("hide", "hidden");
    $("#radioColors").data("hide", "hidden");
    $(".radioDetails").show();
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
        $(".radioSettingsSubChild").hide();
        $("#radioSettings").data("hide", "hidden");
        $("#radioSettingsMsg").text("Click to view settings");
    } else {
        $(".radioSettingsSubChild").show();
        $("#radioSettings").data("hide", "shown");
        $("#radioSettingsMsg").text("Click to hide settings");
    }
}

// Change the name of the radio, edit the description and location.
function radioChangeName() {
    // stupid bug I'm not sure how to deal with
    if (radioSettings.description == 'null')
        radioSettings.description = " ";
    twoByFour("", "Radio Name:",
            "<input id=newRadioName value='" + radioSettings.name + "' onKeyPress=radioChangeNameSubmit(event) />", "Description",
            "<textarea cols=21 rows=6 id=newRadioDescription >" + radioSettings.description + "</textarea>",
            "Location", "<input id=newRadioLocation value='" + radioSettings.location + "' onKeyPress=radioChangeNameSubmit(event) />",
            "&nbsp;", "<button onClick=radioChangeNameSubmit(event)>Submit</button>", "");
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
            showMessage("Name changed.");
        } else {
            showError("Name change error.");
        }
    },
            "text"
            ).error(function () {
        showError("Name change error.");
    });
    resetOnClick = 1;
}
;

function radioChangeTweak() {
    resetEdit();
    oneByTwoByTwo(
            "Enter an amount +/-999 to adjust how many ticks in a second.  Default is 15,525.",
            "Amount:", "<input id=clockTweak value=0 onKeyPress(radioChangeTweakSubmit(event);) />", "&nbsp;",
            "<input type=button value=Submit onClick=radioChangeTweakSubmit(event) />");
}

function radioChangeTweakSubmit(event) {
    if (event.keyCode != 13 && event.keyCode != 0)
        return;
    $.post("ajax.php?function=radioChangeTweak",
            {
                radioID: radioSettings.id,
                amount: $("#clockTweak").val(),
                description: $("newRadioDescription").val(),
                location: $("#newRadioLocation").val()
            }
    , function (data) {
        console.log(data);
        if (data.status == "ok") {
            $("#clockTweakDisplay").val(data.tweak);
            radioSettings.clockTweak = data.tweak.toString(16);
            showMessage("Tweak changed.");
        } else {
            showError("Tweak error.");
        }
    },
            "json"
            ).error(function () {
        showError("Tweak error!");
    })
    resetOnClick = 1;

}

function radioChangeInputTiming() {

}

function radioChangeHueSpeed() {

}

function radioChangeColorSpeed() {

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
        $(".radioSwitchesSubChild").hide();
        $("#radioSwitches").data("hide", "hidden");
        $("#radioSwitchesMsg").text("Click to view switches");
    } else {
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
        $(".radioProgramsSubChild").hide();
        $("#radioPrograms").data("hide", "hidden");
        $("#radioProgramsMsg").text("Click to view programs");
    } else {
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
        $(".radioInputsSubChild").hide();
        $("#radioInputs").data("hide", "hidden");
        $("#radioInputsMsg").text("Click to view inputs");
    } else {
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
        $(".radioColorsSubChild").hide();
        $("#radioColors").data("hide", "hidden");
        $("#radioColorsMsg").text("Click to view colors");
    } else {
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
        $(".radioTimeLimitsSubChild").hide();
        $("#radioTimeLimits").data("hide", "hidden");
        $("#radioTimeLimitsMsg").text("Click to view time limits");
    } else {
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



function twoByFour(preTable, topLeft, topRight, secondLeft, secondRight, thirdLeft, thirdRight, bottomLeft, bottomRight, postTable) {
    resetEdit();
    $("#individualDetailEdit").append(
            "<div id=detailEditDiv class=detailEdit >" + preTable + "<table class=detailTable><tr class=detailTable><td class=left >" + topLeft + "</td>\
            <td class=right>" + topRight + "</td></tr><tr class=detailTable><td class=left>" + secondLeft + "</td><td class=right>" + secondRight +
            "</td></tr><tr class=detailTable><td class=left>" + thirdLeft + "</td><td class=right>" + thirdRight + "</td></tr>" +
            "<tr class=detailTable><td class=left>" + bottomLeft + "</td><td class=right>" + bottomRight + "</td></tr></table>" + postTable + "</div>"
            );
}

function oneByTwoByTwo(top, secondLeft, secondRight, bottomLeft, bottomRight) {
    $("#individualDetailEdit").append(
            "<div id=detailEditDiv class=detailEdit ><table class=detailTable><tr class=detailTable><td class=left colspan=2 >" + top + "</td>\
            </tr><tr class=detailTable><td class=left>" + secondLeft + "</td><td class=right>" + secondRight + "</td></tr>" +
            "<tr class=detailTable><td class=left>" + bottomLeft + "</td><td class=right>" + bottomRight + "</td></tr></table></div>"
            );
}
