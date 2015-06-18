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
    var container = $("#navBar");
    container.html("<div class=subNav><b>Hello&nbsp;</b></div><div class=subNav>there</div>");

}

/*
 * Populate the existing radioDiv element with a new box for each radio
 */
function radioDivs(response) {
    response.forEach(function (radio) {
        var output = radio.name;
        var container = $("#radioList");
        var radioNum = radio.id;
        container.append(
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


    var colorChangeSpeed = parseInt(radioSettings.colorChangeSpeed, 16);
    $("#radioSettings").after(
            "<div id=radioSettings-1 class='radioSettingsChild radioSettingsSubChild detailField' " +
            "onclick=radioChangeName() >Color change speed (0-9999 default 10 = 1 second): <br/><b>" + colorChangeSpeed + "</b></div>");
    
    var hueSpeed = parseInt(radioSettings.hueSpeed, 16);
    $("#radioSettings").after(
            "<div id=radioSettings-1 class='radioSettingsChild radioSettingsSubChild detailField' " +
            "onclick=radioChangeName() >Smooth hue color change speed (0-99 default 16): <br/><b>" + hueSpeed + "</b></div>");

    // Input message timing - When an input is triggered and we send a message the input message timing is
    // how long we wait before we send the next message
    var inputTiming = parseInt(radioSettings.inputMessageTiming, 16);
    $("#radioSettings").after(
            "<div id=radioSettings-1 class='radioSettingsChild radioSettingsSubChild detailField' " +
            "onclick=radioChangeName() >Timing between input messages - 0 = no messages: <br/><b>" + inputTiming + "</b></div>");

    var clockTweak = parseInt(radioSettings.clockTweak, 16);
    clockTweak = clockTweak.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    $("#radioSettings").after(
            "<div id=radioSettings-2 class='radioSettingsChild radioSettingsSubChild detailField' " +
            "onclick=radioChangeTweak() >Clock adjustment (15,625 default):<br/><b> " + clockTweak + "</b></div>");

    $("#radioSettings").after(
            "<div id=radioSettings-1 class='radioSettingsChild radioSettingsSubChild detailField' " +
            "onclick=radioChangeName() >Name: <br/><b>" + response.radio.name + "</b></div>");

    $("#radioSettings").after(
            "<div id=radioSettings-0 class='radioSettingsChild detailField' onclick=viewRadioSettings() >" +
            "<span id=radioSettingsMsg >Click to view Settings</span></div>"
            );


    $("#radioSettings").data("hide", "hidden");
    $(".radioDetails").show();
    //TODO: you are here
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
        $("#radioSettingsMsg").text("Click to view Settings");
    } else {
        $(".radioSettingsSubChild").show();
        $("#radioSettings").data("hide", "shown");
        $("#radioSettingsMsg").text("Click to hide Settings");
    }
}


function radioChangeName() {

}

