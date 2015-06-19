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

/*
 * 
 * Shows the navigation bar
 */
function navigationBar(radioText) {
    $("#navBar").html("<div class=subNav><b>Hello&nbsp;</b></div><div class=subNav>there</div>");

}

/*
 * Populate the existing radioDiv element with a new box for each radio
 */
function radioDivs(response) {
    response.forEach(function (radio) {
        var output = radio.name;
        var radioNum = radio.id;
        $("#radioList").append(
                "<div id=radio-" + radioNum + " class=radios onclick='radioDetail(" + radioNum + ")'>" + output + "</div>"
                );
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
    radioPrograms = response.program;
    radioInputs = response.inputs;
    radioColors = response.colors;
    radioTimeLimits = response.timeLimits;

    /*
     * Radio settings boxes
     */

    $("#radioSettings").append(
            "<div id=radioSettings-0 class='radioSettingsChild detailField' onclick=viewRadioSettings() >" +
            "<span id=radioSettingsMsg >Click to view Settings</span></div>"
            );

    $("#radioSettings").append(
            "<div id=radioSettings-1 class='radioSettingsChild radioSettingsSubChild detailField' " +
            "onclick=radioChangeName() >Name: <br/><b>" + response.radio.name + "</b></div>");

    var clockTweak = parseInt(radioSettings.clockTweak, 16);
    clockTweak = clockTweak.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    $("#radioSettings").append(
            "<div id=radioSettings-2 class='radioSettingsChild radioSettingsSubChild detailField' " +
            "onclick=radioChangeTweak() >Clock adjustment (15,625 default):<br/><b> " + clockTweak + "</b></div>");

    var colorChangeSpeed = parseInt(radioSettings.colorChangeSpeed, 16);
    $("#radioSettings").append(
            "<div id=radioSettings-1 class='radioSettingsChild radioSettingsSubChild detailField' " +
            "onclick=radioChangeColorSpeed() >Color change speed (0-9999 default 10 = 1 second): <br/><b>" + colorChangeSpeed + "</b></div>");

    var hueSpeed = parseInt(radioSettings.hueSpeed, 16);
    $("#radioSettings").append(
            "<div id=radioSettings-1 class='radioSettingsChild radioSettingsSubChild detailField' " +
            "onclick=radioChangeHueSpeed() >Smooth hue color change speed (0-99 default 16): <br/><b>" + hueSpeed + "</b></div>");

    // Input message timing - When an input is triggered and we send a message the input message timing is
    // how long we wait before we send the next message
    var inputTiming = parseInt(radioSettings.inputMessageTiming, 16);
    $("#radioSettings").append(
            "<div id=radioSettings-1 class='radioSettingsChild radioSettingsSubChild detailField' " +
            "onclick=radioChangeInputTiming() >Timing between input messages (0 = no messages): <br/><b>" + inputTiming + "</b></div>");




    $("#radioSwitches").append(
            "<div id=radioSwitches-0 class='radioSwitchesChild detailField' onclick=viewRadioSwitches() >" +
            "<span id=radioSwitchesMsg >Click to view Switches</span></div>"
            );
    $("#radioSwitches").append(
            "<div id=radioSwitches-n class='radioSwitchesChild radioSwitchesSubChild detailField' onclick=addEditSwitch('new') >" +
            "Click to add new switch</div>"
            );

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
        $("#radioSwitches").append(
                "<div id=radioSwitches-" + thisSwitch.id + " class='radioSwitchesChild radioSwitchesSubChild detailField' " +
                "onClick=addEditSwitch(" + thisSwitch.id + ")>Switch #" + thisSwitch.switchNumber + " " + switchMessage + "</div>"
                );

    });
    /*
     * Radio programs boxes
     */

    $("#radioPrograms").append(
            "<div id=radioPrograms-v class='radioProgramsChild detailField' onclick=viewRadioPrograms() >" +
            "<span id=radioProgramsMsg >Click to view programs</span></div>"
            );
    $("#radioPrograms").append(
            "<div id=radioPrograms-n class='radioProgramsChild radioProgramsSubChild detailField' onclick=addEditProgram('new') >" +
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
        $("#radioPrograms").append(
                "<div id=radioPrograms-" + thisProgram.id + " class='radioProgramsChild " +
                "radioProgramsSubChild detailField' onclick=addEditProgram('" + thisProgram.id +
                "') >" + "Program #" + thisProgram.programNumber + " Start:" + programStart +
                " Dur.:" + programDuration + " " + programDays + " Sw:" + programSwitches + "</div>"
                );

    });

    /*
     * Radio inputs boxes
     */

    $("#radioInputs").append(
            "<div id=radioInputs-v class='radioInputsChild detailField' onclick=viewRadioInputs() >" +
            "<span id=radioInputsMsg >Click to view inputs</span></div>"
            );
    $("#radioInputs").append(
            "<div id=radioInputs-n class='radioInputsChild radioInputsSubChild detailField' onclick=addEditProgram('new') >" +
            "Click to add new input</div>"
            );

    // input information (from switcherator.c)
    // Pp - value of 255 (default) means nothing programmed
    // value of 0-15 = PORTA, 16-31 = PORTB, 32-47 = PORTC, 
    // 48-63 = PORTD, 64-79 = PORTE, 80-95 = PORTF, 96-112 = PORTG
    // pin is abs(value/2)-the base - PINB3 = (22-16)/2  PINB3 (22-16)%2 = 0 - low (23-16)%2 = 1 - high
    // pLHsDDPw Pp int pin/port like sw, L%,H% (0,255 - digital), s - 0-127=switch, 128-255 = prog
    // dur in seconds, poll time in secs or  0 for continuous. w = which rgb (mask);)

    var inputPinStuff, inputLow, inputHigh, inputSwitchOrProgram, inputDuration, inputPollTime, inputWhichRGB, port, pin, getPin, portPin;
    radioInputs.forEach(function (thisInput) {
        inputPinStuff = parseInt(thisInput.pinStuff, 10);
        // low threshhold that must be met to start switch (analog)
        inputLow = parseInt(thisInput.lowPercent, 10);
        // high threshhold - max analog can be or 255 for digital switch
        inputHigh = parseInt(thisInput.highPercent, 10);
        // 0-127 = switch, 128-255 = program
        inputSwitchOrProgram = parseInt(thisInput.whichSwitchOrProgram, 10);
        inputDuration = parseInt(thisInput.inputDuration, 10);
        // 0 = every 1/10 second or >0 is num seconds
        inputPollTime = parseInt(thisInput.pollTime);
        inputWhichRGB = parseInt(thisInput.whichRGB);
        port = Math.floor(inputPinStuff / 16);
        getPin = inputPinStuff % 16;
        pin = Math.floor(getPin / 2);
        portPin = ports[port]+pin.toString(10);
        // TODO: you are here 
    });
    /*
     * Radio colors boxes
     */

    /*
     * Radio time limits boxes
     */

    $("#radioSettings").data("hide", "hidden");
    $("#radioSwitches").data("hide", "hidden");
    $("#radioPrograms").data("hide", "hidden");
    $("#radioInputs").data("hide", "hidden");
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


function radioChangeName() {

}

function radioChangeTweak() {

}

function radioChangeInputTiming() {

}

function radioChangeHueSpeed() {

}

function radioChangeColorSpeed() {

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

function addEditSwitch(switchNum) {

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

function addEditProgram(programNum) {

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

function addEditProgram(inputNum) {

}
