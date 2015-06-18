
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

function showRadioDetails(response) {
    $("#pleaseWaitRadio").hide();
    if(response.fail !== null)
        $("#radioDetails").text(response.fail);
    //TODO: you are here
}

/*
 * $('.ring-preview').children('img').each(function(i) { 
 $(this).rotate(ring.stones[i].stone_rotation);
 });
 */