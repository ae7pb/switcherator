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
$.get("templates.html",function(templates) {
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
            { radioNum: radioNum, output: output }
        ];
        var htmlOutput = templateRender("#radioListTemplate",radioListings);
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
    
    htmlOutput = templateRender("#radioViewSettingsTemplate",radioSettings);
    $("#radioSwitches").before(htmlOutput);

    var clockTweak = parseInt(radioSettings.clockTweak, 16);
    clockTweak = clockTweak.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    var colorChangeSpeed = parseInt(radioSettings.colorChangeSpeed, 16);
    var hueSpeed = parseInt(radioSettings.hueSpeed, 16);
    // Input message timing - When an input is triggered and we send a message the input message timing is
    // how long we wait before we send the next message
    var inputTiming = parseInt(radioSettings.inputMessageTiming, 16);
    var data = [
        { clockTweak: clockTweak,
            colorChangeSpeed: colorChangeSpeed,
            hueSpeed: hueSpeed,
            inputTiming: inputTiming
                }
    ]

    htmlOutput = templateRender("#radioOtherSettingsTemplate",data);
    $("#radioSwitches").before(htmlOutput);



    /*
     * Radio switches boxes
     */
    var port, getPin, pin, hiLo, switchMessage, switchStuff, colorNum, red, green, blue, switchColor, textColor;
    radioSwitches.forEach(function (thisSwitch) {
        switchStuff = parseInt(thisSwitch.switchStuff, 10);
        // switch stuff is a complicated but compact port / pin switch thingie. Need to decode it
        if (switchStuff >= 200) {
            switch (switchStuff) {
                // 200 = single color pwm
                case 200:
                    textColor = "black";
                    colorNum = parseInt(thisSwitch.switchPWM, 10);
                    red = parseInt(radioColors[colorNum]["red"]);
                    green = parseInt(radioColors[colorNum]["green"]);
                    blue = parseInt(radioColors[colorNum]["blue"]);
                    if (red < 75 || green < 75 || blue < 75)
                        textColor = "white";
                    switchColor = ("0" + red.toString(16)).substr(-2) + ("0" + green.toString(16)).substr(-2) +
                            ("0" + blue.toString(16)).substr(-2);
                    switchMessage = "Single color PWM - color # " + thisSwitch.switchPWM + ". " +
                            "<span style='background-color: #" + switchColor + "; color: " + textColor + ";' >0x" +
                            switchColor + "</span>";
                    break;
                case 201:
                    switchMessage("Activate smooth hue color change");
                    break;
                case 202:
                    switchMessage("Activate color change rotation");
                    break;
            }
        } else {
            port = ports[(Math.floor(thisSwitch.switchStuff / 16))];
            getPin = thisSwitch.switchStuff % 16;
            pin = Math.floor(getPin / 2);
            if (getPin % 2 == 0) {
                hiLo = "low";
            } else {
                hiLo = "high";
            }
            switchMessage = "Switch " + port + pin + " Pin is " + hiLo + " when activated";
        }
        $("#radioPrograms").before(
                "<div id=radioSwitches-" + thisSwitch.id + " class='radioSwitchesChild radioSwitchesSubChild detailField' " +
                "onClick=addEditSwitch(" + thisSwitch.id + ")>Switch #" + thisSwitch.switchNumber + " " + switchMessage + "</div>"
                );

    });
    /*
     * Radio programs boxes
     */

    $("#radioInputs").before(
            "<div id=radioPrograms-v class='radioProgramsChild detailField' onclick=viewRadioPrograms() >" +
            "<span id=radioProgramsMsg >Click to view programs</span></div>"
            );
    $("#radioInputs").before(
            "<div id=radioPrograms-n class='radioProgramsChild radioProgramsSubChild detailField' onclick=addEditProgram('new') >"+
            "Click to add new program</div>"
            );

    var programDays, dayInt, programStart, hour, minute, programDuration, switchArray, programSwitches;
    radioPrograms.forEach(function (thisProgram) {
        // programNumber, days (0b01111111 = sun-sat), time (seconds from midnight), duration(seconds), 
        // switches(ff=blank), rollover(next program that houses more switches)
        dayInt = parseInt(thisProgram.days, 10);
        if (dayInt & 0x40)
            programDays = "S";
        else
            programDays = "-";
        if (dayInt & 0x20)
            programDays += "M";
        else
            programDays += "-";
        if (dayInt & 0x10)
            programDays += "T";
        else
            programDays += "-";
        if (dayInt & 0x08)
            programDays += "W";
        else
            programDays += "-";
        if (dayInt & 0x04)
            programDays += "T";
        else
            programDays += "-";
        if (dayInt & 0x02)
            programDays += "F";
        else
            programDays += "-";
        if (dayInt & 0x01)
            programDays += "S";
        else
            programDays += "-";
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
                programSwitches += parseInt(switchArray[x], 16).toString(10);
            }
        }
        $("#radioInputs").before(
                "<div id=radioPrograms-" + thisProgram.id + " class='radioProgramsChild " +
                "radioProgramsSubChild detailField' onclick=addEditProgram('" + thisProgram.id +
                "') >" + "Program #" + thisProgram.programNumber + " Start:" + programStart +
                " Dur.:" + programDuration + " " + programDays + " Sw:" + programSwitches + "</div>"
                );

    });

    /*
     * Radio inputs boxes
     */

    $("#radioColors").before(
            "<div id=radioInputs-v class='radioInputsChild detailField' onclick=viewRadioInputs() >" +
            "<span id=radioInputsMsg >Click to view inputs</span></div>"
            );
    $("#radioColors").before(
            "<div id=radioInputs-n class='radioInputsChild radioInputsSubChild detailField' onclick=addEditInput('new') >" +
            "Click to add new input</div>"
            );

    // input information (from switcherator.c)
    // Pp - value of 255 (default) means nothing programmed
    // value of 0-15 = PORTA, 16-31 = PORTB, 32-47 = PORTC, 
    // 48-63 = PORTD, 64-79 = PORTE, 80-95 = PORTF, 96-112 = PORTG
    // pin is abs(value/2)-the base - PINB3 = (22-16)/2  PINB3 (22-16)%2 = 0 - low (23-16)%2 = 1 - high
    // pLHsDDPw Pp int pin/port like sw, L%,H% (0,255 - digital), s - 0-127=switch, 128-255 = prog
    // dur in seconds, poll time in secs or  0 for continuous. w = which rgb (mask);)

    var inputPinStuff, inputLow, inputHigh, inputType, inputValues, inputSwitchOrProgram, inputPollTime, inputWhichRGB,
            port, pin, getPin, portPin, switchOrProgText, switchNum;
    radioInputs.forEach(function (thisInput) {
        inputPinStuff = parseInt(thisInput.pinStuff, 10);
        // low threshhold that must be met to start switch (analog)
        inputLow = parseInt(thisInput.lowPercent, 10);
        // high threshhold - max analog can be or 255 for digital switch
        inputHigh = parseInt(thisInput.highPercent, 10);
        // 0-127 = switch, 128-255 = program
        if (inputHigh == 255 || inputLow == 255) {
            inputType = "Digital";
            if (inputHigh == 255)
                inputValues = "High activates";
            else
                inputValues = "Low activates";
        } else {
            inputType = "Analog";
            inputValues = (Math.floor(inputHigh * 100 / 254)).toString(10) + "% - " +
                    (Math.floor(inputLow * 100 / 254)).toString(10) + "%";
        }
        inputSwitchOrProgram = parseInt(thisInput.whichSwitchOrProgram, 10);
        if (inputSwitchOrProgram > 127) {
            switchNum = inputSwitchOrProgram - 128;
            switchOrProgText = "Pr#" + switchNum.toString(10);
        } else {
            switchOrProgText = "Sw#" + inputSwitchOrProgram.toString(10);
        }
        // 0 = every 1/10 second or >0 is num seconds
        inputPollTime = parseInt(thisInput.pollTime);
        inputWhichRGB = parseInt(thisInput.whichRGB);
        port = Math.floor(inputPinStuff / 16);
        getPin = inputPinStuff % 16;
        pin = Math.floor(getPin / 2);
        portPin = ports[port] + pin.toString(10);
        $("#radioColors").before(
                "<div id=radioInputs-" + thisInput.id + " class='radioInputsChild radioInputsSubChild detailField'" +
                " onclick=addEditInput('" + thisInput.id + "') >" + inputType + " #" + thisInput.inputNumber + " " +
                portPin + " " + inputValues +
                " " + switchOrProgText + " Dur:" + thisInput.duration + " Poll time:" + thisInput.pollTime
                + "</div>");
    });

    /*
     * Radio colors boxes
     */
    $("#radioTimeLimits").before(
            "<div id=radioColors-v class='radioColorsChild detailField' onclick=viewRadioColors() >" +
            "<span id=radioColorsMsg >Click to view colors</span></div>"
            );
    $("#radioTimeLimits").before(
            "<div id=radioColors-n class='radioColorsChild radioColorsSubChild detailField' onclick=addEditColors('new') >" +
            "Click to add new color</div>"
            );

    var colorText, colorMessage, changeMessage;
    radioColors.forEach(function (thisColor) {
        red = parseInt(thisColor.red);
        green = parseInt(thisColor.green);
        blue = parseInt(thisColor.blue);
        textColor = "black";
        if (red < 75 || green < 75 || blue < 75)
            textColor = "white";
        colorText = ("0" + red.toString(16)).substr(-2) + ("0" + green.toString(16)).substr(-2) +
                ("0" + blue.toString(16)).substr(-2);
        colorMessage =
                "<span style='background-color: #" + colorText + "; color: " + textColor + ";' >0x" +
                colorText + "</span>";
        if (thisColor.ifChangeable == "1")
            changeMessage = "<br/>Part of rotating change";
        else
            changeMessage = "<br/>Not part of rotating change";

        $("#radioTimeLimits").before(
                "<div id=radioColors-" + thisColor.id + " class='radioColorsChild radioColorsSubChild detailField'" +
                " onclick=addEditColors('" + thisColor.id + "') >Color #" + thisColor.colorChangeNumber + " " + colorMessage +
                " " + changeMessage + "</div>"
                );
    });


    /*
     * Radio time limits boxes
     */
    $("#uhEnding").before(
            "<div id=radioTimeLimits-v class='radioTimeLimitsChild detailField' onclick=viewRadioTimeLimits() >" +
            "<span id=radioTimeLimitsMsg >Click to view time limits</span></div>"
            );
    $("#uhEnding").before(
            "<div id=radioTimeLimits-n class='radioTimeLimitsChild radioTimeLimitsSubChild detailField'"+
            " onclick=addEditTimeLimits('new') >" + "Click to add new time limit</div>"
            );
    var limitStart, limitStop, startMessage, stopMessage, limitDays;
    radioTimeLimits.forEach(function (thisLimit) {
        limitStart = parseInt(thisLimit.startTime);
        limitStop = parseInt(thisLimit.stopTime);
        hour = Math.floor(limitStart / 60);
        minute = limitStart % 60;
        startMessage = " Start: ".hour.toString(10) + ":" + (("0" + minute.toString(10)).substr(-2));
        hour = Math.floor(limitStop / 60);
        minute = limitStop % 60;
        stopMessage = " Stop: ".hour.toString(10) + ":" + (("0" + minute.toString(10)).substr(-2));
        dayInt = parseInt(thisLimit.days, 10);
        if (dayInt & 0x40)
            limitDays = "S";
        else
            limitDays = "-";
        if (dayInt & 0x20)
            limitDays += "M";
        else
            limitDays += "-";
        if (dayInt & 0x10)
            limitDays += "T";
        else
            limitDays += "-";
        if (dayInt & 0x08)
            limitDays += "W";
        else
            limitDays += "-";
        if (dayInt & 0x04)
            limitDays += "T";
        else
            limitDays += "-";
        if (dayInt & 0x02)
            limitDays += "F";
        else
            limitDays += "-";
        if (dayInt & 0x01)
            limitDays += "S";
        else
            limitDays += "-";
        $("#uhEnding").before(
                "<div id=radioTimeLimits-" + thisLimit.id + " class='radioTimeLimitsChild radioTimeLimitsSubChild detailField' " +
                "onclick=addEditTimeLimits('" + thisLimit.id + "') >Time Limit #" + thisLimit.limitNumber + startMessage +
                stopMessage + " Days:" + limitDays + "</div>"
                );
    })




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
    if(event.keyCode != 13 && event.keyCode != 0 )
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
            $("#radio-"+radioSettings.id).html(radioSettings.name);
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
};

function radioChangeTweak() {
    resetEdit();
    oneByTwoByTwo(
            "Enter an amount +/-999 to adjust how many ticks in a second.  Default is 15,525.",
            "Amount:", "<input id=clockTweak value=0 onKeyPress(radioChangeTweakSubmit(event);) />", "&nbsp;",
            "<input type=button value=Submit onClick=radioChangeTweakSubmit(event) />");
}

function radioChangeTweakSubmit(event) {
    if(event.keyCode != 13 && event.keyCode != 0 )
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
function templateRender(templateID,Data) {
        var template = $.templates(templateID)
        var htmlOutput = template.render(Data);
        return htmlOutput;
}



function twoByFour(preTable, topLeft, topRight, secondLeft, secondRight, thirdLeft, thirdRight, bottomLeft, bottomRight, postTable) {
    resetEdit();
    $("#individualDetailEdit").append(
            "<div id=detailEditDiv class=detailEdit >"+preTable+"<table class=detailTable><tr class=detailTable><td class=left >" + topLeft + "</td>\
            <td class=right>" + topRight + "</td></tr><tr class=detailTable><td class=left>" + secondLeft + "</td><td class=right>" + secondRight +
            "</td></tr><tr class=detailTable><td class=left>" + thirdLeft + "</td><td class=right>" + thirdRight + "</td></tr>" +
            "<tr class=detailTable><td class=left>" + bottomLeft + "</td><td class=right>" + bottomRight + "</td></tr></table>"+postTable+"</div>"
            );
}

function oneByTwoByTwo(top, secondLeft, secondRight, bottomLeft, bottomRight) {
    $("#individualDetailEdit").append(
            "<div id=detailEditDiv class=detailEdit ><table class=detailTable><tr class=detailTable><td class=left colspan=2 >" + top + "</td>\
            </tr><tr class=detailTable><td class=left>" + secondLeft + "</td><td class=right>" + secondRight + "</td></tr>" +
            "<tr class=detailTable><td class=left>" + bottomLeft + "</td><td class=right>" + bottomRight + "</td></tr></table></div>"
            );
}
